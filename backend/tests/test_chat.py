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
