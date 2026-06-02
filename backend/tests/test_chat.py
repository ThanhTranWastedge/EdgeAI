import asyncio
import pytest
import json
import uuid
from unittest.mock import patch, AsyncMock, MagicMock
from app.auth.utils import hash_password
from app.chat.providers.base import ChatResponse


def parse_sse_done_data(response_text):
    current_event = None
    for line in response_text.splitlines():
        if line.startswith("event:"):
            current_event = line.removeprefix("event:").strip()
        elif current_event == "done" and line.startswith("data:"):
            return json.loads(line.removeprefix("data:").strip())
    pytest.fail("SSE response did not include a done event")


def parse_sse_events(response_text):
    events = []
    current_event = "message"
    for line in response_text.splitlines():
        if line.startswith("event:"):
            current_event = line.removeprefix("event:").strip()
        elif line.startswith("data:"):
            events.append((current_event, line.removeprefix("data:").strip()))
            current_event = "message"
    return events


def reset_sse_app_status():
    from sse_starlette.sse import AppStatus

    AppStatus.should_exit = False
    AppStatus.should_exit_event = None


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
        {"role": "assistant", "content": "Assistant (Test Chat): First answer"},
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
async def test_streaming_send_appends_and_returns_session_id(client):
    from tests.conftest import TestingSessionLocal

    token, iid = await setup_user_and_integration(client)
    stream_histories = []

    async def fake_stream(message, context=None, history=None):
        stream_histories.append(history)
        yield type("Chunk", (), {"content": "streamed ", "done": False})()
        yield type("Chunk", (), {"content": "answer", "done": False})()
        yield type("Chunk", (), {"content": "", "done": True, "references": None, "provider_session_id": None})()

    with (
        patch("app.chat.router.get_provider") as mock_get,
        patch("app.database.async_session", TestingSessionLocal),
    ):
        mock_provider = MagicMock()
        mock_provider.stream_message = fake_stream
        mock_get.return_value = mock_provider

        first = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "stream q1", "stream": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        first_body = first.text
        session_id = parse_sse_done_data(first_body)["session_id"]

        second = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "stream q2", "session_id": session_id, "stream": True},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert second.status_code == 200
    assert f'"session_id": "{session_id}"' in second.text
    assert stream_histories[1] == [
        {"role": "user", "content": "stream q1"},
        {"role": "assistant", "content": "Assistant (Test Chat): streamed answer"},
    ]


@pytest.mark.asyncio
async def test_concurrent_non_streaming_appends_are_serialized_with_complete_history(client):
    token, iid = await setup_user_and_integration(client)
    call_histories = {}

    async def fake_send(message, context=None, history=None):
        call_histories[message] = list(history or [])
        if message.startswith("append"):
            await asyncio.sleep(0.05)
        return ChatResponse(content=f"answer for {message}", references=None, provider_session_id=None)

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.side_effect = fake_send
        mock_get.return_value = mock_provider

        first = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "initial", "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert first.status_code == 200
        session_id = first.json()["session_id"]

        first_append, second_append = await asyncio.gather(
            client.post(
                f"/api/chat/{iid}/send",
                json={"message": "append 1", "session_id": session_id, "stream": False},
                headers={"Authorization": f"Bearer {token}"},
            ),
            client.post(
                f"/api/chat/{iid}/send",
                json={"message": "append 2", "session_id": session_id, "stream": False},
                headers={"Authorization": f"Bearer {token}"},
            ),
        )

    assert first_append.status_code == 200
    assert second_append.status_code == 200

    detail = await client.get(
        f"/api/chat/{iid}/sessions/{session_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    messages = detail.json()["messages"]
    assert [m["sequence"] for m in messages] == [1, 2, 3, 4, 5, 6]
    assert len({m["sequence"] for m in messages}) == 6

    append_1_history = call_histories["append 1"]
    append_2_history = call_histories["append 2"]
    assert sorted(len(history) for history in (append_1_history, append_2_history)) == [2, 4]

    first_history = append_1_history if len(append_1_history) == 2 else append_2_history
    later_history = append_1_history if len(append_1_history) == 4 else append_2_history
    assert first_history == [
        {"role": "user", "content": "initial"},
        {"role": "assistant", "content": "Assistant (Test Chat): answer for initial"},
    ]
    assert later_history[:2] == first_history
    assert later_history[2:] in (
        [
            {"role": "user", "content": "append 1"},
            {"role": "assistant", "content": "Assistant (Test Chat): answer for append 1"},
        ],
        [
            {"role": "user", "content": "append 2"},
            {"role": "assistant", "content": "Assistant (Test Chat): answer for append 2"},
        ],
    )


@pytest.mark.asyncio
async def test_stream_done_event_waits_until_assistant_message_is_persisted(client):
    from app.chat import router as chat_router
    from app.models import Integration, Message, Session
    from sqlalchemy import select
    from tests.conftest import TestingSessionLocal

    _, iid = await setup_user_and_integration(client)

    async with TestingSessionLocal() as db:
        integration_result = await db.execute(select(Integration).where(Integration.id == iid))
        integration = integration_result.scalar_one()
        session = Session(
            user_id=integration.updated_by,
            integration_id=iid,
            title="stream ordering",
        )
        db.add(session)
        await db.commit()
        session_id = session.id

    async def fake_stream(message, context=None, history=None):
        yield type("Chunk", (), {"content": "saved ", "done": False})()
        yield type("Chunk", (), {"content": "before done", "done": False})()
        yield type(
            "Chunk",
            (),
            {
                "content": "",
                "done": True,
                "references": [{"source": "doc"}],
                "provider_session_id": "provider-session",
            },
        )()

    with (
        patch("app.chat.router.get_provider") as mock_get,
        patch("app.database.async_session", TestingSessionLocal),
    ):
        mock_provider = MagicMock()
        mock_provider.stream_message = fake_stream
        mock_get.return_value = mock_provider
        response = await chat_router._stream_response(
            integration,
            session_id,
            "ordering q",
            None,
            [],
            2,
            integration.id,
            integration.name,
        )

        async for event in response.body_iterator:
            if event.get("event") == "done":
                async with TestingSessionLocal() as db:
                    message_result = await db.execute(
                        select(Message).where(
                            Message.session_id == session_id,
                            Message.role == "assistant",
                        )
                    )
                    assistant_message = message_result.scalar_one_or_none()
                    integration_result = await db.execute(
                        select(Session.ragflow_session_id).where(Session.id == session_id)
                    )
                    provider_session_id = integration_result.scalar_one()

                assert assistant_message is not None
                assert assistant_message.content == "saved before done"
                assert assistant_message.references == json.dumps([{"source": "doc"}])
                assert assistant_message.sequence == 2
                assert provider_session_id == "provider-session"
                assert json.loads(event["data"]) == {
                    "references": [{"source": "doc"}],
                    "provider_session_id": "provider-session",
                    "session_id": session_id,
                }
                break
        else:
            pytest.fail("Stream did not yield done event")


@pytest.mark.asyncio
async def test_stream_exception_persists_error_assistant_and_emits_error_event(client):
    from app.chat.router import ASSISTANT_STREAM_ERROR_MESSAGE
    from app.models import Message
    from sqlalchemy import select
    from tests.conftest import TestingSessionLocal

    token, iid = await setup_user_and_integration(client)
    user_message_was_persisted_before_stream_error = False
    reset_sse_app_status()

    async def failing_stream(message, context=None, history=None):
        nonlocal user_message_was_persisted_before_stream_error
        async with TestingSessionLocal() as db:
            result = await db.execute(
                select(Message).where(
                    Message.role == "user",
                    Message.content == "stream failure question",
                )
            )
            user_message_was_persisted_before_stream_error = result.scalar_one_or_none() is not None
        raise RuntimeError("provider stream failed")
        yield

    with (
        patch("app.chat.router.get_provider") as mock_get,
        patch("app.database.async_session", TestingSessionLocal),
    ):
        mock_provider = MagicMock()
        mock_provider.stream_message = failing_stream
        mock_get.return_value = mock_provider

        response = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "stream failure question", "stream": True},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert user_message_was_persisted_before_stream_error is True
    events = parse_sse_events(response.text)
    error_events = [
        json.loads(data)
        for event_name, data in events
        if event_name == "error"
    ]
    assert len(error_events) == 1
    assert error_events[0]["detail"] == "Provider error during streaming"
    assert error_events[0]["session_id"] is not None
    assert all(event_name != "done" for event_name, _ in events)

    async with TestingSessionLocal() as db:
        result = await db.execute(select(Message).order_by(Message.sequence))
        messages = result.scalars().all()

    assert [(message.role, message.content, message.sequence) for message in messages] == [
        ("user", "stream failure question", 1),
        ("assistant", ASSISTANT_STREAM_ERROR_MESSAGE, 2),
    ]


@pytest.mark.asyncio
async def test_streaming_append_lock_blocks_second_history_until_first_assistant_persists(client):
    from tests.conftest import TestingSessionLocal

    token, iid = await setup_user_and_integration(client)
    release_first_stream = asyncio.Event()
    first_stream_started = asyncio.Event()
    second_history_captured = asyncio.Event()
    stream_histories = {}
    reset_sse_app_status()

    async def fake_stream(message, context=None, history=None):
        stream_histories[message] = list(history or [])
        if message == "stream append 1":
            first_stream_started.set()
            yield type("Chunk", (), {"content": "first streamed ", "done": False})()
            await release_first_stream.wait()
            yield type("Chunk", (), {"content": "assistant", "done": False})()
            yield type("Chunk", (), {"content": "", "done": True, "references": None, "provider_session_id": None})()
        elif message == "stream append 2":
            second_history_captured.set()
            yield type("Chunk", (), {"content": "second assistant", "done": False})()
            yield type("Chunk", (), {"content": "", "done": True, "references": None, "provider_session_id": None})()
        else:
            raise AssertionError(f"Unexpected streamed message: {message}")

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.return_value = ChatResponse(content="initial answer", references=None, provider_session_id=None)
        mock_get.return_value = mock_provider

        first = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "initial", "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert first.status_code == 200
        session_id = first.json()["session_id"]

    with (
        patch("app.chat.router.get_provider") as mock_get,
        patch("app.database.async_session", TestingSessionLocal),
    ):
        mock_provider = MagicMock()
        mock_provider.stream_message = fake_stream
        mock_get.return_value = mock_provider

        first_append_task = asyncio.create_task(client.post(
            f"/api/chat/{iid}/send",
            json={"message": "stream append 1", "session_id": session_id, "stream": True},
            headers={"Authorization": f"Bearer {token}"},
        ))
        await first_stream_started.wait()

        second_append_task = asyncio.create_task(client.post(
            f"/api/chat/{iid}/send",
            json={"message": "stream append 2", "session_id": session_id, "stream": True},
            headers={"Authorization": f"Bearer {token}"},
        ))
        await asyncio.sleep(0)

        assert "stream append 2" not in stream_histories
        assert second_history_captured.is_set() is False

        release_first_stream.set()
        first_append, second_append = await asyncio.gather(first_append_task, second_append_task)

    assert first_append.status_code == 200
    assert second_append.status_code == 200
    assert parse_sse_done_data(first_append.text)["session_id"] == session_id
    assert parse_sse_done_data(second_append.text)["session_id"] == session_id
    assert stream_histories["stream append 2"] == [
        {"role": "user", "content": "initial"},
        {"role": "assistant", "content": "Assistant (Test Chat): initial answer"},
        {"role": "user", "content": "stream append 1"},
        {"role": "assistant", "content": "Assistant (Test Chat): first streamed assistant"},
    ]


@pytest.mark.asyncio
async def test_legacy_integration_route_supports_mixed_target_append(client):
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

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.side_effect = [
            ChatResponse(content="First answer", references=None, provider_session_id=None),
            ChatResponse(content="Other answer", references=None, provider_session_id=None),
        ]
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
            json={"message": "Other append", "session_id": session_id, "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["session_id"] == session_id
    assert mock_provider.send_message.call_args.kwargs["history"] == [
        {"role": "user", "content": "First question"},
        {"role": "assistant", "content": "Assistant (Test Chat): First answer"},
    ]

    detail = await client.get(
        f"/api/chat/{iid}/sessions/{session_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    data = detail.json()
    assert data["integration_id"] == iid
    assert data["integration_name"] == "Test Chat"
    assert data["last_integration_id"] == other_iid
    assert data["last_integration_name"] == "Other Chat"
    assert [(m["content"], m["integration_name"]) for m in data["messages"]] == [
        ("First question", "Test Chat"),
        ("First answer", "Test Chat"),
        ("Other append", "Other Chat"),
        ("Other answer", "Other Chat"),
    ]

    original_list = await client.get(f"/api/chat/{iid}/sessions", headers={"Authorization": f"Bearer {token}"})
    other_list = await client.get(f"/api/chat/{other_iid}/sessions", headers={"Authorization": f"Bearer {token}"})
    assert len(original_list.json()) == 1
    assert other_list.json() == []


@pytest.mark.asyncio
async def test_append_enforces_ten_user_question_cap(client):
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

        for index in range(2, 11):
            ok = await client.post(
                f"/api/chat/{iid}/send",
                json={"message": f"q{index}", "session_id": session_id, "stream": False},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert ok.status_code == 200

        mock_provider.send_message.reset_mock()
        capped = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "q11", "session_id": session_id, "stream": False},
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


async def setup_user_with_two_integrations(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration

    uid = str(uuid.uuid4())
    first_id = str(uuid.uuid4())
    second_id = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="mixeduser", password_hash=hash_password("p"), role="admin")
        first = Integration(
            id=first_id,
            name="First Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=uid,
        )
        second = Integration(
            id=second_id,
            name="Second Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=uid,
        )
        db.add_all([user, first, second])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "mixeduser", "password": "p"})
    return login.json()["access_token"], first_id, second_id


@pytest.mark.asyncio
async def test_streaming_new_route_persists_target_metadata(client):
    from tests.conftest import TestingSessionLocal
    from app.models import Message, Session
    from sqlalchemy import select

    token, first_id, _ = await setup_user_with_two_integrations(client)
    reset_sse_app_status()

    async def fake_stream(message, context=None, history=None):
        yield type("Chunk", (), {"content": "streamed", "done": False})()
        yield type("Chunk", (), {"content": "", "done": True, "references": None, "provider_session_id": None})()

    with (
        patch("app.chat.router.get_provider") as mock_get,
        patch("app.database.async_session", TestingSessionLocal),
    ):
        mock_provider = MagicMock()
        mock_provider.stream_message = fake_stream
        mock_get.return_value = mock_provider

        response = await client.post(
            "/api/chat/send",
            json={"integration_id": first_id, "message": "stream target", "stream": True},
            headers={"Authorization": f"Bearer {token}"},
        )

    session_id = parse_sse_done_data(response.text)["session_id"]
    async with TestingSessionLocal() as db:
        session = (await db.execute(select(Session).where(Session.id == session_id))).scalar_one()
        messages = (await db.execute(select(Message).order_by(Message.sequence))).scalars().all()

    assert session.last_integration_id == first_id
    assert [m.integration_name for m in messages] == ["First Chat", "First Chat"]


@pytest.mark.asyncio
async def test_new_send_routes_support_mixed_target_followups(client):
    token, first_id, second_id = await setup_user_with_two_integrations(client)

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.side_effect = [
            ChatResponse(content="first answer", references=None, provider_session_id=None),
            ChatResponse(content="second answer", references=None, provider_session_id=None),
        ]
        mock_get.return_value = mock_provider

        first = await client.post(
            "/api/chat/send",
            json={"integration_id": first_id, "message": "q1", "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        session_id = first.json()["session_id"]
        second = await client.post(
            f"/api/chat/sessions/{session_id}/send",
            json={"integration_id": second_id, "message": "q2", "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["session_id"] == session_id
    assert mock_provider.send_message.call_args_list[1].kwargs["history"] == [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "Assistant (First Chat): first answer"},
    ]

    detail = await client.get(
        f"/api/chat/sessions/{session_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    data = detail.json()
    assert data["integration_id"] == first_id
    assert data["integration_name"] == "First Chat"
    assert data["last_integration_id"] == second_id
    assert data["last_integration_name"] == "Second Chat"
    assert [(m["content"], m["integration_name"]) for m in data["messages"]] == [
        ("q1", "First Chat"),
        ("first answer", "First Chat"),
        ("q2", "Second Chat"),
        ("second answer", "Second Chat"),
    ]


@pytest.mark.asyncio
async def test_global_session_send_rejects_session_owned_by_another_user(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User

    token, first_id, _ = await setup_user_with_two_integrations(client)

    other_uid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        other_user = User(
            id=other_uid,
            username="global-other-chat-user",
            password_hash=hash_password("p"),
            role="admin",
        )
        db.add(other_user)
        await db.commit()

    other_login = await client.post(
        "/api/auth/login",
        json={"username": "global-other-chat-user", "password": "p"},
    )
    other_token = other_login.json()["access_token"]

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.return_value = ChatResponse(content="answer", references=None, provider_session_id=None)
        mock_get.return_value = mock_provider

        first = await client.post(
            "/api/chat/send",
            json={"integration_id": first_id, "message": "owner question", "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert first.status_code == 200
        session_id = first.json()["session_id"]

        mock_provider.send_message.reset_mock()
        rejected = await client.post(
            f"/api/chat/sessions/{session_id}/send",
            json={"integration_id": first_id, "message": "intruder question", "stream": False},
            headers={"Authorization": f"Bearer {other_token}"},
        )

    assert rejected.status_code == 404
    assert rejected.json()["detail"] == "Session not found"
    mock_provider.send_message.assert_not_called()


@pytest.mark.asyncio
async def test_global_session_send_rejects_inaccessible_current_target(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration, UserIntegrationAccess
    from app.constants import ROLE_USER

    uid = str(uuid.uuid4())
    first_id = str(uuid.uuid4())
    second_id = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="global-limited-user", password_hash=hash_password("p"), role=ROLE_USER)
        first = Integration(
            id=first_id,
            name="Allowed Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=uid,
        )
        second = Integration(
            id=second_id,
            name="Denied Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=uid,
        )
        access = UserIntegrationAccess(
            id=str(uuid.uuid4()),
            user_id=uid,
            integration_id=first_id,
            granted_by=uid,
        )
        db.add_all([user, first, second, access])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "global-limited-user", "password": "p"})
    token = login.json()["access_token"]

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.return_value = ChatResponse(content="answer", references=None, provider_session_id=None)
        mock_get.return_value = mock_provider

        first = await client.post(
            "/api/chat/send",
            json={"integration_id": first_id, "message": "allowed", "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert first.status_code == 200
        session_id = first.json()["session_id"]

        mock_provider.send_message.reset_mock()
        denied = await client.post(
            f"/api/chat/sessions/{session_id}/send",
            json={"integration_id": second_id, "message": "denied", "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert denied.status_code == 403
    assert denied.json()["detail"] == "No access to this integration"
    mock_provider.send_message.assert_not_called()


@pytest.mark.asyncio
async def test_global_session_detail_allows_historical_view_after_access_removed(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration, UserIntegrationAccess
    from app.constants import ROLE_USER
    from sqlalchemy import delete

    uid = str(uuid.uuid4())
    iid = str(uuid.uuid4())
    access_id = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="historical-user", password_hash=hash_password("p"), role=ROLE_USER)
        integration = Integration(
            id=iid,
            name="Historical Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=uid,
        )
        access = UserIntegrationAccess(id=access_id, user_id=uid, integration_id=iid, granted_by=uid)
        db.add_all([user, integration, access])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "historical-user", "password": "p"})
    token = login.json()["access_token"]

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.return_value = ChatResponse(content="answer", references=None, provider_session_id=None)
        mock_get.return_value = mock_provider
        created = await client.post("/api/chat/send", json={"integration_id": iid, "message": "q"}, headers={"Authorization": f"Bearer {token}"})
        session_id = created.json()["session_id"]

    async with TestingSessionLocal() as db:
        await db.execute(delete(UserIntegrationAccess).where(UserIntegrationAccess.id == access_id))
        await db.commit()

    detail = await client.get(f"/api/chat/sessions/{session_id}", headers={"Authorization": f"Bearer {token}"})
    denied_send = await client.post(
        f"/api/chat/sessions/{session_id}/send",
        json={"integration_id": iid, "message": "q2"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert detail.status_code == 200
    assert denied_send.status_code == 403


@pytest.mark.asyncio
async def test_global_session_list_returns_all_user_sessions(client):
    token, first_id, second_id = await setup_user_with_two_integrations(client)

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = AsyncMock()
        mock_provider.send_message.return_value = ChatResponse(content="answer", references=None, provider_session_id=None)
        mock_get.return_value = mock_provider

        await client.post("/api/chat/send", json={"integration_id": first_id, "message": "first"}, headers={"Authorization": f"Bearer {token}"})
        await client.post("/api/chat/send", json={"integration_id": second_id, "message": "second"}, headers={"Authorization": f"Bearer {token}"})

    response = await client.get("/api/chat/sessions", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    sessions = response.json()
    assert len(sessions) == 2
    assert {s["last_integration_name"] for s in sessions} == {"First Chat", "Second Chat"}
