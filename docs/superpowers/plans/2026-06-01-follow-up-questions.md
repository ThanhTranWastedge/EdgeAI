# Follow-Up Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let EdgeAI users continue a chat session for up to 20 total user questions while preserving request-scoped pins and provider-agnostic transcript history.

**Architecture:** Keep `POST /api/chat/{integration_id}/send` as the single send endpoint and add optional `session_id` to append to an existing session. The backend will load prior local messages, pass them to providers as structured history, append new messages with sequence numbers, and enforce the 20-question cap. The frontend will track an active session id, stop clearing messages on send, expose New Chat, and show a `x/20` counter.

**Tech Stack:** FastAPI, async SQLAlchemy, SQLite, pytest/httpx ASGI tests, React 19, TypeScript, Vite, Tailwind CSS, Zustand, SSE via raw `fetch()`.

---

## File Structure

- Modify `backend/app/chat/schemas.py`: add `session_id` to `SendMessageRequest`.
- Modify `backend/app/chat/providers/base.py`: add `ChatHistoryMessage` dataclass and `history` parameters.
- Modify `backend/app/chat/providers/openai_compat.py`: add history to OpenAI chat-completion messages.
- Modify `backend/app/chat/providers/ragflow.py`: add transcript text to RAGFlow question construction.
- Modify `backend/app/chat/router.py`: centralize integration access, session loading, user-turn counting, sequence allocation, history loading, new-session versus append behavior, and streaming `session_id` metadata.
- Modify `backend/tests/test_providers.py`: verify OpenAI-compatible provider history formatting.
- Modify `backend/tests/test_ragflow_provider.py`: verify RAGFlow transcript formatting.
- Modify `backend/tests/test_chat.py`: verify append behavior, validation, cap, and persistence semantics.
- Modify `frontend/src/api/chat.ts`: include optional `sessionId` in send APIs and parse EdgeAI `session_id` from streaming completion metadata.
- Modify `frontend/src/store/chatStore.ts`: track `activeSessionId` and expose actions for loading sessions and starting a new chat.
- Modify `frontend/src/components/SessionHistory.tsx`: set active session id when loading a session.
- Modify `frontend/src/components/ChatWindow.tsx`: append follow-up messages, send active `session_id`, add New Chat, show counter, and disable send at `20/20`.
- Modify `docs/developer-guide.md`: replace single-turn session documentation with bounded multi-turn behavior.
- Modify `docs/user-guide.md`: document follow-ups, New Chat, pins during follow-ups, and the cap.

## Task 1: Provider Contract And OpenAI-Compatible History

**Files:**
- Modify: `backend/app/chat/providers/base.py`
- Modify: `backend/app/chat/providers/openai_compat.py`
- Modify: `backend/tests/test_providers.py`

- [ ] **Step 1: Add failing OpenAI history test**

Add this test to `backend/tests/test_providers.py` after `test_openai_compat_send_message`:

```python
@pytest.mark.asyncio
async def test_openai_compat_includes_history_between_context_and_latest_message():
    config = {
        "base_url": "https://api.example.com/v1",
        "api_key": "sk-test",
        "model": "gpt-4",
        "system_prompt": "You are helpful.",
        "parameters": {"temperature": 0.7},
    }
    provider = OpenAICompatProvider(config)

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "Follow-up answer"}}]
    }
    mock_response.raise_for_status = MagicMock()

    captured_payload = None

    async def fake_post(*args, **kwargs):
        nonlocal captured_payload
        captured_payload = kwargs["json"]
        return mock_response

    history = [
        {"role": "user", "content": "Initial question"},
        {"role": "assistant", "content": "Initial answer"},
    ]

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=fake_post):
        result = await provider.send_message(
            "Follow-up question",
            context=["Pinned context"],
            history=history,
        )

    assert result.content == "Follow-up answer"
    assert captured_payload["messages"] == [
        {"role": "system", "content": "You are helpful."},
        {"role": "system", "content": "[Injected context]: Pinned context"},
        {"role": "user", "content": "Initial question"},
        {"role": "assistant", "content": "Initial answer"},
        {"role": "user", "content": "Follow-up question"},
    ]
```

- [ ] **Step 2: Run provider test and verify it fails**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_providers.py::test_openai_compat_includes_history_between_context_and_latest_message -v
```

Expected: FAIL with `TypeError` because `send_message()` does not accept `history`.

- [ ] **Step 3: Add history contract**

Update `backend/app/chat/providers/base.py` to:

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncGenerator, TypedDict, Literal


class ChatHistoryMessage(TypedDict):
    role: Literal["user", "assistant"]
    content: str


@dataclass
class ChatResponse:
    content: str
    references: list[dict] | None = None
    provider_session_id: str | None = None


@dataclass
class StreamChunk:
    content: str
    done: bool = False
    references: list[dict] | None = None
    provider_session_id: str | None = None


class ChatProvider(ABC):
    @abstractmethod
    async def send_message(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> ChatResponse:
        ...

    @abstractmethod
    async def stream_message(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        ...
```

- [ ] **Step 4: Add OpenAI-compatible history handling**

In `backend/app/chat/providers/openai_compat.py`, import `ChatHistoryMessage` and replace `_build_messages`, `send_message`, and `stream_message` signatures with:

```python
from app.chat.providers.base import ChatProvider, ChatResponse, StreamChunk, ChatHistoryMessage


    def _build_messages(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> list[dict]:
        messages = []
        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})
        if context:
            for ctx in context:
                messages.append({"role": "system", "content": f"[Injected context]: {ctx}"})
        if history:
            for item in history:
                messages.append({"role": item["role"], "content": item["content"]})
        messages.append({"role": "user", "content": message})
        return messages

    async def send_message(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> ChatResponse:
        messages = self._build_messages(message, context, history)
        payload = {"model": self.model, "messages": messages, "stream": False, **self.parameters}

        async with httpx.AsyncClient(headers=self._headers, timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return ChatResponse(content=content)

    async def stream_message(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        messages = self._build_messages(message, context, history)
        payload = {"model": self.model, "messages": messages, "stream": True, **self.parameters}
```

Keep the existing streaming response loop unchanged below the new `payload` line.

- [ ] **Step 5: Run provider tests**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_providers.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add backend/app/chat/providers/base.py backend/app/chat/providers/openai_compat.py backend/tests/test_providers.py
git commit -m "feat: pass chat history to OpenAI-compatible providers"
```

## Task 2: RAGFlow Transcript Formatting

**Files:**
- Modify: `backend/app/chat/providers/ragflow.py`
- Modify: `backend/tests/test_ragflow_provider.py`

- [ ] **Step 1: Add failing RAGFlow history test**

Add this test to `backend/tests/test_ragflow_provider.py` after `test_ragflow_send_with_context_prepends`:

```python
@pytest.mark.asyncio
async def test_ragflow_send_with_history_builds_transcript_before_latest_question():
    config = {
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
    }
    provider = RagflowProvider(config)

    mock_session = MagicMock()
    mock_session.id = "s1"
    mock_message = MagicMock()
    mock_message.content = "answer"
    mock_message.reference = []

    captured_question = None

    def fake_ask(question, stream=False):
        nonlocal captured_question
        captured_question = question
        return iter([mock_message])

    mock_session.ask = fake_ask
    mock_chat = MagicMock()
    mock_chat.create_session.return_value = mock_session
    mock_rag = MagicMock()
    mock_rag.list_chats.return_value = [mock_chat]

    history = [
        {"role": "user", "content": "What is the policy?"},
        {"role": "assistant", "content": "The policy is A."},
    ]

    with patch("app.chat.providers.ragflow.RAGFlow", return_value=mock_rag):
        await provider.send_message(
            "Can you expand on that?",
            context=["Pinned context"],
            history=history,
        )

    assert captured_question.index("[Injected context]: Pinned context") < captured_question.index("[Conversation so far]")
    assert "User: What is the policy?" in captured_question
    assert "Assistant: The policy is A." in captured_question
    assert captured_question.endswith("User question: Can you expand on that?")
```

- [ ] **Step 2: Run RAGFlow test and verify it fails**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_ragflow_provider.py::test_ragflow_send_with_history_builds_transcript_before_latest_question -v
```

Expected: FAIL with `TypeError` because `send_message()` does not accept `history`.

- [ ] **Step 3: Add RAGFlow history handling**

Update the import and replace `_build_question`, `_sync_send`, `send_message`, and `stream_message` signatures in `backend/app/chat/providers/ragflow.py`:

```python
from app.chat.providers.base import ChatProvider, ChatResponse, StreamChunk, ChatHistoryMessage


    def _build_question(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> str:
        parts = []
        if context:
            parts.extend(f"[Injected context]: {c}" for c in context)
        if history:
            transcript = ["[Conversation so far]"]
            for item in history:
                label = "User" if item["role"] == "user" else "Assistant"
                transcript.append(f"{label}: {item['content']}")
            parts.append("\n".join(transcript))
        parts.append(f"User question: {message}")
        return "\n\n".join(parts)

    def _sync_send(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> ChatResponse:
        rag = RAGFlow(api_key=self.api_key, base_url=self.base_url)
        entity = self._get_entity(rag)
        session = entity.create_session()
        question = self._build_question(message, context, history)
```

Use these method signatures and call sites:

```python
    async def send_message(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> ChatResponse:
        return await asyncio.to_thread(self._sync_send, message, context, history)

    async def stream_message(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        rag = RAGFlow(api_key=self.api_key, base_url=self.base_url)
        entity = self._get_entity(rag)
        session = entity.create_session()
        question = self._build_question(message, context, history)
```

Keep the rest of `_sync_send` and the streaming loop unchanged.

- [ ] **Step 4: Run RAGFlow tests**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_ragflow_provider.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add backend/app/chat/providers/ragflow.py backend/tests/test_ragflow_provider.py
git commit -m "feat: include transcript history for RAGFlow"
```

## Task 3: Backend Non-Streaming Session Append

**Files:**
- Modify: `backend/app/chat/schemas.py`
- Modify: `backend/app/chat/router.py`
- Modify: `backend/tests/test_chat.py`

- [ ] **Step 1: Add failing append test**

Add this test to `backend/tests/test_chat.py` after `test_send_message`:

```python
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
```

- [ ] **Step 2: Run append test and verify it fails**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_chat.py::test_send_message_appends_to_existing_session_with_history -v
```

Expected: FAIL because `session_id` is ignored and a new session is created.

- [ ] **Step 3: Add request schema field**

Update `backend/app/chat/schemas.py`:

```python
class SendMessageRequest(BaseModel):
    message: str
    pinned_ids: list[str] | None = None
    stream: bool = False
    session_id: str | None = None
```

- [ ] **Step 4: Add backend helper functions**

In `backend/app/chat/router.py`, add these imports:

```python
from sqlalchemy import func
from app.chat.providers.base import ChatHistoryMessage
```

Add these constants and helpers below `_serialize_refs`:

```python
MAX_USER_QUESTIONS_PER_SESSION = 20
ASSISTANT_STREAM_ERROR_MESSAGE = "Assistant response failed during streaming. Please start a new chat or try another question."


async def _ensure_integration_access(db: AsyncSession, user: User, integration_id: str) -> None:
    if user.role != ROLE_USER:
        return
    access = await db.execute(
        select(UserIntegrationAccess.id).where(
            UserIntegrationAccess.user_id == user.id,
            UserIntegrationAccess.integration_id == integration_id,
        )
    )
    if not access.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="No access to this integration")


async def _get_owned_session(
    db: AsyncSession,
    user: User,
    integration_id: str,
    session_id: str,
) -> Session:
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.user_id == user.id,
            Session.integration_id == integration_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


async def _count_user_messages(db: AsyncSession, session_id: str) -> int:
    result = await db.execute(
        select(func.count()).select_from(Message).where(
            Message.session_id == session_id,
            Message.role == "user",
        )
    )
    return int(result.scalar_one())


async def _get_next_sequence(db: AsyncSession, session_id: str) -> int:
    result = await db.execute(
        select(func.max(Message.sequence)).where(Message.session_id == session_id)
    )
    max_sequence = result.scalar_one_or_none()
    return int(max_sequence or 0) + 1


async def _get_history(db: AsyncSession, session_id: str) -> list[ChatHistoryMessage]:
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.sequence)
    )
    messages = result.scalars().all()
    return [
        {"role": m.role, "content": m.content}
        for m in messages
        if m.role in {"user", "assistant"}
    ]


async def _prepare_session_for_send(
    db: AsyncSession,
    user: User,
    integration_id: str,
    body: SendMessageRequest,
) -> tuple[Session | None, list[ChatHistoryMessage], int | None]:
    if not body.session_id:
        return None, [], None

    session = await _get_owned_session(db, user, integration_id, body.session_id)
    user_message_count = await _count_user_messages(db, session.id)
    if user_message_count >= MAX_USER_QUESTIONS_PER_SESSION:
        raise HTTPException(status_code=400, detail="Session question limit reached")
    history = await _get_history(db, session.id)
    next_sequence = await _get_next_sequence(db, session.id)
    return session, history, next_sequence
```

- [ ] **Step 5: Update non-streaming send logic**

In `send_message`, replace the duplicated user-role access block with:

```python
    await _ensure_integration_access(db, user, integration_id)
```

After pinned context is loaded, add:

```python
    existing_session, history, next_sequence = await _prepare_session_for_send(
        db, user, integration_id, body
    )
```

Replace the non-streaming provider call and persistence block with:

```python
    provider = get_provider(integration)
    try:
        response = await provider.send_message(body.message, context=context, history=history)
    except Exception as e:
        logger.error(f"Provider error: {e}")
        raise HTTPException(status_code=502, detail="Chat provider is unavailable")

    if existing_session:
        session = existing_session
        user_sequence = next_sequence or 1
    else:
        title = body.message[:80] + ("..." if len(body.message) > 80 else "")
        session = Session(
            user_id=user.id,
            integration_id=integration_id,
            title=title,
            ragflow_session_id=response.provider_session_id,
        )
        db.add(session)
        await db.flush()
        user_sequence = 1

    user_msg = Message(
        session_id=session.id,
        role="user",
        content=body.message,
        sequence=user_sequence,
    )
    assistant_msg = Message(
        session_id=session.id,
        role="assistant",
        content=response.content,
        references=_serialize_refs(response.references),
        sequence=user_sequence + 1,
    )
    if response.provider_session_id:
        session.ragflow_session_id = response.provider_session_id
    db.add_all([user_msg, assistant_msg])
    await db.commit()
    await db.refresh(assistant_msg)
```

- [ ] **Step 6: Run focused append test**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_chat.py::test_send_message_appends_to_existing_session_with_history -v
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add backend/app/chat/schemas.py backend/app/chat/router.py backend/tests/test_chat.py
git commit -m "feat: append non-streaming chat messages to sessions"
```

## Task 4: Backend Validation And Cap Tests

**Files:**
- Modify: `backend/tests/test_chat.py`
- Modify: `backend/app/chat/router.py`

- [ ] **Step 1: Add validation tests**

Add these tests to `backend/tests/test_chat.py`:

```python
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

    response = await client.post(
        f"/api/chat/{other_iid}/send",
        json={"message": "Bad append", "session_id": first.json()["session_id"], "stream": False},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Session not found"


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
        session_id = first.json()["session_id"]

        for index in range(2, 21):
            ok = await client.post(
                f"/api/chat/{iid}/send",
                json={"message": f"q{index}", "session_id": session_id, "stream": False},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert ok.status_code == 200

        capped = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "q21", "session_id": session_id, "stream": False},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert capped.status_code == 400
    assert capped.json()["detail"] == "Session question limit reached"
```

- [ ] **Step 2: Run validation tests**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_chat.py::test_append_rejects_session_from_another_integration tests/test_chat.py::test_append_enforces_twenty_user_question_cap -v
```

Expected: PASS.

- [ ] **Step 3: Add ownership test**

Add this test to `backend/tests/test_chat.py`:

```python
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

        rejected = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "intruder question", "session_id": first.json()["session_id"], "stream": False},
            headers={"Authorization": f"Bearer {other_token}"},
        )

    assert rejected.status_code == 404
    assert rejected.json()["detail"] == "Session not found"
```

- [ ] **Step 4: Add current access validation test**

Add this test to `backend/tests/test_chat.py`:

```python
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

    denied = await client.post(
        f"/api/chat/{iid}/send",
        json={"message": "second", "session_id": session_id, "stream": False},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert denied.status_code == 403
    assert denied.json()["detail"] == "No access to this integration"
```

- [ ] **Step 5: Run full chat tests**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_chat.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add backend/app/chat/router.py backend/tests/test_chat.py
git commit -m "test: cover chat session append validation"
```

## Task 5: Backend Streaming Append

**Files:**
- Modify: `backend/app/chat/router.py`
- Modify: `backend/tests/test_chat.py`

- [ ] **Step 1: Add streaming append test**

Add this test to `backend/tests/test_chat.py`:

```python
@pytest.mark.asyncio
async def test_streaming_send_appends_and_returns_session_id(client):
    token, iid = await setup_user_and_integration(client)
    stream_histories = []

    async def fake_stream(message, context=None, history=None):
        stream_histories.append(history)
        yield type("Chunk", (), {"content": "streamed ", "done": False})()
        yield type("Chunk", (), {"content": "answer", "done": False})()
        yield type("Chunk", (), {"content": "", "done": True, "references": None, "provider_session_id": None})()

    with patch("app.chat.router.get_provider") as mock_get:
        mock_provider = MagicMock()
        mock_provider.stream_message = fake_stream
        mock_get.return_value = mock_provider

        first = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "stream q1", "stream": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        first_body = first.text
        session_id = first_body.split('"session_id": "')[1].split('"')[0]

        second = await client.post(
            f"/api/chat/{iid}/send",
            json={"message": "stream q2", "session_id": session_id, "stream": True},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert second.status_code == 200
    assert f'"session_id": "{session_id}"' in second.text
    assert stream_histories[1] == [
        {"role": "user", "content": "stream q1"},
        {"role": "assistant", "content": "streamed answer"},
    ]
```

- [ ] **Step 2: Run streaming test and verify it fails**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_chat.py::test_streaming_send_appends_and_returns_session_id -v
```

Expected: FAIL because `_stream_response` does not accept `history`, sequence, or EdgeAI `session_id` metadata.

- [ ] **Step 3: Update streaming send setup**

In `send_message`, replace the current streaming block with:

```python
    if body.stream:
        if existing_session:
            session = existing_session
            user_sequence = next_sequence or 1
        else:
            title = body.message[:80] + ("..." if len(body.message) > 80 else "")
            session = Session(user_id=user.id, integration_id=integration_id, title=title)
            db.add(session)
            await db.flush()
            user_sequence = 1

        user_msg = Message(
            session_id=session.id,
            role="user",
            content=body.message,
            sequence=user_sequence,
        )
        db.add(user_msg)
        await db.commit()
        return await _stream_response(
            integration,
            session.id,
            body.message,
            context,
            history,
            user_sequence + 1,
        )
```

- [ ] **Step 4: Update `_stream_response` signature and provider call**

Replace `_stream_response` signature and provider stream call in `backend/app/chat/router.py`:

```python
async def _stream_response(
    integration,
    session_id,
    message,
    context,
    history,
    assistant_sequence,
):
    """Return SSE streaming response. Saves full message to DB after stream completes."""
    from sse_starlette.sse import EventSourceResponse

    provider = get_provider(integration)
```

Inside `event_generator`, call:

```python
            async for chunk in provider.stream_message(message, context=context, history=history):
```

- [ ] **Step 5: Add streaming session metadata and assistant sequence**

In the `done` event payload, include `session_id`:

```python
                    yield {"event": "done", "data": json.dumps({
                        "references": references,
                        "provider_session_id": provider_session_id,
                        "session_id": session_id,
                    })}
```

When saving the assistant message, set:

```python
                sequence=assistant_sequence,
```

- [ ] **Step 6: Persist assistant error message on stream failure**

Replace the `except` block in `event_generator` with:

```python
        except Exception as e:
            logger.error(f"Stream error after {chunk_count} chunks ({len(full_content)} chars): {e}")
            from app.database import async_session
            async with async_session() as save_db:
                assistant_msg = Message(
                    session_id=session_id,
                    role="assistant",
                    content=ASSISTANT_STREAM_ERROR_MESSAGE,
                    references=None,
                    sequence=assistant_sequence,
                )
                save_db.add(assistant_msg)
                await save_db.commit()
            yield {"event": "error", "data": json.dumps({"detail": "Provider error during streaming"})}
            return
```

- [ ] **Step 7: Run streaming test**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_chat.py::test_streaming_send_appends_and_returns_session_id -v
```

Expected: PASS.

- [ ] **Step 8: Run backend test suite**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/ -v
```

Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```bash
git add backend/app/chat/router.py backend/tests/test_chat.py
git commit -m "feat: append streaming chat messages to sessions"
```

## Task 6: Frontend API And Store State

**Files:**
- Modify: `frontend/src/api/chat.ts`
- Modify: `frontend/src/store/chatStore.ts`

- [ ] **Step 1: Update chat API types and requests**

In `frontend/src/api/chat.ts`, change `sendMessageApi` to:

```ts
export const sendMessageApi = (
  integrationId: string,
  message: string,
  pinnedIds?: string[],
  sessionId?: string | null,
) =>
  client.post<SendResponse>(`/chat/${integrationId}/send`, {
    message,
    pinned_ids: pinnedIds,
    stream: false,
    session_id: sessionId || undefined,
  })
```

Change `sendMessageStreamApi` signature to:

```ts
export const sendMessageStreamApi = async (
  integrationId: string,
  message: string,
  pinnedIds: string[] | undefined,
  sessionId: string | null | undefined,
  onChunk: (text: string) => void,
  onDone: (refs: unknown, sessionId: string | null) => void,
  onError: (error: string) => void,
) => {
```

Update the request body:

```ts
    body: JSON.stringify({
      message,
      pinned_ids: pinnedIds,
      stream: true,
      session_id: sessionId || undefined,
    }),
```

Update done handling:

```ts
        if (currentEvent === 'done') {
          onDone(meta.references, meta.session_id || null)
        }
```

- [ ] **Step 2: Update chat store**

Replace `frontend/src/store/chatStore.ts` with:

```ts
import { create } from 'zustand'
import { Integration } from '../api/integrations'
import { MessageData, SessionData } from '../api/chat'

interface ChatState {
  activeIntegration: Integration | null
  activeSessionId: string | null
  sessions: SessionData[]
  currentMessages: MessageData[]
  isStreaming: boolean
  setActiveIntegration: (integration: Integration) => void
  setActiveSessionId: (sessionId: string | null) => void
  setSessions: (sessions: SessionData[]) => void
  setCurrentMessages: (messages: MessageData[], sessionId?: string | null) => void
  addMessage: (message: MessageData) => void
  updateLastMessage: (updater: (prevContent: string) => string) => void
  setStreaming: (streaming: boolean) => void
  clearMessages: () => void
  startNewChat: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeIntegration: null,
  activeSessionId: null,
  sessions: [],
  currentMessages: [],
  isStreaming: false,

  setActiveIntegration: (integration) => set({
    activeIntegration: integration,
    activeSessionId: null,
    currentMessages: [],
  }),
  setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentMessages: (messages, sessionId = null) => set({
    currentMessages: messages,
    activeSessionId: sessionId,
  }),
  addMessage: (message) => set((state) => ({ currentMessages: [...state.currentMessages, message] })),
  updateLastMessage: (updater) => set((state) => {
    const msgs = [...state.currentMessages]
    if (msgs.length > 0) {
      const last = { ...msgs[msgs.length - 1] }
      last.content = updater(last.content)
      msgs[msgs.length - 1] = last
    }
    return { currentMessages: msgs }
  }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  clearMessages: () => set({ currentMessages: [], activeSessionId: null }),
  startNewChat: () => set({ currentMessages: [], activeSessionId: null }),
}))
```

- [ ] **Step 3: Run frontend build check**

Run:

```bash
cd frontend
npm run build
```

Expected: FAIL because callers still use the old API/store signatures.

- [ ] **Step 4: Commit Task 6 after later callers are fixed**

Do not commit this task until Task 7 fixes the caller TypeScript errors.

## Task 7: Frontend Session Continuation UX

**Files:**
- Modify: `frontend/src/components/SessionHistory.tsx`
- Modify: `frontend/src/components/ChatWindow.tsx`
- Modify: `frontend/src/api/chat.ts`
- Modify: `frontend/src/store/chatStore.ts`

- [ ] **Step 1: Set active session on history click**

In `frontend/src/components/SessionHistory.tsx`, update the store destructure and `viewSession`:

```tsx
  const { activeIntegration, sessions, setSessions, setCurrentMessages } = useChatStore()
```

Keep the destructure name, but update the setter call:

```tsx
    setCurrentMessages(data.messages, data.id)
```

- [ ] **Step 2: Update ChatWindow state destructure**

In `frontend/src/components/ChatWindow.tsx`, replace the store destructure with:

```tsx
  const {
    activeIntegration,
    activeSessionId,
    currentMessages,
    addMessage,
    startNewChat,
    setActiveSessionId,
    setSessions,
    isStreaming,
    setStreaming,
    updateLastMessage,
  } = useChatStore()
```

- [ ] **Step 3: Add counter and cap state**

Add these constants after refs/state:

```tsx
  const userQuestionCount = currentMessages.filter((m) => m.role === 'user').length
  const questionLimitReached = userQuestionCount >= 20
```

- [ ] **Step 4: Update send guard and remove message clearing**

Change the start of `handleSend`:

```tsx
  const handleSend = async () => {
    if (!input.trim() || isStreaming || questionLimitReached) return
    setError('')
```

Remove the existing `clearMessages()` call.

- [ ] **Step 5: Use append sequences and active session id**

Replace temporary message creation with:

```tsx
    const nextSequence = currentMessages.reduce((max, message) => Math.max(max, message.sequence), 0) + 1
    const userMsg = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: input,
      references: null,
      pinned: false,
      sequence: nextSequence,
    }
    addMessage(userMsg)

    const assistantMsg = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      references: null,
      pinned: false,
      sequence: nextSequence + 1,
    }
    addMessage(assistantMsg)
```

- [ ] **Step 6: Send active session id and store returned session id**

Update the `sendMessageStreamApi` call arguments:

```tsx
        activeIntegration.id,
        message,
        pinnedIds.length > 0 ? pinnedIds : undefined,
        activeSessionId,
```

Update the `onDone` callback:

```tsx
        async (_refs, returnedSessionId) => {
          if (returnedSessionId) {
            setActiveSessionId(returnedSessionId)
          }
          clearSelectedPins()
          const sessionsRes = await getSessionsApi(activeIntegration.id)
          setSessions(sessionsRes.data)
        },
```

- [ ] **Step 7: Add New Chat action**

Add this function before `handleSend`:

```tsx
  const handleNewChat = () => {
    startNewChat()
    clearSelectedPins()
    setError('')
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }
```

- [ ] **Step 8: Add header controls and counter**

Inside the messages container, above `<PinnedBanner ... />`, add:

```tsx
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-xs text-we-muted">
            {userQuestionCount}/20
          </div>
          <button
            onClick={handleNewChat}
            className="text-xs font-medium text-amcs-primary hover:text-amcs-primary/80 transition-colors"
          >
            New Chat
          </button>
        </div>
```

- [ ] **Step 9: Show cap message and disable input**

Before the input bar, add:

```tsx
      {questionLimitReached && (
        <div className="px-6 pb-2 max-md:px-3 text-xs text-amcs-negative">
          20-question limit reached. Start a new chat to continue.
        </div>
      )}
```

Update the `textarea`:

```tsx
            disabled={questionLimitReached}
            placeholder={
              questionLimitReached
                ? 'Start a new chat to continue...'
                : `Ask ${activeIntegration.name} something...`
            }
```

Update the send button:

```tsx
            disabled={isStreaming || questionLimitReached}
```

- [ ] **Step 10: Run frontend lint and build**

Run:

```bash
cd frontend
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 11: Commit Tasks 6 and 7**

```bash
git add frontend/src/api/chat.ts frontend/src/store/chatStore.ts frontend/src/components/SessionHistory.tsx frontend/src/components/ChatWindow.tsx
git commit -m "feat: continue chat sessions in frontend"
```

## Task 8: Documentation Updates

**Files:**
- Modify: `docs/developer-guide.md`
- Modify: `docs/user-guide.md`

- [ ] **Step 1: Update developer guide session section**

In `docs/developer-guide.md`, replace the `### Single-Turn Sessions` section with:

```markdown
### Bounded Multi-Turn Sessions

Each chat session can contain up to 20 total user questions. The first request creates a `Session`; follow-up requests include `session_id` and append new `Message` rows to that same session.

The backend uses local EdgeAI messages as the source of truth for follow-up context. Before each provider call, prior `user` and `assistant` messages are loaded in sequence order and passed to the provider as `history`. Selected pinned responses are still passed separately as request-scoped `context`.

For non-streaming requests, the provider is called before new messages are persisted. If the provider fails, no new rows are created. For streaming requests, the user message is persisted before the SSE response starts, and the assistant message is persisted when streaming completes. If streaming fails after the user message is saved, an assistant error message is persisted so the transcript remains coherent.
```

- [ ] **Step 2: Update developer guide API body**

In the Chat API reference row for `/api/chat/{integration_id}/send`, change the body description to:

```markdown
Send message. Body: `{message, pinned_ids?, stream?, session_id?}`. Omit `session_id` to create a new session; include it to append to an existing session with fewer than 20 user questions.
```

- [ ] **Step 3: Update user guide chatting section**

In `docs/user-guide.md`, replace the paragraph that says each message creates a new session with:

```markdown
The first message starts a new session. You can ask follow-up questions in that same session until it reaches 20 total questions. The counter in the chat window shows your progress, such as `7/20`.
```

Add this paragraph after Viewing Past Sessions:

```markdown
Past sessions can be continued. Click a session in Recent Sessions to load it, then send another message. If the session has reached 20 questions, the input is disabled and you can use **New Chat** to start a fresh session with the same integration.
```

- [ ] **Step 4: Update pin wording**

In the Injecting Pins section, add:

```markdown
Selected pins apply only to the next message you send. After the message is sent, EdgeAI clears the selected pins. Follow-up questions use the session transcript as context, and you can attach pins again whenever a specific follow-up needs them.
```

- [ ] **Step 5: Commit docs**

```bash
git add docs/developer-guide.md docs/user-guide.md
git commit -m "docs: describe bounded follow-up chat sessions"
```

## Task 9: Final Verification

**Files:**
- Verify all changed files

- [ ] **Step 1: Run full backend tests**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/ -v
```

Expected: PASS.

- [ ] **Step 2: Run frontend checks**

Run:

```bash
cd frontend
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: only intentional tracked changes are committed. The pre-existing untracked file `docs/superpowers/plans/2026-06-01-brainstorm-follow-up-questions.md` may still appear and should not be modified unless the user asks.

- [ ] **Step 4: Manual smoke test**

Start backend:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test ADMIN_PASSWORD=admin uvicorn app.main:app --reload --port 8000
```

Start frontend in a second terminal:

```bash
cd frontend
npm run dev
```

In the browser at `http://localhost:5173`, verify:

- sending the first message creates a session
- sending a follow-up appends below the first response
- Recent Sessions loads the same transcript and can continue it
- New Chat clears the transcript without deleting history
- selected pins can be attached to a follow-up and clear after send
- the counter increments to match user messages
- a 20-question session disables sending

- [ ] **Step 5: Final commit if verification changed tracked files**

If verification caused formatting changes in tracked files, commit them:

```bash
git add backend frontend docs
git commit -m "chore: finalize follow-up chat sessions"
```

If no tracked files changed, do not create an empty commit.
