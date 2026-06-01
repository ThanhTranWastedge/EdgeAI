import pytest
import json
import uuid
from unittest.mock import patch, AsyncMock, MagicMock
from app.auth.utils import hash_password
from app.chat.providers.base import ChatResponse


async def setup_user_and_integration(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration

    uid = str(uuid.uuid4())
    iid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="chatuser", password_hash=hash_password("p"), role="admin")
        integration = Integration(
            id=iid, name="Test Chat", provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m", "system_prompt": ""}),
            updated_by=uid,
        )
        db.add_all([user, integration])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "chatuser", "password": "p"})
    token = login.json()["access_token"]
    return token, iid


@pytest.mark.asyncio
async def test_send_message(client):
    token, iid = await setup_user_and_integration(client)

    mock_response = ChatResponse(content="Hello from AI", references=None, provider_session_id=None)

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.return_value = mock_response
        mock_get.return_value = mock_provider

        response = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "Hi there"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assistant_message"]["content"] == "Hello from AI"
        assert data["session_id"] is not None


@pytest.mark.asyncio
async def test_send_message_appends_to_existing_session_with_history(client):
    token, iid = await setup_user_and_integration(client)

    first_response = ChatResponse(content="First answer", references=None, provider_session_id=None)
    second_response = ChatResponse(content="Second answer", references=None, provider_session_id=None)

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.side_effect = [first_response, second_response]
        mock_get.return_value = mock_provider

        first = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "First question", "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        session_id = first.json()["session_id"]

        second = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "Second question", "session_id": session_id, "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert second.status_code == 200
    assert second.json()["session_id"] == session_id
    assert mock_provider.send_message.call_args_list[1].kwargs["history"] == [
        {"role": "user", "content": "First question"},
        {"role": "assistant", "content": "First answer"},
    ]

    detail = await client.get(
        f"/api/chat/{iid}/sessions/{session_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    messages = detail.json()["messages"]
    assert [m["content"] for m in messages] == [
        "First question",
        "First answer",
        "Second question",
        "Second answer",
    ]
    assert [m["sequence"] for m in messages] == [1, 2, 3, 4]


@pytest.mark.asyncio
async def test_append_rejects_session_from_another_integration(client):
    token, iid = await setup_user_and_integration(client)
    from tests.conftest import TestingSessionLocal
    from app.models import Integration
    from sqlalchemy import select

    other_iid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        owner_result = await db.execute(select(Integration.updated_by).where(Integration.id == iid))
        owner_id = owner_result.scalar_one()
        other = Integration(
            id=other_iid,
            name="Other Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=owner_id,
        )
        db.add(other)
        await db.commit()

    mock_response = ChatResponse(content="First answer", references=None, provider_session_id=None)
    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.return_value = mock_response
        mock_get.return_value = mock_provider
        first = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "First question", "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert first.status_code == 200
        session_id = first.json()["session_id"]

        mock_provider.send_message.reset_mock()
        response = await client.post(
            f"/api/chat/{other_iid}/send",
            json={"message": "Bad append", "session_id": session_id, "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "Session not found"
    mock_provider.send_message.assert_not_called()


@pytest.mark.asyncio
async def test_append_enforces_twenty_user_question_cap(client):
    token, iid = await setup_user_and_integration(client)

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.return_value = ChatResponse(content="answer", references=None, provider_session_id=None)
        mock_get.return_value = mock_provider

        first = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "q1", "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert first.status_code == 200
        session_id = first.json()["session_id"]

        for index in range(2, 21):
            ok = await client.post(
                f"/api/chat/{iid}/send",
                json={"message": f"q{index}", "session_id": session_id, "stream": False},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert ok.status_code == 200

        mock_provider.send_message.reset_mock()
        capped = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "q21", "session_id": session_id, "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert capped.status_code == 400
    assert capped.json()["detail"] == "Session question limit reached"
    mock_provider.send_message.assert_not_called()


@pytest.mark.asyncio
async def test_append_rejects_session_owned_by_another_user(client):
    token, iid = await setup_user_and_integration(client)
    from tests.conftest import TestingSessionLocal
    from app.models import User

    other_uid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        other_user = User(
            id=other_uid,
            username="other-chat-user",
            password_hash=hash_password("p"),
            role="admin",
        )
        db.add(other_user)
        await db.commit()

    other_login = await client.post(
        "/api/auth/login",
        json={"username": "other-chat-user", "password": "p"},
    )
    other_token = other_login.json()["access_token"]

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.return_value = ChatResponse(content="answer", references=None, provider_session_id=None)
        mock_get.return_value = mock_provider

        first = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "owner question", "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert first.status_code == 200
        session_id = first.json()["session_id"]

        mock_provider.send_message.reset_mock()
        rejected = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "intruder question", "session_id": session_id, "stream": False},
            headers={"Authorization": f"Bearer {other_token}"},
        )

    assert rejected.status_code == 404
    assert rejected.json()["detail"] == "Session not found"
    mock_provider.send_message.assert_not_called()


@pytest.mark.asyncio
async def test_append_requires_current_user_integration_access(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration, UserIntegrationAccess
    from app.constants import ROLE_USER
    from sqlalchemy import delete

    uid = str(uuid.uuid4())
    iid = str(uuid.uuid4())
    access_id = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="limited-user", password_hash=hash_password("p"), role=ROLE_USER)
        integration = Integration(
            id=iid,
            name="Limited Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=uid,
        )
        access = UserIntegrationAccess(
            id=access_id,
            user_id=uid,
            integration_id=iid,
            granted_by=uid,
        )
        db.add_all([user, integration, access])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "limited-user", "password": "p"})
    token = login.json()["access_token"]

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.return_value = ChatResponse(content="answer", references=None, provider_session_id=None)
        mock_get.return_value = mock_provider

        first = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "first", "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert first.status_code == 200
        session_id = first.json()["session_id"]

        async with TestingSessionLocal() as db:
            await db.execute(delete(UserIntegrationAccess).where(UserIntegrationAccess.id == access_id))
            await db.commit()

        mock_provider.send_message.reset_mock()
        denied = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "second", "session_id": session_id, "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert denied.status_code == 403
    assert denied.json()["detail"] == "No access to this integration"
    mock_provider.send_message.assert_not_called()


@pytest.mark.asyncio
async def test_list_sessions(client):
    token, iid = await setup_user_and_integration(client)

    mock_response = ChatResponse(content="resp", references=None, provider_session_id=None)
    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.return_value = mock_response
        mock_get.return_value = mock_provider
        await client.post(f"/api/chat/{iid}/send", json={"message": "q1"}, headers={"Authorization": f"Bearer {token}"})
        await client.post(f"/api/chat/{iid}/send", json={"message": "q2"}, headers={"Authorization": f"Bearer {token}"})

    response = await client.get(f"/api/chat/{iid}/sessions", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    sessions = response.json()
    assert len(sessions) == 2


@pytest.mark.asyncio
async def test_get_session_detail(client):
    token, iid = await setup_user_and_integration(client)

    mock_response = ChatResponse(content="detailed answer", references=None, provider_session_id=None)
    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.return_value = mock_response
        mock_get.return_value = mock_provider
        send = await client.post(f"/api/chat/{iid}/send", json={"message": "detail q"}, headers={"Authorization": f"Bearer {token}"})
        session_id = send.json()["session_id"]

    response = await client.get(f"/api/chat/{iid}/sessions/{session_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["messages"]) == 2
    assert data["messages"][0]["role"] == "user"
    assert data["messages"][1]["role"] == "assistant"
    assert data["messages"][1]["content"] == "detailed answer"
