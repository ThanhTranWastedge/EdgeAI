# EdgeAI — RAGFlow Chat Gateway

**Date:** 2026-03-18
**Status:** Draft

## Overview

A web application that wraps RAGFlow and OpenAI-compatible APIs behind a unified chat interface with user management, session history, and cross-chat context injection.

**Core value:** Users select from admin-configured chat integrations (backed by RAGFlow or OpenAI-compatible providers), chat with them, pin useful responses, and inject those pinned responses as context into other chats.

## Requirements

- **User management:** Simple username/password auth with JWT. Admin and user roles.
- **Multi-provider:** Each integration routes to either RAGFlow (chat/agent) or an OpenAI-compatible API (OpenRouter, OpenAI, local models).
- **Fresh sessions:** Every message send creates a new session (single question → single answer). Each session contains exactly one user message and one assistant response. This is intentional — no multi-turn conversations. Users can browse their last 10 sessions per integration for reference.
- **Cross-chat injection:** Users pin assistant responses and inject them as context into other chats.
- **Streaming:** SSE streaming for both provider types.
- **Simple deployment:** Single `docker-compose up` brings up the whole app.

## Architecture

```
React Frontend
    │ HTTP / SSE (JWT Auth)
    ▼
FastAPI Backend
    ├── Auth Module (JWT)
    ├── Chat Router (provider dispatch)
    │   ├── RAGFlow Provider (ragflow-sdk)
    │   └── OpenAI-Compatible Provider (httpx)
    ├── Session Manager
    └── Pinned Response Store
            │
            ▼
        SQLite (WAL mode)

External:
    ├── RAGFlow Instance (existing, user-managed)
    └── OpenAI-compatible APIs (OpenRouter, etc.)
```

The Chat Router looks up the integration config and dispatches to the correct provider. Both providers implement the same `ChatProvider` interface.

## Data Model

### users
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| username | TEXT | Unique |
| password_hash | TEXT | bcrypt |
| role | TEXT | "admin" or "user" |
| created_at | DATETIME | |
| last_login | DATETIME | Nullable |

### integrations
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | TEXT | Display name (e.g., "Marketing") |
| provider_type | TEXT | "ragflow" or "openai_compatible" |
| provider_config | JSON | Provider-specific config (see below) |
| description | TEXT | Nullable |
| icon | TEXT | Nullable, emoji or URL |
| created_at | DATETIME | |
| updated_by | UUID | FK → users.id |

**provider_config for RAGFlow:**
```json
{
  "base_url": "http://ragflow:9380",
  "api_key": "ragflow-xxx",
  "chat_id": "uuid" | "agent_id": "uuid",
  "type": "chat" | "agent"
}
```

**provider_config for OpenAI-compatible:**
```json
{
  "base_url": "https://openrouter.ai/api/v1",
  "api_key": "sk-xxx",
  "model": "anthropic/claude-sonnet-4-20250514",
  "system_prompt": "You are a helpful assistant.",
  "parameters": {
    "temperature": 0.7,
    "max_tokens": 4096,
    "top_p": 1.0
  }
}
```

### sessions
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| integration_id | UUID | FK → integrations.id |
| ragflow_session_id | TEXT | Nullable, for RAGFlow provider |
| title | TEXT | Auto-generated from first message snippet |
| created_at | DATETIME | |

Each session contains exactly one exchange (one user message + one assistant response). The `ragflow_session_id` is stored to enable potential future reference or debugging against RAGFlow's server-side session.

### messages
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| session_id | UUID | FK → sessions.id |
| role | TEXT | "user" or "assistant" |
| content | TEXT | |
| references | TEXT | Nullable, serialized JSON string for RAGFlow citations |
| pinned | BOOLEAN | Default false |
| sequence | INTEGER | Auto-incrementing order within session (1=user, 2=assistant) |
| created_at | DATETIME | |

### pinned_responses
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| message_id | UUID | FK → messages.id |
| integration_id | UUID | FK → integrations.id, source chat |
| label | TEXT | User-editable short description |
| content | TEXT | Snapshot of message text (intentionally denormalized — survives session cleanup) |

Unique constraint on `(user_id, message_id)` — a user cannot pin the same message twice.
| created_at | DATETIME | |

The `content` snapshot is intentionally denormalized. If the original session/message is deleted, the pinned response remains usable. Deleting a pin removes the `pinned_responses` row and sets `messages.pinned = false` on the source message (if it still exists).

## API Design

### Auth
| Method | Endpoint | Notes |
|---|---|---|
| POST | /api/auth/login | Returns { access_token, refresh_token, user } |
| POST | /api/auth/refresh | Body: { refresh_token }. Returns { access_token, refresh_token } (rotation). No JWT required. |
| GET | /api/auth/me | Current user profile |

**JWT details:** Access token expires in 30 minutes. Refresh token expires in 7 days, stored in localStorage on the frontend. Refresh tokens are single-use — each refresh issues a new refresh token (rotation). Login is the only unauthenticated endpoint.

### Integrations
| Method | Endpoint | Notes |
|---|---|---|
| GET | /api/integrations | List available (all users) |
| POST | /api/integrations | Create (admin) |
| PUT | /api/integrations/{id} | Update (admin) |
| DELETE | /api/integrations/{id} | Delete (admin) |

### Chat
| Method | Endpoint | Notes |
|---|---|---|
| POST | /api/chat/{integration_id}/send | Send message. Body: { message, pinned_ids?, stream? }. Creates fresh session, dispatches to provider. |
| GET | /api/chat/{integration_id}/sessions | Last 10 sessions for current user |
| GET | /api/chat/{integration_id}/sessions/{id} | Full session with messages |

### Pinned Responses
| Method | Endpoint | Notes |
|---|---|---|
| POST | /api/pins | Pin a message { message_id, label } |
| GET | /api/pins | List user's pinned responses (paginated: ?page=1&page_size=50) |
| PUT | /api/pins/{id} | Update label |
| DELETE | /api/pins/{id} | Unpin |

### Admin
| Method | Endpoint | Notes |
|---|---|---|
| GET | /api/admin/users | List users (paginated: ?page=1&page_size=50) |
| POST | /api/admin/users | Create user |
| PUT | /api/admin/users/{id} | Update (role, reset password) |
| DELETE | /api/admin/users/{id} | Delete user |

All endpoints except `/api/auth/login` and `/api/auth/refresh` require JWT in the Authorization header. Admin endpoints require admin role.

## Cross-Chat Injection Flow

1. User pins an assistant response → saved to `pinned_responses` with a label and content snapshot
2. User switches to another integration, clicks 📌 in input bar → sees list of their pinned responses
3. User selects pinned items, types their message, sends
4. Backend receives `{ message, pinned_ids: [...] }`
5. Backend fetches pinned content and prepends to the request:
   - **RAGFlow:** Prepends to user question as `[Context from {source}]: {content}\n\nUser question: {message}`
   - **OpenAI-compatible:** Adds pinned content as system messages before user message

## Provider Interface

```python
class ChatProvider(ABC):
    @abstractmethod
    async def send_message(
        self,
        message: str,
        context: list[str] | None = None,  # pinned response contents
    ) -> ChatResponse:
        """Send a message and return complete response."""
        ...

    @abstractmethod
    async def stream_message(
        self,
        message: str,
        context: list[str] | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """Send a message and yield response chunks. Final chunk contains metadata."""
        ...

@dataclass
class StreamChunk:
    content: str
    done: bool = False
    references: list[dict] | None = None  # populated on final chunk
    provider_session_id: str | None = None  # populated on final chunk

@dataclass
class ChatResponse:
    content: str
    references: list[dict] | None = None  # RAGFlow citations
    provider_session_id: str | None = None  # RAGFlow session ID
```

- `RagflowProvider`: Creates a fresh RAGFlow session, calls `session.ask()`, returns `provider_session_id`
- `OpenAICompatProvider`: Builds messages array with system prompt + context + user message, POSTs to `/chat/completions`

## Frontend Structure

**Tech:** React + TypeScript, Zustand for state, Axios for API calls, Nginx for serving + reverse proxy.

**Pages:**
- Login page
- Main chat page (sidebar + chat window)
- Admin panel (integrations + user management)

**Key components:**
- `Layout` — sidebar + main content shell
- `IntegrationList` — left sidebar, shows available integrations with provider badges
- `SessionHistory` — below integration list, last 10 sessions for active integration
- `ChatWindow` — message display with streaming support
- `MessageBubble` — individual message with pin/copy actions, RAGFlow references
- `PinSelector` — modal/popover for selecting pinned responses to inject
- `AdminPanel` — integration CRUD + user management

## Project Structure

```
edgeai/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── auth/
│   │   │   ├── router.py
│   │   │   ├── dependencies.py
│   │   │   └── utils.py
│   │   ├── integrations/
│   │   │   ├── router.py
│   │   │   └── schemas.py
│   │   ├── chat/
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── providers/
│   │   │       ├── base.py
│   │   │       ├── ragflow.py
│   │   │       └── openai.py
│   │   ├── pins/
│   │   │   ├── router.py
│   │   │   └── schemas.py
│   │   └── admin/
│   │       └── router.py
│   └── alembic/ (optional)
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── store/
│   └── nginx.conf
└── data/ (SQLite volume mount)
```

## Deployment

```yaml
services:
  backend:
    build: ./backend
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=sqlite:///data/edgeai.db
    volumes:
      - ./data:/app/data
    # No ports exposed — only accessible via frontend Nginx reverse proxy
    expose:
      - "8000"

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
```

Single `docker-compose up` to run. SQLite persists in `data/` volume.

## Bootstrapping

On first startup, if no users exist in the database, the backend creates a default admin user from environment variables:
- `ADMIN_USERNAME` (default: `admin`)
- `ADMIN_PASSWORD` (required, no default — app refuses to start without it on first run)

The admin can then create additional users via the admin panel.

## Security

- Passwords hashed with bcrypt
- JWT tokens: 30 min access + 7 day refresh (rotation)
- All routes behind `get_current_user` dependency
- Admin routes behind `require_admin` dependency
- API keys (RAGFlow, OpenAI) stored server-side only, never exposed to frontend
- CORS restricted to frontend origin
- SQLite WAL mode with `busy_timeout=5000ms` for concurrent read safety

## SQLite Concurrency

Messages are written to the database only after the full response is assembled (not chunk-by-chunk during streaming). The streaming SSE connection holds no database resources — chunks go directly from the provider to the client. This keeps write contention minimal. SQLite WAL mode with `busy_timeout=5000ms` handles the expected concurrent writer load (10-20 simultaneous users).

## Error Handling

All error responses follow FastAPI's default format:
```json
{ "detail": "error message" }
```

Standard HTTP status codes: 400 (bad request), 401 (unauthorized/expired JWT), 403 (forbidden/not admin), 404 (not found), 422 (validation error).

Provider errors (RAGFlow down, OpenAI rate limit, network timeout) return 502 with a user-friendly message. Details are logged server-side. During streaming, provider failures emit an SSE `error` event; the frontend shows a retry option.

## Out of Scope

- Email/password reset (admin resets manually)
- File uploads (RAGFlow manages its own knowledge bases)
- Multi-tenant isolation (single org)
- Rate limiting (trusted internal users)
- Audit logging beyond session/message history
- Automatic session cleanup (sessions persist indefinitely; "last 10" is a UI display limit, not a storage limit)
