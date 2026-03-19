# EdgeAI Developer Guide

## Architecture Overview

EdgeAI is a chat gateway with a FastAPI async backend, React frontend, and SQLite database. It wraps multiple AI providers (RAGFlow, OpenAI-compatible) behind a unified interface with cross-chat context injection via pinned responses.

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React 19 + TypeScript + Vite)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ AuthStore│  │ ChatStore│  │ PinStore         │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       └──────────────┼─────────────────┘            │
│                      │ Axios + SSE                  │
├──────────────────────┼──────────────────────────────┤
│  Backend (FastAPI)   │                              │
│  ┌─────────┐  ┌──────┴──────┐  ┌────────────────┐  │
│  │Auth     │  │Chat Router  │  │Admin/Manager/  │  │
│  │Router   │  │(send+stream)│  │Pins/Integr.    │  │
│  └─────────┘  └──────┬──────┘  └────────────────┘  │
│                      │                              │
│          ┌───────────┴───────────┐                  │
│          │  Provider Factory     │                  │
│          ├───────────┬───────────┤                  │
│          │ RAGFlow   │ OpenAI    │                  │
│          │ Provider  │ Compat    │                  │
│          └───────────┴───────────┘                  │
│                      │                              │
│  ┌───────────────────┴──────────────────────────┐   │
│  │  SQLite (WAL mode) — SQLAlchemy async ORM    │   │
│  │  Users | Integrations | Sessions | Messages  │   │
│  │  PinnedResponses | UserIntegrationAccess     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Local Development Setup

### Backend

```bash
cd backend
# Create venv (uses uv)
~/.local/bin/uv venv .venv
source .venv/bin/activate
~/.local/bin/uv pip install -r requirements.txt

# Run dev server
SECRET_KEY=test ADMIN_PASSWORD=admin uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev    # Vite on :5173, proxies /api → :8000
```

### Running Tests

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/ -v              # all tests
SECRET_KEY=test python -m pytest tests/test_chat.py -v  # single file
SECRET_KEY=test python -m pytest -k test_send_message   # by name
```

Tests use an in-memory SQLite database. The `setup_db` fixture in `conftest.py` creates and drops all tables per test.

## Key Design Decisions

### Single-Turn Sessions

Every message creates a new `Session` with exactly two `Message` rows (user sequence=1, assistant sequence=2). There is no multi-turn conversation state. This is by design — the app is a question-answer gateway, not a chatbot.

### Provider Abstraction

All AI providers implement `ChatProvider` (in `app/chat/providers/base.py`):

```python
class ChatProvider(ABC):
    async def send_message(message: str, context: list[str] | None) -> ChatResponse
    async def stream_message(message: str, context: list[str] | None) -> AsyncGenerator[StreamChunk, None]
```

The `context` parameter carries pinned response content for cross-chat injection. Providers prepend it to the user's question.

### Non-Streaming Persistence Order

For non-streaming requests, the provider is called **before** persisting the session. If the provider fails, no orphaned rows are created. For streaming, the session must be persisted first (the response arrives asynchronously via SSE).

## API Reference

### Authentication

All endpoints except `/api/auth/login`, `/api/auth/refresh`, and `/api/health` require a Bearer token.

```
Authorization: Bearer <access_token>
```

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | No | `{username, password}` → `{access_token, refresh_token, user}` |
| `/api/auth/refresh` | POST | No | `{refresh_token}` → `{access_token, refresh_token}` |
| `/api/auth/me` | GET | User | Current user info |
| `/api/auth/change-password` | POST | User | Change own password `{current_password, new_password}` |

### Chat

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/chat/{integration_id}/send` | POST | User | Send message. Body: `{message, pinned_ids?, stream?}` |
| `/api/chat/{integration_id}/sessions` | GET | User | List 100 most recent sessions |
| `/api/chat/{integration_id}/sessions/{id}` | GET | User | Get session with messages |

**Streaming:** When `stream: true`, the response is Server-Sent Events:
- `data: <text>` — content chunks
- `event: done` + `data: {"references": [...], "provider_session_id": "..."}` — completion
- `event: error` + `data: {"detail": "..."}` — error

**Note:** `sse-starlette` uses `\r\n` as its default line separator. The frontend SSE parser strips trailing `\r` from lines before processing to handle this correctly.

### Integrations

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/integrations` | GET | User | List integrations (filtered by access for user role) |
| `/api/integrations` | POST | Admin | Create integration |
| `/api/integrations/{id}` | PUT | Admin | Update integration |
| `/api/integrations/{id}` | DELETE | Admin | Delete integration |

**IntegrationResponse** deliberately excludes `provider_config` to prevent API key leakage. Includes optional `opening_greeting` field (displayed in ChatWindow when no messages exist).

### Pins

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/pins` | GET | User | List user's pins (paginated) |
| `/api/pins` | POST | User | Pin a message `{message_id, label}` |
| `/api/pins/{id}` | PUT | User | Update pin label |
| `/api/pins/{id}` | DELETE | User | Delete pin (resets message.pinned flag) |

Duplicate pin per user+message returns `409 Conflict`.

### Admin

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/users` | GET | Admin | List all users (paginated) |
| `/api/admin/users` | POST | Admin | Create user `{username, password, role}` (any role) |
| `/api/admin/users/{id}` | PUT | Admin | Update role/password |
| `/api/admin/users/{id}` | DELETE | Admin | Delete user |

### Manager

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/manager/users` | GET | Manager/Admin | List non-admin users |
| `/api/manager/users` | POST | Manager/Admin | Create user/manager (not admin) |
| `/api/manager/users/{id}` | PUT | Manager/Admin | Update user/manager role or password |
| `/api/manager/users/{id}` | DELETE | Manager/Admin | Delete user/manager |
| `/api/manager/users/{id}/access` | GET | Manager/Admin | List user's integration access |
| `/api/manager/users/{id}/access` | PUT | Manager/Admin | Replace user's integration access `{integration_ids: [str]}` |

**Guard rails:** Managers cannot create/edit/delete admin accounts, change their own role, or delete themselves. Admins also cannot delete their own account.

## Database Schema

All primary keys are UUID strings. Timestamps are UTC.

```
users
  id, username (unique), fullname, password_hash, role, created_at, last_login

integrations
  id, name, provider_type, provider_config (JSON), description, icon,
  opening_greeting, created_at, updated_by → users.id

sessions
  id, user_id → users.id, integration_id → integrations.id,
  ragflow_session_id, title, created_at

messages
  id, session_id → sessions.id, role, content, references (JSON),
  pinned, sequence, created_at

pinned_responses
  id, user_id → users.id, message_id → messages.id,
  integration_id → integrations.id, label, content, created_at
  UNIQUE(user_id, message_id)

user_integration_access
  id, user_id → users.id, integration_id → integrations.id,
  granted_by → users.id, created_at
  UNIQUE(user_id, integration_id)
```

**Access control:** Users with role `user` only see integrations where a matching `user_integration_access` row exists (deny-by-default). Managers and admins see all integrations.

**Cascade behavior:** Deleting a user or integration explicitly deletes related `user_integration_access` rows via pre-delete queries (not FK CASCADE, since SQLite `PRAGMA foreign_keys` is not enabled).

## Adding a New Provider

1. **Create the provider** in `backend/app/chat/providers/`:

```python
# backend/app/chat/providers/my_provider.py
import asyncio
from app.chat.providers.base import ChatProvider, ChatResponse, StreamChunk

class MyProvider(ChatProvider):
    def __init__(self, config: dict):
        self.api_key = config["api_key"]
        # parse config...

    async def send_message(self, message: str, context: list[str] | None = None) -> ChatResponse:
        # If using a sync library, wrap with asyncio.to_thread()
        question = message
        if context:
            question = "\n".join(f"[Context]: {c}" for c in context) + f"\n\n{message}"

        result = await asyncio.to_thread(self._sync_call, question)
        return ChatResponse(content=result, references=None, provider_session_id=None)

    async def stream_message(self, message: str, context: list[str] | None = None):
        # yield StreamChunk(content="partial text")
        # yield StreamChunk(content="", done=True, references=None)
        ...
```

2. **Add constant** in `backend/app/constants.py`:

```python
PROVIDER_MY_PROVIDER = "my_provider"
```

3. **Register in factory** in `backend/app/chat/providers/factory.py`:

```python
from app.constants import PROVIDER_MY_PROVIDER

elif integration.provider_type == PROVIDER_MY_PROVIDER:
    from app.chat.providers.my_provider import MyProvider
    return MyProvider(config)
```

4. **Add frontend option** in `frontend/src/components/AdminPanel.tsx`:

```tsx
<option value="my_provider">My Provider</option>
```

5. **Write tests** in `backend/tests/test_my_provider.py` — mock external API calls.

## Test Patterns

### Creating Test Data

Each test file typically has a helper to create a user, log in, and return a token:

```python
async def setup_and_login(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    async with TestingSessionLocal() as db:
        user = User(
            id=str(uuid.uuid4()),
            username="testuser",
            password_hash=hash_password("pass"),
            role="user",
        )
        db.add(user)
        await db.commit()
    login = await client.post("/api/auth/login", json={"username": "testuser", "password": "pass"})
    return login.json()["access_token"]
```

### Mocking Providers

Chat tests mock the provider to avoid real API calls:

```python
from unittest.mock import patch, AsyncMock
from app.chat.providers.base import ChatResponse

with patch("app.chat.router.get_provider") as mock:
    mock.return_value = AsyncMock()
    mock.return_value.send_message.return_value = ChatResponse(
        content="mocked response", references=None, provider_session_id=None
    )
    response = await client.post(f"/api/chat/{integration_id}/send", ...)
```

### Testing Role-Protected Endpoints

Create users with `role="admin"`, `role="manager"`, or `role="user"` to test endpoints with different authorization levels. Manager endpoints (`/api/manager/*`) accept both manager and admin roles. Verify `403 Forbidden` for unauthorized roles. See `tests/test_manager.py` for comprehensive examples of guard rail testing.

## Project Conventions

- **Constants** over string literals: use `app/constants.py` for roles (`ROLE_ADMIN`, `ROLE_MANAGER`, `ROLE_USER`) and provider types
- **`model_validate`** for Pydantic responses: `UserResponse.model_validate(user)`, not manual field construction
- **UUID string PKs**: all models use `str(uuid.uuid4())`, not integer autoincrement
- **Async everywhere**: all DB operations use `async/await`. Sync libraries (like ragflow-sdk) are wrapped in `asyncio.to_thread()`
- **Token constants**: frontend uses `TOKEN_KEY`/`REFRESH_TOKEN_KEY` from `api/client.ts`, not raw `'access_token'` strings
- **Integration API consolidation**: all integration CRUD lives in `api/integrations.ts`, not split across files
- **Collapsible sidebar**: `Layout.tsx` sidebar with localStorage persistence and responsive auto-collapse (<768px)
- **Shared style constants**: `styles.ts` exports reusable Tailwind class strings (`inputCls`, `selectCls`, `btnPrimaryCls`, etc.)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | — | JWT signing key |
| `ADMIN_PASSWORD` | First run | `""` | Bootstrap admin password |
| `ADMIN_USERNAME` | No | `admin` | Bootstrap admin username |
| `DATABASE_URL` | No | `sqlite+aiosqlite:///data/edgeai.db` | Database connection string |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` | JWT access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | JWT refresh token TTL |
