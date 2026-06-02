# Chat Input Integration Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move chat selection into the chat input, support account-level default chats, and allow one conversation to send follow-ups to different integrations with full visible history.

**Architecture:** Add session-centered chat APIs while preserving existing integration-scoped routes. Store target integration snapshots on sessions and messages, keep EdgeAI's transcript as the source of truth, and update the frontend so the composer owns target selection.

**Tech Stack:** FastAPI, async SQLAlchemy, SQLite startup migrations, pytest/httpx ASGI tests, React 19, TypeScript, Vite, Zustand, Tailwind CSS, lucide-react.

---

## File Structure

Backend files:

- Modify `backend/app/models.py`: add user default integration, session target snapshots, message target snapshots.
- Create `backend/app/migrations.py`: idempotent SQLite column migration helpers.
- Modify `backend/app/database.py`: run startup migrations after `create_all`.
- Modify `backend/app/auth/schemas.py`: expose `default_integration_id` and request body for default updates.
- Modify `backend/app/auth/router.py`: add `PUT /api/auth/default-integration`.
- Modify `backend/app/integrations/router.py`: clear deleted integration defaults.
- Modify `backend/app/chat/schemas.py`: add target metadata fields and new send request schema.
- Modify `backend/app/chat/providers/base.py`: allow history items to carry preformatted source-labeled content.
- Modify `backend/app/chat/providers/openai_compat.py`: preserve structured messages and accept source-labeled history content.
- Modify `backend/app/chat/providers/ragflow.py`: replace SDK send path with OpenAI-compatible HTTP endpoints for chat and agent integrations.
- Modify `backend/app/chat/router.py`: add session-centered routes and shared send implementation.
- Add or modify tests in `backend/tests/test_auth_routes.py`, `backend/tests/test_integrations.py`, `backend/tests/test_chat.py`, `backend/tests/test_ragflow_provider.py`, and create `backend/tests/test_migrations.py`.

Frontend files:

- Modify `frontend/src/api/auth.ts`: add default integration field and update API.
- Modify `frontend/src/api/chat.ts`: add global session APIs and target metadata fields.
- Modify `frontend/src/api/integrations.ts`: keep current list API and types.
- Modify `frontend/src/store/authStore.ts`: update user default after saving.
- Modify `frontend/src/store/chatStore.ts`: store integrations, selected target, session state, and global sessions.
- Create `frontend/src/components/ChatSelector.tsx`: dropdown selector and default action.
- Modify `frontend/src/components/ChatWindow.tsx`: composer target selection, new APIs, global sessions refresh, mobile layout, new-chat behavior.
- Modify `frontend/src/components/SessionHistory.tsx`: global recent sessions on Chat page.
- Modify `frontend/src/components/Layout.tsx`: remove sidebar integration list and show recent sessions only on `/chat`.
- Modify `frontend/src/components/MessageBubble.tsx`: assistant source label.
- Delete or stop importing `frontend/src/components/IntegrationList.tsx`.
- Modify `frontend/src/pages/HelpPage.tsx`: user-facing workflow text.
- Modify `docs/developer-guide.md` and `docs/user-guide.md`.

---

### Task 1: Schema Columns And Startup Migration

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/app/migrations.py`
- Modify: `backend/app/database.py`
- Test: `backend/tests/test_migrations.py`

- [ ] **Step 1: Write migration tests**

Create `backend/tests/test_migrations.py`:

```python
import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_run_startup_migrations_adds_missing_columns():
    from tests.conftest import engine
    from app.database import Base
    from app.migrations import run_startup_migrations

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.execute(text("CREATE TABLE users (id VARCHAR PRIMARY KEY, username VARCHAR NOT NULL, password_hash VARCHAR NOT NULL, role VARCHAR NOT NULL)"))
        await conn.execute(text("CREATE TABLE sessions (id VARCHAR PRIMARY KEY, user_id VARCHAR NOT NULL, integration_id VARCHAR NOT NULL, title VARCHAR NOT NULL)"))
        await conn.execute(text("CREATE TABLE messages (id VARCHAR PRIMARY KEY, session_id VARCHAR NOT NULL, role VARCHAR NOT NULL, content TEXT NOT NULL, sequence INTEGER NOT NULL)"))
        await run_startup_migrations(conn)

        users = await conn.execute(text("PRAGMA table_info(users)"))
        sessions = await conn.execute(text("PRAGMA table_info(sessions)"))
        messages = await conn.execute(text("PRAGMA table_info(messages)"))

    assert "default_integration_id" in {row[1] for row in users}
    session_columns = {row[1] for row in sessions}
    assert {"integration_name", "last_integration_id", "last_integration_name"}.issubset(session_columns)
    message_columns = {row[1] for row in messages}
    assert {"integration_id", "integration_name"}.issubset(message_columns)


@pytest.mark.asyncio
async def test_run_startup_migrations_is_idempotent():
    from tests.conftest import engine
    from app.database import Base
    from app.migrations import run_startup_migrations

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await run_startup_migrations(conn)
        await run_startup_migrations(conn)

        users = await conn.execute(text("PRAGMA table_info(users)"))

    assert "default_integration_id" in {row[1] for row in users}
```

- [ ] **Step 2: Run migration tests and verify they fail**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_migrations.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.migrations'`.

- [ ] **Step 3: Add model columns**

Modify `backend/app/models.py`:

```python
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_uuid)
    username = Column(String, unique=True, nullable=False)
    fullname = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default=ROLE_USER)
    default_integration_id = Column(String, ForeignKey("integrations.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    last_login = Column(DateTime, nullable=True)
```

Add the session columns:

```python
class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=new_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    integration_id = Column(String, ForeignKey("integrations.id"), nullable=False)
    integration_name = Column(String, nullable=True)
    last_integration_id = Column(String, ForeignKey("integrations.id"), nullable=True)
    last_integration_name = Column(String, nullable=True)
    ragflow_session_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    messages = relationship("Message", back_populates="session", order_by="Message.sequence")
    integration = relationship("Integration", foreign_keys=[integration_id])
```

Add the message columns:

```python
class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=new_uuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    references = Column(Text, nullable=True)
    pinned = Column(Boolean, default=False)
    sequence = Column(Integer, nullable=False)
    integration_id = Column(String, ForeignKey("integrations.id"), nullable=True)
    integration_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    session = relationship("Session", back_populates="messages")
```

- [ ] **Step 4: Add idempotent migration helper**

Create `backend/app/migrations.py`:

```python
from sqlalchemy import text


async def _column_names(conn, table_name: str) -> set[str]:
    result = await conn.execute(text(f"PRAGMA table_info({table_name})"))
    return {row[1] for row in result}


async def _add_column_if_missing(conn, table_name: str, column_name: str, ddl: str) -> None:
    columns = await _column_names(conn, table_name)
    if column_name not in columns:
        await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}"))


async def run_startup_migrations(conn) -> None:
    await _add_column_if_missing(conn, "users", "default_integration_id", "VARCHAR")
    await _add_column_if_missing(conn, "sessions", "integration_name", "VARCHAR")
    await _add_column_if_missing(conn, "sessions", "last_integration_id", "VARCHAR")
    await _add_column_if_missing(conn, "sessions", "last_integration_name", "VARCHAR")
    await _add_column_if_missing(conn, "messages", "integration_id", "VARCHAR")
    await _add_column_if_missing(conn, "messages", "integration_name", "VARCHAR")
```

- [ ] **Step 5: Run startup migrations during init**

Modify `backend/app/database.py`:

```python
from app.migrations import run_startup_migrations
```

Then update `init_db()`:

```python
async def init_db():
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.execute(text("PRAGMA busy_timeout=5000"))
        await conn.run_sync(Base.metadata.create_all)
        await run_startup_migrations(conn)
```

- [ ] **Step 6: Run migration tests**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_migrations.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models.py backend/app/migrations.py backend/app/database.py backend/tests/test_migrations.py
git commit -m "feat: add chat target metadata migrations"
```

---

### Task 2: Account Default Chat Preference API

**Files:**
- Modify: `backend/app/auth/schemas.py`
- Modify: `backend/app/auth/router.py`
- Modify: `backend/app/integrations/router.py`
- Test: `backend/tests/test_auth_routes.py`
- Test: `backend/tests/test_integrations.py`

- [ ] **Step 1: Add failing auth tests**

Append to `backend/tests/test_auth_routes.py`:

```python
@pytest.mark.asyncio
async def test_me_includes_default_integration_id(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    import uuid

    default_id = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(
            id=str(uuid.uuid4()),
            username="default-me",
            password_hash=hash_password("p"),
            role="admin",
            default_integration_id=default_id,
        )
        db.add(user)
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "default-me", "password": "p"})
    token = login.json()["access_token"]

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["default_integration_id"] == default_id


@pytest.mark.asyncio
async def test_update_default_integration_requires_access_for_user_role(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration
    from app.constants import ROLE_USER
    import json
    import uuid

    uid = str(uuid.uuid4())
    iid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="default-limited", password_hash=hash_password("p"), role=ROLE_USER)
        integration = Integration(
            id=iid,
            name="No Access Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=uid,
        )
        db.add_all([user, integration])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "default-limited", "password": "p"})
    token = login.json()["access_token"]

    response = await client.put(
        "/api/auth/default-integration",
        json={"integration_id": iid},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "No access to this integration"


@pytest.mark.asyncio
async def test_update_default_integration_sets_and_clears_value(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration, UserIntegrationAccess
    from app.constants import ROLE_USER
    import json
    import uuid

    uid = str(uuid.uuid4())
    iid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="default-setter", password_hash=hash_password("p"), role=ROLE_USER)
        integration = Integration(
            id=iid,
            name="Granted Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=uid,
        )
        access = UserIntegrationAccess(user_id=uid, integration_id=iid, granted_by=uid)
        db.add_all([user, integration, access])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "default-setter", "password": "p"})
    token = login.json()["access_token"]

    set_response = await client.put(
        "/api/auth/default-integration",
        json={"integration_id": iid},
        headers={"Authorization": f"Bearer {token}"},
    )
    clear_response = await client.put(
        "/api/auth/default-integration",
        json={"integration_id": None},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert set_response.status_code == 200
    assert set_response.json()["default_integration_id"] == iid
    assert clear_response.status_code == 200
    assert clear_response.json()["default_integration_id"] is None
```

- [ ] **Step 2: Add failing integration deletion test**

Append to `backend/tests/test_integrations.py`:

```python
@pytest.mark.asyncio
async def test_delete_integration_clears_user_defaults(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration
    from app.auth.utils import hash_password
    from sqlalchemy import select
    import json
    import uuid

    admin_id = str(uuid.uuid4())
    integration_id = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        admin = User(id=admin_id, username="default-admin", password_hash=hash_password("admin"), role="admin")
        integration = Integration(
            id=integration_id,
            name="Defaulted Chat",
            provider_type="openai_compatible",
            provider_config=json.dumps({"base_url": "http://x", "api_key": "k", "model": "m"}),
            updated_by=admin_id,
        )
        user = User(
            id=str(uuid.uuid4()),
            username="default-owner",
            password_hash=hash_password("p"),
            role="user",
            default_integration_id=integration_id,
        )
        db.add_all([admin, integration, user])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "default-admin", "password": "admin"})
    token = login.json()["access_token"]

    response = await client.delete(
        f"/api/integrations/{integration_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 204
    async with TestingSessionLocal() as db:
        result = await db.execute(select(User.default_integration_id).where(User.username == "default-owner"))
        assert result.scalar_one() is None
```

- [ ] **Step 3: Run focused tests and verify failures**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_auth_routes.py tests/test_integrations.py -v
```

Expected: FAIL because schemas and endpoint are missing.

- [ ] **Step 4: Update auth schemas**

Modify `backend/app/auth/schemas.py`:

```python
class UserResponse(BaseModel):
    id: str
    username: str
    fullname: str | None = None
    role: str
    default_integration_id: str | None = None

    model_config = {"from_attributes": True}


class DefaultIntegrationRequest(BaseModel):
    integration_id: str | None = None
```

- [ ] **Step 5: Add default update endpoint**

Modify imports in `backend/app/auth/router.py`:

```python
from app.models import User, Integration, UserIntegrationAccess
from app.auth.schemas import LoginRequest, TokenResponse, RefreshRequest, UserResponse, ChangePasswordRequest, DefaultIntegrationRequest
from app.constants import ROLE_USER
```

Add this helper and route:

```python
async def _ensure_default_integration_access(db: AsyncSession, user: User, integration_id: str) -> None:
    result = await db.execute(select(Integration.id).where(Integration.id == integration_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Integration not found")

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


@router.put("/default-integration", response_model=UserResponse)
async def update_default_integration(
    body: DefaultIntegrationRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.integration_id is not None:
        await _ensure_default_integration_access(db, user, body.integration_id)

    user.default_integration_id = body.integration_id
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)
```

- [ ] **Step 6: Clear defaults on integration deletion**

Modify imports in `backend/app/integrations/router.py`:

```python
from sqlalchemy import select, delete, update
```

Before deleting the integration, add:

```python
    await db.execute(
        update(User)
        .where(User.default_integration_id == integration_id)
        .values(default_integration_id=None)
    )
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_auth_routes.py tests/test_integrations.py -v
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/auth/schemas.py backend/app/auth/router.py backend/app/integrations/router.py backend/tests/test_auth_routes.py backend/tests/test_integrations.py
git commit -m "feat: add default chat preference API"
```

---

### Task 3: Chat Schemas And Shared Session Routing Tests

**Files:**
- Modify: `backend/app/chat/schemas.py`
- Modify: `backend/app/chat/providers/base.py`
- Modify: `backend/app/chat/router.py`
- Test: `backend/tests/test_chat.py`

- [ ] **Step 1: Add failing tests for new global routes and mixed-target metadata**

Append to `backend/tests/test_chat.py`:

```python
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
```

- [ ] **Step 2: Run chat tests and verify failures**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_chat.py::test_new_send_routes_support_mixed_target_followups tests/test_chat.py::test_global_session_list_returns_all_user_sessions -v
```

Expected: FAIL because `/api/chat/send` and global session routes are missing.

- [ ] **Step 3: Update chat schemas**

Modify `backend/app/chat/schemas.py`:

```python
class SendMessageRequest(BaseModel):
    message: str
    pinned_ids: list[str] | None = None
    stream: bool = False
    session_id: str | None = None


class TargetedSendMessageRequest(BaseModel):
    integration_id: str
    message: str
    pinned_ids: list[str] | None = None
    stream: bool = False
```

Update responses:

```python
class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    references: str | None = None
    pinned: bool
    sequence: int
    integration_id: str | None = None
    integration_name: str | None = None

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    id: str
    integration_id: str
    integration_name: str | None = None
    last_integration_id: str | None = None
    last_integration_name: str | None = None
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionDetailResponse(BaseModel):
    id: str
    integration_id: str
    integration_name: str | None = None
    last_integration_id: str | None = None
    last_integration_name: str | None = None
    title: str
    messages: list[MessageResponse]
```

- [ ] **Step 4: Update history type**

Modify `backend/app/chat/providers/base.py`:

```python
class ChatHistoryMessage(TypedDict):
    role: Literal["user", "assistant"]
    content: str


@dataclass
class ChatResponse:
    content: str
    references: object | None = None
    provider_session_id: str | None = None


@dataclass
class StreamChunk:
    content: str
    done: bool = False
    references: object | None = None
    provider_session_id: str | None = None
```

The router preformats source labels into `content`, which keeps providers simple. Reference payloads become `object | None` because RAGFlow's OpenAI-compatible endpoint returns reference objects, while older paths may return lists.

- [ ] **Step 5: Add shared router helpers**

In `backend/app/chat/router.py`, change imports:

```python
from app.chat.schemas import (
    SendMessageRequest,
    TargetedSendMessageRequest,
    SendMessageResponse,
    SessionResponse,
    SessionDetailResponse,
    MessageResponse,
)
```

Replace `_get_owned_session` with ownership-only lookup:

```python
async def _get_owned_session(db: AsyncSession, user: User, session_id: str) -> Session:
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
```

Add target fetch and history formatting:

```python
async def _get_integration_for_send(db: AsyncSession, user: User, integration_id: str) -> Integration:
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    await _ensure_integration_access(db, user, integration_id)
    return integration


def _message_history_content(message: Message) -> str:
    if message.role == "assistant" and message.integration_name:
        return f"Assistant ({message.integration_name}): {message.content}"
    return message.content
```

Update `_get_history`:

```python
async def _get_history(db: AsyncSession, session_id: str) -> list[ChatHistoryMessage]:
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.sequence)
    )
    messages = result.scalars().all()
    return [
        {"role": m.role, "content": _message_history_content(m)}
        for m in messages
        if m.role in {"user", "assistant"}
    ]
```

- [ ] **Step 6: Refactor send implementation**

Add a shared function in `backend/app/chat/router.py`:

```python
async def _send_to_integration(
    integration_id: str,
    message: str,
    pinned_ids: list[str] | None,
    stream: bool,
    session_id: str | None,
    db: AsyncSession,
    user: User,
):
    integration = await _get_integration_for_send(db, user, integration_id)

    context = None
    if pinned_ids:
        pin_result = await db.execute(
            select(PinnedResponse).where(
                PinnedResponse.id.in_(pinned_ids),
                PinnedResponse.user_id == user.id,
            )
        )
        context = [p.content for p in pin_result.scalars().all()]

    append_lock = _get_session_append_lock(session_id) if session_id else None
    if append_lock:
        await append_lock.acquire()

    try:
        existing_session, history, next_sequence = await _prepare_session_for_send(db, user, session_id)
        if stream:
            response = await _send_streaming(
                db, user, integration, message, context, existing_session, history, next_sequence, append_lock
            )
            append_lock = None
            return response
        return await _send_non_streaming(
            db, user, integration, message, context, existing_session, history, next_sequence
        )
    finally:
        if append_lock:
            append_lock.release()
```

Then replace `_prepare_session_for_send` signature:

```python
async def _prepare_session_for_send(
    db: AsyncSession,
    user: User,
    session_id: str | None,
) -> tuple[Session | None, list[ChatHistoryMessage], int | None]:
    if not session_id:
        return None, [], None

    session = await _get_owned_session(db, user, session_id)
    user_message_count = await _count_user_messages(db, session.id)
    if user_message_count >= MAX_USER_QUESTIONS_PER_SESSION:
        raise HTTPException(status_code=400, detail="Session question limit reached")
    history = await _get_history(db, session.id)
    next_sequence = await _get_next_sequence(db, session.id)
    return session, history, next_sequence
```

- [ ] **Step 7: Add route wrappers**

Replace the existing route body with wrappers:

```python
@router.post("/send")
async def send_new_message(
    body: TargetedSendMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _send_to_integration(
        body.integration_id, body.message, body.pinned_ids, body.stream, None, db, user
    )


@router.post("/sessions/{session_id}/send")
async def send_session_message(
    session_id: str,
    body: TargetedSendMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _send_to_integration(
        body.integration_id, body.message, body.pinned_ids, body.stream, session_id, db, user
    )


@router.post("/{integration_id}/send")
async def send_message(
    integration_id: str,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _send_to_integration(
        integration_id, body.message, body.pinned_ids, body.stream, body.session_id, db, user
    )
```

- [ ] **Step 8: Implement non-stream metadata persistence**

Add helper functions:

```python
def _new_session(user: User, integration: Integration, message: str) -> Session:
    title = message[:80] + ("..." if len(message) > 80 else "")
    return Session(
        user_id=user.id,
        integration_id=integration.id,
        integration_name=integration.name,
        last_integration_id=integration.id,
        last_integration_name=integration.name,
        title=title,
    )


def _apply_last_target(session: Session, integration: Integration) -> None:
    session.last_integration_id = integration.id
    session.last_integration_name = integration.name
```

Use them in `_send_non_streaming`:

```python
async def _send_non_streaming(
    db: AsyncSession,
    user: User,
    integration: Integration,
    message: str,
    context,
    existing_session: Session | None,
    history,
    next_sequence: int | None,
):
    provider = get_provider(integration)
    try:
        response = await provider.send_message(message, context=context, history=history)
    except Exception as e:
        logger.error(f"Provider error: {e}")
        raise HTTPException(status_code=502, detail="Chat provider is unavailable")

    if existing_session:
        session = existing_session
        user_sequence = next_sequence or 1
    else:
        session = _new_session(user, integration, message)
        db.add(session)
        await db.flush()
        user_sequence = 1

    _apply_last_target(session, integration)
    user_msg = Message(
        session_id=session.id,
        role="user",
        content=message,
        sequence=user_sequence,
        integration_id=integration.id,
        integration_name=integration.name,
    )
    assistant_msg = Message(
        session_id=session.id,
        role="assistant",
        content=response.content,
        references=_serialize_refs(response.references),
        sequence=user_sequence + 1,
        integration_id=integration.id,
        integration_name=integration.name,
    )
    if response.provider_session_id:
        session.ragflow_session_id = response.provider_session_id
    db.add_all([user_msg, assistant_msg])
    await db.commit()
    await db.refresh(assistant_msg)

    return SendMessageResponse(
        session_id=session.id,
        assistant_message=MessageResponse.model_validate(assistant_msg),
    )
```

- [ ] **Step 9: Add global session routes**

Add:

```python
@router.get("/sessions", response_model=list[SessionResponse])
async def list_global_sessions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Session)
        .where(Session.user_id == user.id)
        .order_by(Session.created_at.desc())
        .limit(100)
    )
    return [SessionResponse.model_validate(s) for s in result.scalars().all()]


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_global_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = await _get_owned_session(db, user, session_id)
    msg_result = await db.execute(
        select(Message).where(Message.session_id == session_id).order_by(Message.sequence)
    )
    return SessionDetailResponse(
        id=session.id,
        integration_id=session.integration_id,
        integration_name=session.integration_name,
        last_integration_id=session.last_integration_id,
        last_integration_name=session.last_integration_name,
        title=session.title,
        messages=[MessageResponse.model_validate(m) for m in msg_result.scalars().all()],
    )
```

Place these routes before `@router.get("/{integration_id}/sessions")` so FastAPI does not interpret `sessions` as an integration id.

- [ ] **Step 10: Run focused tests**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_chat.py::test_new_send_routes_support_mixed_target_followups tests/test_chat.py::test_global_session_list_returns_all_user_sessions -v
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add backend/app/chat/schemas.py backend/app/chat/providers/base.py backend/app/chat/router.py backend/tests/test_chat.py
git commit -m "feat: add session-centered chat routes"
```

---

### Task 4: Streaming Metadata, Access Rules, And Compatibility

**Files:**
- Modify: `backend/app/chat/router.py`
- Test: `backend/tests/test_chat.py`

- [ ] **Step 1: Add failing tests for streaming metadata and historical access**

Append to `backend/tests/test_chat.py`:

```python
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
```

- [ ] **Step 2: Run focused tests and verify failures**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_chat.py::test_streaming_new_route_persists_target_metadata tests/test_chat.py::test_global_session_detail_allows_historical_view_after_access_removed -v
```

Expected: FAIL until streaming save receives target metadata.

- [ ] **Step 3: Update streaming send helper**

In `backend/app/chat/router.py`, make streaming session creation use `_new_session` and target metadata:

```python
async def _send_streaming(
    db: AsyncSession,
    user: User,
    integration: Integration,
    message: str,
    context,
    existing_session: Session | None,
    history,
    next_sequence: int | None,
    append_lock,
):
    if existing_session:
        session = existing_session
        user_sequence = next_sequence or 1
    else:
        session = _new_session(user, integration, message)
        db.add(session)
        await db.flush()
        user_sequence = 1

    _apply_last_target(session, integration)
    user_msg = Message(
        session_id=session.id,
        role="user",
        content=message,
        sequence=user_sequence,
        integration_id=integration.id,
        integration_name=integration.name,
    )
    db.add(user_msg)
    await db.commit()
    response = await _stream_response(
        integration,
        session.id,
        message,
        context,
        history,
        user_sequence + 1,
        integration.id,
        integration.name,
        append_lock=append_lock,
    )
    return response
```

- [ ] **Step 4: Pass target metadata into stream persistence**

Update `_stream_response` signature:

```python
async def _stream_response(
    integration,
    session_id,
    message,
    context,
    history,
    assistant_sequence,
    integration_id,
    integration_name,
    append_lock=None,
):
```

Update both calls to `_save_stream_assistant_message`:

```python
await _save_stream_assistant_message(
    session_id,
    full_content,
    references,
    assistant_sequence,
    integration_id,
    integration_name,
    provider_session_id,
)
```

Update the error save call with the same `integration_id` and `integration_name`.

Update `_save_stream_assistant_message`:

```python
async def _save_stream_assistant_message(
    session_id,
    content,
    references,
    assistant_sequence,
    integration_id,
    integration_name,
    provider_session_id=None,
):
    from app.database import async_session

    async with async_session() as save_db:
        assistant_msg = Message(
            session_id=session_id,
            role="assistant",
            content=content,
            references=_serialize_refs(references),
            sequence=assistant_sequence,
            integration_id=integration_id,
            integration_name=integration_name,
        )
        save_db.add(assistant_msg)
        values = {
            "last_integration_id": integration_id,
            "last_integration_name": integration_name,
        }
        if provider_session_id:
            values["ragflow_session_id"] = provider_session_id
        await save_db.execute(
            Session.__table__.update()
            .where(Session.__table__.c.id == session_id)
            .values(**values)
        )
        await save_db.commit()
```

- [ ] **Step 5: Update the old integration-mismatch test to the new mixed-target behavior**

Run current chat tests:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_chat.py -v
```

Expected: `test_append_rejects_session_from_another_integration` fails because the old send route now treats the path `integration_id` as the selected target for that turn. Update that test to assert mixed-target append succeeds, then keep a compatibility assertion that `GET /api/chat/{integration_id}/sessions` stays filtered.

For `test_append_rejects_session_from_another_integration`, change the expected behavior:

```python
assert response.status_code == 200
assert response.json()["session_id"] == session_id
```

Then add a separate filtered list assertion:

```python
original_list = await client.get(f"/api/chat/{iid}/sessions", headers={"Authorization": f"Bearer {token}"})
other_list = await client.get(f"/api/chat/{other_iid}/sessions", headers={"Authorization": f"Bearer {token}"})
assert len(original_list.json()) == 1
assert other_list.json() == []
```

- [ ] **Step 6: Run full chat tests**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_chat.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/chat/router.py backend/tests/test_chat.py
git commit -m "feat: persist chat target metadata"
```

---

### Task 5: RAGFlow OpenAI-Compatible Provider

**Files:**
- Modify: `backend/app/chat/providers/ragflow.py`
- Test: `backend/tests/test_ragflow_provider.py`

- [ ] **Step 1: Replace old SDK-focused tests with HTTP endpoint tests**

In `backend/tests/test_ragflow_provider.py`, add these tests near the top:

```python
@pytest.mark.asyncio
async def test_ragflow_chat_uses_openai_compatible_messages():
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
    })

    captured = {}

    class Response:
        def raise_for_status(self): pass
        def json(self):
            return {
                "id": "completion-id",
                "choices": [
                    {"message": {"content": "chat answer", "reference": {"chunks": {"1": {"document_name": "doc.md"}}}}}
                ],
            }

    class Client:
        async def __aenter__(self): return self
        async def __aexit__(self, exc_type, exc, tb): pass
        async def post(self, url, json):
            captured["url"] = url
            captured["json"] = json
            return Response()

    with patch("app.chat.providers.ragflow.httpx.AsyncClient", return_value=Client()):
        result = await provider.send_message(
            "latest",
            context=["pin"],
            history=[{"role": "assistant", "content": "Assistant (Other): prior"}],
        )

    assert captured["url"] == "http://localhost:9380/api/v1/openai/chat-uuid/chat/completions"
    assert captured["json"]["model"] == "model"
    assert captured["json"]["stream"] is False
    assert captured["json"]["extra_body"]["reference"] is True
    assert captured["json"]["messages"][-1] == {"role": "user", "content": "latest"}
    assert result.content == "chat answer"
    assert result.references == {"chunks": {"1": {"document_name": "doc.md"}}}
    assert result.provider_session_id == "completion-id"


@pytest.mark.asyncio
async def test_ragflow_agent_uses_agents_openai_endpoint():
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "agent_id": "agent-uuid",
        "type": "agent",
    })

    captured = {}

    class Response:
        def raise_for_status(self): pass
        def json(self):
            return {"id": "agent-completion", "choices": [{"message": {"content": "agent answer"}}]}

    class Client:
        async def __aenter__(self): return self
        async def __aexit__(self, exc_type, exc, tb): pass
        async def post(self, url, json):
            captured["url"] = url
            captured["json"] = json
            return Response()

    with patch("app.chat.providers.ragflow.httpx.AsyncClient", return_value=Client()):
        result = await provider.send_message("question")

    assert captured["url"] == "http://localhost:9380/api/v1/agents_openai/agent-uuid/chat/completions"
    assert captured["json"]["messages"][-1] == {"role": "user", "content": "question"}
    assert result.content == "agent answer"
```

- [ ] **Step 2: Add streaming parser test**

Append:

```python
@pytest.mark.asyncio
async def test_ragflow_stream_parses_content_and_reference():
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
    })

    class StreamResponse:
        def raise_for_status(self): pass
        async def aiter_lines(self):
            yield 'data: {"id":"c1","choices":[{"delta":{"content":"hello "},"finish_reason":null}]}'
            yield 'data: {"id":"c1","choices":[{"delta":{"content":"world","reference":{"chunks":{"1":{"document_name":"doc.md"}}}},"finish_reason":null}]}'
            yield "data: [DONE]"

    class StreamContext:
        async def __aenter__(self): return StreamResponse()
        async def __aexit__(self, exc_type, exc, tb): pass

    class Client:
        async def __aenter__(self): return self
        async def __aexit__(self, exc_type, exc, tb): pass
        def stream(self, method, url, json):
            return StreamContext()

    with patch("app.chat.providers.ragflow.httpx.AsyncClient", return_value=Client()):
        chunks = [chunk async for chunk in provider.stream_message("question")]

    assert [chunk.content for chunk in chunks] == ["hello ", "world", ""]
    assert chunks[-1].done is True
    assert chunks[-1].references == {"chunks": {"1": {"document_name": "doc.md"}}}
    assert chunks[-1].provider_session_id == "c1"
```

- [ ] **Step 3: Run provider tests and verify failures**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_ragflow_provider.py -v
```

Expected: FAIL because current provider uses `ragflow_sdk`.

- [ ] **Step 4: Implement HTTP-based RAGFlow provider**

Replace `backend/app/chat/providers/ragflow.py` with this structure:

```python
import json
from typing import AsyncGenerator
import httpx
from app.chat.providers.base import ChatProvider, ChatResponse, StreamChunk, ChatHistoryMessage


class RagflowProvider(ChatProvider):
    def __init__(self, config: dict):
        self.base_url = config["base_url"].rstrip("/")
        self.api_key = config["api_key"]
        self.chat_or_agent_id = config.get("chat_id") or config.get("agent_id")
        self.entity_type = config.get("type", "chat")
        self.model = config.get("model", "model")
        self.parameters = config.get("parameters", {})
        self._headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    def _endpoint(self) -> str:
        if self.entity_type == "agent":
            return f"{self.base_url}/api/v1/agents_openai/{self.chat_or_agent_id}/chat/completions"
        return f"{self.base_url}/api/v1/openai/{self.chat_or_agent_id}/chat/completions"

    def _build_messages(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> list[dict]:
        messages = []
        if context:
            for ctx in context:
                messages.append({"role": "system", "content": f"[Injected context]: {ctx}"})
        if history:
            messages.extend({"role": item["role"], "content": item["content"]} for item in history)
        messages.append({"role": "user", "content": message})
        return messages

    def _payload(self, message: str, context=None, history=None, stream=False) -> dict:
        payload = {
            "model": self.model,
            "messages": self._build_messages(message, context, history),
            "stream": stream,
            **self.parameters,
        }
        if self.entity_type == "chat":
            extra_body = dict(payload.get("extra_body") or {})
            extra_body.setdefault("reference", True)
            payload["extra_body"] = extra_body
        return payload

    def _extract_reference(self, message_obj: dict) -> dict | list[dict] | None:
        reference = message_obj.get("reference")
        return reference or None

    async def send_message(self, message: str, context=None, history=None) -> ChatResponse:
        async with httpx.AsyncClient(headers=self._headers, timeout=120.0) as client:
            response = await client.post(self._endpoint(), json=self._payload(message, context, history, stream=False))
            response.raise_for_status()
            data = response.json()

        message_obj = data["choices"][0]["message"]
        return ChatResponse(
            content=message_obj.get("content") or "",
            references=self._extract_reference(message_obj),
            provider_session_id=data.get("id"),
        )

    async def stream_message(self, message: str, context=None, history=None) -> AsyncGenerator[StreamChunk, None]:
        references = None
        provider_session_id = None
        async with httpx.AsyncClient(headers=self._headers, timeout=120.0) as client:
            async with client.stream("POST", self._endpoint(), json=self._payload(message, context, history, stream=True)) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        yield StreamChunk(content="", done=True, references=references, provider_session_id=provider_session_id)
                        return
                    data = json.loads(data_str)
                    provider_session_id = data.get("id") or provider_session_id
                    delta = data["choices"][0].get("delta", {})
                    if delta.get("reference"):
                        references = delta["reference"]
                    content = delta.get("content") or ""
                    if content:
                        yield StreamChunk(content=content)
        yield StreamChunk(content="", done=True, references=references, provider_session_id=provider_session_id)
```

- [ ] **Step 5: Run provider tests**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/test_ragflow_provider.py -v
```

Expected: PASS after deleting or updating obsolete SDK-specific tests in that file.

- [ ] **Step 6: Commit**

```bash
git add backend/app/chat/providers/ragflow.py backend/tests/test_ragflow_provider.py
git commit -m "feat: use ragflow openai-compatible chat API"
```

---

### Task 6: Frontend API And State

**Files:**
- Modify: `frontend/src/api/auth.ts`
- Modify: `frontend/src/api/chat.ts`
- Modify: `frontend/src/store/authStore.ts`
- Modify: `frontend/src/store/chatStore.ts`

- [ ] **Step 1: Update auth API types**

Modify `frontend/src/api/auth.ts`:

```ts
export interface User {
  id: string
  username: string
  fullname: string | null
  role: string
  default_integration_id: string | null
}
```

Add:

```ts
export const updateDefaultIntegrationApi = (integrationId: string | null) =>
  client.put<User>('/auth/default-integration', { integration_id: integrationId })
```

- [ ] **Step 2: Update chat API types and routes**

Modify `frontend/src/api/chat.ts`:

```ts
export interface MessageData {
  id: string
  role: string
  content: string
  references: string | null
  pinned: boolean
  sequence: number
  integration_id: string | null
  integration_name: string | null
}

export interface SessionData {
  id: string
  integration_id: string
  integration_name: string | null
  last_integration_id: string | null
  last_integration_name: string | null
  title: string
  created_at: string
}

export interface SessionDetail {
  id: string
  integration_id: string
  integration_name: string | null
  last_integration_id: string | null
  last_integration_name: string | null
  title: string
  messages: MessageData[]
}
```

Update `sendMessageApi`:

```ts
export const sendMessageApi = (
  integrationId: string,
  message: string,
  pinnedIds?: string[],
  sessionId?: string | null,
) => {
  const url = sessionId ? `/chat/sessions/${sessionId}/send` : '/chat/send'
  return client.post<SendResponse>(url, {
    integration_id: integrationId,
    message,
    pinned_ids: pinnedIds,
    stream: false,
  })
}
```

Update `sendMessageStreamApi` URL and body:

```ts
const url = sessionId ? `/api/chat/sessions/${sessionId}/send` : '/api/chat/send'
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    integration_id: integrationId,
    message,
    pinned_ids: pinnedIds,
    stream: true,
  }),
})
```

Add global session helpers and keep old helpers for compatibility:

```ts
export const getSessionsApi = () =>
  client.get<SessionData[]>('/chat/sessions')

export const getSessionApi = (sessionId: string) =>
  client.get<SessionDetail>(`/chat/sessions/${sessionId}`)

export const getIntegrationSessionsApi = (integrationId: string) =>
  client.get<SessionData[]>(`/chat/${integrationId}/sessions`)

export const getIntegrationSessionApi = (integrationId: string, sessionId: string) =>
  client.get<SessionDetail>(`/chat/${integrationId}/sessions/${sessionId}`)
```

- [ ] **Step 3: Update auth store**

Modify `frontend/src/store/authStore.ts` imports:

```ts
import { loginApi, getMeApi, updateDefaultIntegrationApi, User } from '../api/auth'
```

Extend state:

```ts
  setDefaultIntegration: (integrationId: string | null) => Promise<void>
```

Add implementation:

```ts
  setDefaultIntegration: async (integrationId) => {
    const { data } = await updateDefaultIntegrationApi(integrationId)
    set({ user: data })
  },
```

- [ ] **Step 4: Update chat store**

Modify `frontend/src/store/chatStore.ts`:

```ts
interface ChatState {
  integrations: Integration[]
  activeIntegration: Integration | null
  activeSessionId: string | null
  sessions: SessionData[]
  currentMessages: MessageData[]
  isStreaming: boolean
  setIntegrations: (integrations: Integration[]) => void
  setActiveIntegration: (integration: Integration | null) => void
  setActiveSessionId: (sessionId: string | null) => void
  setSessions: (sessions: SessionData[]) => void
  setCurrentMessages: (messages: MessageData[], sessionId?: string | null) => void
  addMessage: (message: MessageData) => void
  updateMessageContent: (messageId: string, updater: (prevContent: string) => string) => void
  setStreaming: (streaming: boolean) => void
  startNewChat: (integration?: Integration | null) => void
}
```

Update initial state and setters:

```ts
export const useChatStore = create<ChatState>((set) => ({
  integrations: [],
  activeIntegration: null,
  activeSessionId: null,
  sessions: [],
  currentMessages: [],
  isStreaming: false,

  setIntegrations: (integrations) => set({ integrations }),
  setActiveIntegration: (integration) => set({ activeIntegration: integration }),
  setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentMessages: (messages, sessionId = null) => set({
    currentMessages: messages,
    activeSessionId: sessionId,
  }),
  addMessage: (message) => set((state) => ({ currentMessages: [...state.currentMessages, message] })),
  updateMessageContent: (messageId, updater) => set((state) => {
    const messageIndex = state.currentMessages.findIndex((message) => message.id === messageId)
    if (messageIndex === -1) return state
    const currentMessages = [...state.currentMessages]
    const message = currentMessages[messageIndex]
    currentMessages[messageIndex] = { ...message, content: updater(message.content) }
    return { currentMessages }
  }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  startNewChat: (integration = null) => set({
    currentMessages: [],
    activeSessionId: null,
    activeIntegration: integration,
  }),
}))
```

- [ ] **Step 5: Run TypeScript build and capture expected failures**

Run:

```bash
cd frontend
npm run build
```

Expected: FAIL in components that still call `getSessionsApi(integrationId)`, `getSessionApi(integrationId, sessionId)`, or create `MessageData` without target metadata.

- [ ] **Step 6: Commit API/state changes**

Do not commit until Task 7 compiles. Leave these changes staged only after Task 7.

---

### Task 7: Chat Selector Component And Composer Integration

**Files:**
- Create: `frontend/src/components/ChatSelector.tsx`
- Modify: `frontend/src/components/ChatWindow.tsx`
- Modify: `frontend/src/components/MessageBubble.tsx`
- Modify: `frontend/src/components/SessionHistory.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/components/IntegrationList.tsx`

- [ ] **Step 1: Create ChatSelector component**

Create `frontend/src/components/ChatSelector.tsx`:

```tsx
import { Check, ChevronDown, Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Integration } from '../api/integrations'

interface Props {
  integrations: Integration[]
  selected: Integration | null
  defaultIntegrationId: string | null
  disabled: boolean
  onSelect: (integration: Integration) => void
  onSetDefault: (integrationId: string) => void | Promise<void>
}

export default function ChatSelector({
  integrations,
  selected,
  defaultIntegrationId,
  disabled,
  onSelect,
  onSetDefault,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const ordered = [...integrations].sort((a, b) => {
    if (a.id === defaultIntegrationId) return -1
    if (b.id === defaultIntegrationId) return 1
    return 0
  })

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled || integrations.length === 0}
        onClick={() => setOpen((value) => !value)}
        className="h-9 max-w-[220px] inline-flex items-center gap-2 rounded-[9px] border border-we-border bg-we-canvas px-3 text-xs font-medium text-we-text disabled:opacity-50 disabled:cursor-not-allowed"
        title="Select chat"
      >
        <span className="truncate">{selected?.name || 'Select chat'}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-72 rounded-lg border border-we-border bg-white shadow-[0_12px_32px_rgba(0,0,0,0.16)] overflow-hidden z-20">
          {ordered.map((integration) => {
            const isSelected = selected?.id === integration.id
            const isDefault = defaultIntegrationId === integration.id
            return (
              <div key={integration.id} className="border-b border-we-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(integration)
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-we-canvas"
                >
                  <span className="w-5 text-we-accent">{isSelected && <Check className="w-4 h-4" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-we-text truncate">{integration.name}</span>
                    <span className="block text-[11px] text-we-muted truncate">{integration.provider_type}</span>
                  </span>
                  {isDefault && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-we-accent">
                      <Star className="w-3 h-3" />
                      Default
                    </span>
                  )}
                </button>
                {!isDefault && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onSetDefault(integration.id)
                      setOpen(false)
                    }}
                    className="w-full px-10 pb-2 text-left text-[11px] text-we-muted hover:text-we-accent"
                  >
                    Set as default
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update MessageBubble assistant label**

Modify `frontend/src/components/MessageBubble.tsx` inside the assistant bubble header/body:

```tsx
{message.role === 'assistant' && message.integration_name && (
  <div className="mb-1 text-[11px] font-medium text-we-muted">
    Answered by {message.integration_name}
  </div>
)}
```

Keep the existing Pin and Copy actions unchanged.

- [ ] **Step 3: Update SessionHistory to global sessions**

Modify imports in `frontend/src/components/SessionHistory.tsx`:

```tsx
import { useLocation } from 'react-router-dom'
import { getSessionsApi, getSessionApi } from '../api/chat'
import { useAuthStore } from '../store/authStore'
```

Update component logic:

```tsx
export default function SessionHistory({ collapsed }: Props) {
  const {
    integrations,
    sessions,
    setSessions,
    setCurrentMessages,
    setActiveIntegration,
    isStreaming,
  } = useChatStore()
  const { user } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/chat') {
      getSessionsApi().then(({ data }) => setSessions(data))
    }
  }, [location.pathname, setSessions])

  const viewSession = async (sessionId: string) => {
    if (isStreaming) return
    const { data } = await getSessionApi(sessionId)
    setCurrentMessages(data.messages, data.id)
    const restored = integrations.find((i) => i.id === data.last_integration_id)
    const fallback = integrations.find((i) => i.id === user?.default_integration_id) || integrations[0] || null
    setActiveIntegration(restored || fallback)
  }

  if (collapsed || location.pathname !== '/chat') return null

  return (
    <div>
      <div className={sidebarSectionLabelCls}>Recent Sessions</div>
      {sessions.map((s) => (
        <div
          key={s.id}
          onClick={() => viewSession(s.id)}
          className={`px-3 py-1 mx-1 rounded text-[11px] text-white transition-colors ${
            isStreaming ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:text-white/80'
          }`}
        >
          <div className="truncate">{s.title}</div>
          {s.last_integration_name && (
            <div className="truncate text-[10px] text-white/35">{s.last_integration_name}</div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Remove sidebar IntegrationList usage**

Modify `frontend/src/components/Layout.tsx`:

```tsx
// remove this import
// import IntegrationList from './IntegrationList'
```

Remove:

```tsx
<IntegrationList collapsed={isCollapsed} />
```

Keep:

```tsx
<SessionHistory collapsed={isCollapsed} />
```

Leave `frontend/src/components/IntegrationList.tsx` unused for one commit, then delete it after the build passes:

```bash
git rm frontend/src/components/IntegrationList.tsx
```

- [ ] **Step 5: Update ChatWindow data loading and default resolution**

Modify imports in `frontend/src/components/ChatWindow.tsx`:

```tsx
import { useAuthStore } from '../store/authStore'
import { listIntegrationsApi, Integration } from '../api/integrations'
import ChatSelector from './ChatSelector'
import { Plus, Send } from 'lucide-react'
```

Add helper inside file:

```tsx
const resolveDefaultIntegration = (
  integrations: Integration[],
  defaultIntegrationId: string | null | undefined,
) => integrations.find((i) => i.id === defaultIntegrationId) || integrations[0] || null
```

Destructure new state:

```tsx
const {
  integrations,
  activeIntegration,
  activeSessionId,
  currentMessages,
  setIntegrations,
  setActiveIntegration,
  addMessage,
  startNewChat,
  setActiveSessionId,
  setSessions,
  setCurrentMessages,
  isStreaming,
  setStreaming,
  updateMessageContent,
} = useChatStore()
const { user, setDefaultIntegration } = useAuthStore()
```

Add integration load effect:

```tsx
useEffect(() => {
  let cancelled = false
  listIntegrationsApi().then(({ data }) => {
    if (cancelled) return
    setIntegrations(data)
    if (!useChatStore.getState().activeIntegration) {
      setActiveIntegration(resolveDefaultIntegration(data, user?.default_integration_id))
    }
  })
  return () => { cancelled = true }
}, [setIntegrations, setActiveIntegration, user?.default_integration_id])
```

Update `handleNewChat`:

```tsx
const handleNewChat = () => {
  if (isStreaming) return
  const defaultIntegration = resolveDefaultIntegration(integrations, user?.default_integration_id)
  startNewChat(defaultIntegration)
  clearSelectedPins()
  setError('')
  setInput('')
  setShowPinSelector(false)
  if (textareaRef.current) textareaRef.current.style.height = 'auto'
}
```

Replace the no-active-integration empty state with:

```tsx
if (integrations.length === 0) {
  return (
    <div className="flex-1 flex items-center justify-center text-amcs-grey-300 text-sm bg-we-canvas">
      No chats available. Contact your manager for access.
    </div>
  )
}

if (!activeIntegration) {
  return (
    <div className="flex-1 flex items-center justify-center text-amcs-grey-300 text-sm bg-we-canvas">
      Select a chat to start.
    </div>
  )
}
```

- [ ] **Step 6: Update optimistic temp messages**

In `handleSend`, update temp messages:

```tsx
const userMsg = {
  id: `temp-user-${timestamp}`,
  role: 'user',
  content: input,
  references: null,
  pinned: false,
  sequence: nextSequence,
  integration_id: activeIntegration.id,
  integration_name: activeIntegration.name,
}
```

And:

```tsx
const assistantMsg = {
  id: assistantTempId,
  role: 'assistant',
  content: '',
  references: null,
  pinned: false,
  sequence: nextSequence + 1,
  integration_id: activeIntegration.id,
  integration_name: activeIntegration.name,
}
```

Update session refresh calls:

```tsx
const { data } = await getSessionApi(returnedSessionId)
```

And:

```tsx
const sessionsRes = await getSessionsApi()
setSessions(sessionsRes.data)
```

- [ ] **Step 7: Replace composer controls**

In the input bar JSX, use desktop/mobile layout:

```tsx
<div className="bg-white rounded-[14px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-we-border p-2">
  <div className="flex items-center gap-2 pb-2 md:hidden">
    <ChatSelector
      integrations={integrations}
      selected={activeIntegration}
      defaultIntegrationId={user?.default_integration_id || null}
      disabled={isStreaming}
      onSelect={setActiveIntegration}
      onSetDefault={setDefaultIntegration}
    />
    <button type="button" onClick={handleNewChat} disabled={isStreaming} title="New chat" className="h-9 w-9 rounded-[9px] border border-we-border flex items-center justify-center disabled:opacity-50">
      <Plus className="w-4 h-4" />
    </button>
  </div>
  <div className="flex items-end gap-3">
    <div className="hidden md:flex items-center gap-2 shrink-0 pb-1">
      <ChatSelector
        integrations={integrations}
        selected={activeIntegration}
        defaultIntegrationId={user?.default_integration_id || null}
        disabled={isStreaming}
        onSelect={setActiveIntegration}
        onSetDefault={setDefaultIntegration}
      />
      <button type="button" onClick={handleNewChat} disabled={isStreaming} title="New chat" className="h-9 w-9 rounded-[9px] border border-we-border flex items-center justify-center disabled:opacity-50">
        <Plus className="w-4 h-4" />
      </button>
    </div>
    <button
      onClick={() => setShowPinSelector(!showPinSelector)}
      title="Attach pinned responses"
      className="text-amcs-grey-300 hover:text-amcs-primary text-sm cursor-pointer transition-colors shrink-0 pb-1.5"
    >
      Pin
    </button>
    <textarea ... />
    <div className="pb-2 text-[11px] text-we-muted shrink-0">{userQuestionCount}/10</div>
    <button ...><Send className="w-[18px] h-[18px]" /></button>
  </div>
</div>
```

Remove the old top-of-transcript `New Chat` button and `userQuestionCount/10` block.

- [ ] **Step 8: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 9: Run targeted lint**

Run:

```bash
cd frontend
npx eslint src/components/ChatSelector.tsx src/components/ChatWindow.tsx src/components/SessionHistory.tsx src/components/Layout.tsx src/components/MessageBubble.tsx src/api/auth.ts src/api/chat.ts src/store/authStore.ts src/store/chatStore.ts
```

Expected: PASS for the changed files.

- [ ] **Step 10: Commit frontend UI**

```bash
git add frontend/src/api/auth.ts frontend/src/api/chat.ts frontend/src/store/authStore.ts frontend/src/store/chatStore.ts frontend/src/components/ChatSelector.tsx frontend/src/components/ChatWindow.tsx frontend/src/components/SessionHistory.tsx frontend/src/components/Layout.tsx frontend/src/components/MessageBubble.tsx frontend/src/components/IntegrationList.tsx
git commit -m "feat: move chat selection into composer"
```

---

### Task 8: Docs And Full Verification

**Files:**
- Modify: `docs/developer-guide.md`
- Modify: `docs/user-guide.md`

- [ ] **Step 1: Update developer guide**

In `docs/developer-guide.md`, update the chat API section with:

```markdown
| `/api/chat/send` | POST | User | Create a session on first send. Body: `{integration_id, message, pinned_ids?, stream?}`. |
| `/api/chat/sessions` | GET | User | List 100 recent sessions for the authenticated user across all integrations. |
| `/api/chat/sessions/{id}` | GET | User | Get owned session with message-level integration metadata. |
| `/api/chat/sessions/{id}/send` | POST | User | Append a follow-up to an owned session. Body: `{integration_id, message, pinned_ids?, stream?}`. |
```

Add:

```markdown
Each message stores the integration id and integration name used for that turn. A session keeps its original `integration_id` for compatibility and also stores `last_integration_id` and `last_integration_name` for resume behavior.

The frontend can switch target integrations between follow-up questions. The backend sends the full EdgeAI transcript to the selected provider and appends the new user message last.

RAGFlow chat integrations use `/api/v1/openai/{chat_id}/chat/completions`; RAGFlow agent integrations use `/api/v1/agents_openai/{agent_id}/chat/completions`.
```

Add migration note:

```markdown
Startup migrations in `app/migrations.py` add nullable columns for existing SQLite deployments. `Base.metadata.create_all` remains enough for fresh databases, but startup also calls the migration helper because SQLite does not add columns to existing tables through `create_all`.
```

- [ ] **Step 2: Update user guide**

In `docs/user-guide.md`, replace sidebar integration selection wording with:

```markdown
Use the chat selector in the input bar to choose which chat receives your next message. You can change the selected chat between follow-up questions. EdgeAI sends the visible conversation history to the selected chat.
```

Add:

```markdown
To set your default chat, open the chat selector and choose `Set as default` on the chat you want new conversations to use. Selecting a chat for one message does not change your default.
```

Add:

```markdown
Assistant messages show which chat answered them. Recent Sessions lists your conversations globally and shows the last-used chat for each conversation.
```

Keep the existing 10-question and pin behavior text, adjusted to say the limit is per conversation.

- [ ] **Step 3: Run full backend suite**

Run:

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/ -v
```

Expected: PASS.

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run frontend lint**

Run:

```bash
cd frontend
npm run lint
```

Expected: PASS for changed files. If full lint still reports pre-existing errors outside this feature, record the exact file and rule in the final handoff and verify targeted lint from Task 7 still passes.

- [ ] **Step 6: Commit docs**

```bash
git add docs/developer-guide.md docs/user-guide.md
git commit -m "docs: describe composer chat selection"
```

- [ ] **Step 7: Final status check**

Run:

```bash
git status -sb
git log --oneline -8
```

Expected: clean worktree except ignored files, with feature commits visible.
