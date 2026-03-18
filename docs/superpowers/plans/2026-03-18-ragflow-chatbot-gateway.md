# EdgeAI RAGFlow Chat Gateway — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that wraps RAGFlow and OpenAI-compatible APIs behind a unified chat UI with user management, session history, and cross-chat context injection.

**Architecture:** FastAPI backend with SQLite (WAL mode), provider abstraction for RAGFlow and OpenAI-compatible APIs. React + TypeScript frontend with Zustand state. Docker Compose for deployment. Single question→answer sessions with pinned response injection across chats.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, ragflow-sdk, httpx, bcrypt, python-jose. React 18, TypeScript, Vite, Zustand, Axios. Docker, Nginx.

**Spec:** `docs/superpowers/specs/2026-03-18-ragflow-chatbot-gateway-design.md`

**Implementation Notes:**
- Each Python package directory (`app/auth/`, `app/chat/`, `app/chat/providers/`, `app/integrations/`, `app/pins/`, `app/admin/`) needs an empty `__init__.py` file. Create these when the first file in that directory is created.
- The spec requires refresh token rotation (single-use). This plan uses stateless JWTs for refresh tokens, meaning old refresh tokens remain valid until they expire. True rotation would require a server-side token store. This is an acceptable simplification for the 10-100 user scale — add a token blacklist table later if needed.
- The spec's project structure lists `providers/openai.py` but this plan uses `providers/openai_compat.py` to avoid shadowing Python's `openai` package. This is intentional.

---

## File Map

### Backend (`backend/`)

| File | Responsibility |
|---|---|
| `requirements.txt` | Python dependencies |
| `Dockerfile` | Backend container image |
| `app/main.py` | FastAPI app, CORS, lifespan (admin bootstrap, DB init) |
| `app/config.py` | Pydantic Settings: env vars (SECRET_KEY, ADMIN_USERNAME, ADMIN_PASSWORD, DATABASE_URL) |
| `app/database.py` | SQLAlchemy async engine, sessionmaker, WAL mode, `get_db` dependency |
| `app/models.py` | ORM models: User, Integration, Session, Message, PinnedResponse |
| `app/auth/utils.py` | `hash_password`, `verify_password`, `create_access_token`, `create_refresh_token`, `decode_token` |
| `app/auth/dependencies.py` | `get_current_user`, `require_admin` FastAPI dependencies |
| `app/auth/router.py` | POST /login, POST /refresh, GET /me |
| `app/auth/schemas.py` | Pydantic: LoginRequest, TokenResponse, UserResponse |
| `app/integrations/router.py` | CRUD for integrations (admin-only create/update/delete) |
| `app/integrations/schemas.py` | Pydantic: IntegrationCreate, IntegrationUpdate, IntegrationResponse |
| `app/chat/providers/base.py` | ABC `ChatProvider`, `ChatResponse`, `StreamChunk` dataclasses |
| `app/chat/providers/openai_compat.py` | `OpenAICompatProvider` using httpx |
| `app/chat/providers/ragflow.py` | `RagflowProvider` using ragflow-sdk |
| `app/chat/providers/factory.py` | `get_provider(integration) -> ChatProvider` |
| `app/chat/router.py` | POST /send, GET /sessions, GET /sessions/{id} |
| `app/chat/schemas.py` | Pydantic: SendMessageRequest, SessionResponse, MessageResponse |
| `app/pins/router.py` | CRUD for pinned responses |
| `app/pins/schemas.py` | Pydantic: PinCreate, PinUpdate, PinResponse |
| `app/admin/router.py` | User management (admin-only) |
| `app/admin/schemas.py` | Pydantic: UserCreate, UserUpdate |
| `tests/conftest.py` | Fixtures: test client, test DB, test user, test admin |
| `tests/test_auth.py` | Auth endpoint tests |
| `tests/test_integrations.py` | Integration CRUD tests |
| `tests/test_chat.py` | Chat send/session tests (mocked providers) |
| `tests/test_pins.py` | Pin CRUD + injection tests |
| `tests/test_admin.py` | Admin user management tests |
| `tests/test_providers.py` | Provider unit tests (mocked external APIs) |

### Frontend (`frontend/`)

| File | Responsibility |
|---|---|
| `package.json` | Dependencies and scripts |
| `Dockerfile` | Multi-stage: build React + serve with Nginx |
| `nginx.conf` | Serve static + reverse proxy /api to backend |
| `tsconfig.json` | TypeScript config |
| `vite.config.ts` | Vite config with proxy for dev |
| `src/main.tsx` | React entry point |
| `src/App.tsx` | Router setup, auth guard |
| `src/api/client.ts` | Axios instance with JWT interceptor + refresh logic |
| `src/api/auth.ts` | login, refresh, getMe API calls |
| `src/api/integrations.ts` | list, create, update, delete |
| `src/api/chat.ts` | sendMessage (with SSE), getSessions, getSession |
| `src/api/pins.ts` | list, create, update, delete |
| `src/api/admin.ts` | listUsers, createUser, updateUser, deleteUser |
| `src/store/authStore.ts` | Zustand: user, tokens, login/logout/refresh |
| `src/store/chatStore.ts` | Zustand: activeIntegration, sessions, messages, streaming state |
| `src/store/pinStore.ts` | Zustand: pinned responses, selected pins for injection |
| `src/pages/LoginPage.tsx` | Login form |
| `src/pages/ChatPage.tsx` | Main layout: sidebar + chat window |
| `src/pages/AdminPage.tsx` | Admin panel: integrations + users |
| `src/components/Layout.tsx` | App shell with top nav |
| `src/components/IntegrationList.tsx` | Sidebar integration selector |
| `src/components/SessionHistory.tsx` | Recent sessions for active integration |
| `src/components/ChatWindow.tsx` | Message display + input area |
| `src/components/MessageBubble.tsx` | Single message with pin/copy actions, references |
| `src/components/PinSelector.tsx` | Modal/popover for selecting pins to inject |
| `src/components/PinnedBanner.tsx` | Yellow banner showing injected context |
| `src/components/AdminPanel.tsx` | Integration CRUD forms |
| `src/components/UserManagement.tsx` | User CRUD table |

### Root

| File | Responsibility |
|---|---|
| `docker-compose.yml` | Orchestrates backend + frontend |
| `.env.example` | Template for required env vars |
| `.gitignore` | Standard Python + Node + data/ + .superpowers/ |

---

## Task 1: Project Scaffolding + Git Init

**Files:**
- Create: `.gitignore`, `.env.example`, `backend/requirements.txt`, `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/database.py`, `backend/app/main.py`, `backend/tests/__init__.py`, `backend/tests/conftest.py`

- [ ] **Step 1: Initialize git repo and create .gitignore**

```bash
cd /home/thanh-tran/EdgeAI
git init
```

`.gitignore`:
```
__pycache__/
*.pyc
.env
data/
.superpowers/
node_modules/
dist/
.vite/
*.egg-info/
.pytest_cache/
```

- [ ] **Step 2: Create .env.example**

`.env.example`:
```
SECRET_KEY=change-me-to-a-random-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
DATABASE_URL=sqlite+aiosqlite:///data/edgeai.db
```

- [ ] **Step 3: Create backend/requirements.txt**

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy[asyncio]==2.0.36
aiosqlite==0.20.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
pydantic-settings==2.7.1
httpx==0.28.1
ragflow-sdk==0.16.0
python-multipart==0.0.20
sse-starlette==2.2.1
pytest==8.3.4
pytest-asyncio==0.25.0
```

- [ ] **Step 4: Create backend/app/config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret_key: str
    admin_username: str = "admin"
    admin_password: str = ""
    database_url: str = "sqlite+aiosqlite:///data/edgeai.db"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    model_config = {"env_file": ".env"}


settings = Settings()
```

- [ ] **Step 5: Create backend/app/database.py**

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.config import settings


engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    async with engine.begin() as conn:
        # Enable WAL mode and busy_timeout for SQLite
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.execute(text("PRAGMA busy_timeout=5000"))
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with async_session() as session:
        yield session
```

- [ ] **Step 6: Create backend/app/main.py (minimal)**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="EdgeAI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Create test conftest with fixtures**

`backend/tests/conftest.py`:
```python
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.database import Base, get_db
from app.main import app


TEST_DATABASE_URL = "sqlite+aiosqlite://"  # in-memory

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

- [ ] **Step 8: Run health check test to verify scaffolding**

Create `backend/tests/test_health.py`:
```python
import pytest


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

Run: `cd backend && pip install -r requirements.txt && python -m pytest tests/test_health.py -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add .gitignore .env.example backend/
git commit -m "feat: backend scaffolding with FastAPI, SQLAlchemy, SQLite WAL mode"
```

---

## Task 2: Database Models

**Files:**
- Create: `backend/app/models.py`
- Test: `backend/tests/test_models.py`

- [ ] **Step 1: Write model test**

`backend/tests/test_models.py`:
```python
import pytest
from sqlalchemy import select
from app.models import User, Integration, Session, Message, PinnedResponse
import uuid


@pytest.mark.asyncio
async def test_create_user(setup_db):
    from tests.conftest import TestingSessionLocal
    async with TestingSessionLocal() as db:
        user = User(
            id=uuid.uuid4(),
            username="testuser",
            password_hash="fakehash",
            role="user",
        )
        db.add(user)
        await db.commit()
        result = await db.execute(select(User).where(User.username == "testuser"))
        fetched = result.scalar_one()
        assert fetched.username == "testuser"
        assert fetched.role == "user"


@pytest.mark.asyncio
async def test_create_integration(setup_db):
    from tests.conftest import TestingSessionLocal
    async with TestingSessionLocal() as db:
        user = User(id=uuid.uuid4(), username="admin", password_hash="h", role="admin")
        db.add(user)
        await db.commit()

        integration = Integration(
            id=uuid.uuid4(),
            name="Marketing",
            provider_type="ragflow",
            provider_config='{"base_url":"http://localhost:9380","api_key":"test","chat_id":"abc","type":"chat"}',
            updated_by=user.id,
        )
        db.add(integration)
        await db.commit()
        result = await db.execute(select(Integration).where(Integration.name == "Marketing"))
        fetched = result.scalar_one()
        assert fetched.provider_type == "ragflow"


@pytest.mark.asyncio
async def test_pinned_response_unique_constraint(setup_db):
    from tests.conftest import TestingSessionLocal
    from sqlalchemy.exc import IntegrityError
    async with TestingSessionLocal() as db:
        user_id = uuid.uuid4()
        integration_id = uuid.uuid4()
        session_id = uuid.uuid4()
        msg_id = uuid.uuid4()

        user = User(id=user_id, username="u", password_hash="h", role="user")
        integration = Integration(id=integration_id, name="Test", provider_type="ragflow", provider_config="{}", updated_by=user_id)
        session = Session(id=session_id, user_id=user_id, integration_id=integration_id, title="t")
        message = Message(id=msg_id, session_id=session_id, role="assistant", content="resp", sequence=2)
        db.add_all([user, integration, session, message])
        await db.commit()

        pin1 = PinnedResponse(id=uuid.uuid4(), user_id=user_id, message_id=msg_id, integration_id=integration_id, label="pin1", content="resp")
        db.add(pin1)
        await db.commit()

        pin2 = PinnedResponse(id=uuid.uuid4(), user_id=user_id, message_id=msg_id, integration_id=integration_id, label="pin2", content="resp")
        db.add(pin2)
        with pytest.raises(IntegrityError):
            await db.commit()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_models.py -v`
Expected: FAIL (models not defined)

- [ ] **Step 3: Implement models**

`backend/app/models.py`:
```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_uuid)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")  # "admin" or "user"
    created_at = Column(DateTime, default=utcnow)
    last_login = Column(DateTime, nullable=True)


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(String, primary_key=True, default=new_uuid)
    name = Column(String, nullable=False)
    provider_type = Column(String, nullable=False)  # "ragflow" or "openai_compatible"
    provider_config = Column(Text, nullable=False)  # JSON string
    description = Column(Text, nullable=True)
    icon = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_by = Column(String, ForeignKey("users.id"), nullable=False)


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=new_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    integration_id = Column(String, ForeignKey("integrations.id"), nullable=False)
    ragflow_session_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    messages = relationship("Message", back_populates="session", order_by="Message.sequence")
    integration = relationship("Integration")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=new_uuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    references = Column(Text, nullable=True)  # serialized JSON
    pinned = Column(Boolean, default=False)
    sequence = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    session = relationship("Session", back_populates="messages")


class PinnedResponse(Base):
    __tablename__ = "pinned_responses"
    __table_args__ = (
        UniqueConstraint("user_id", "message_id", name="uq_user_message_pin"),
    )

    id = Column(String, primary_key=True, default=new_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    message_id = Column(String, ForeignKey("messages.id"), nullable=False)
    integration_id = Column(String, ForeignKey("integrations.id"), nullable=False)
    label = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    message = relationship("Message")
    integration = relationship("Integration")
```

- [ ] **Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_models.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/tests/test_models.py
git commit -m "feat: SQLAlchemy ORM models for users, integrations, sessions, messages, pins"
```

---

## Task 3: Auth Module — Utils + Dependencies

**Files:**
- Create: `backend/app/auth/__init__.py`, `backend/app/auth/utils.py`, `backend/app/auth/dependencies.py`, `backend/app/auth/schemas.py`
- Test: `backend/tests/test_auth.py`

- [ ] **Step 1: Write auth utils tests**

`backend/tests/test_auth.py`:
```python
import pytest
from app.auth.utils import hash_password, verify_password, create_access_token, create_refresh_token, decode_token


def test_password_hash_and_verify():
    hashed = hash_password("mysecret")
    assert hashed != "mysecret"
    assert verify_password("mysecret", hashed) is True
    assert verify_password("wrong", hashed) is False


def test_access_token_roundtrip():
    token = create_access_token({"sub": "user123", "role": "admin"})
    payload = decode_token(token)
    assert payload["sub"] == "user123"
    assert payload["role"] == "admin"
    assert payload["type"] == "access"


def test_refresh_token_roundtrip():
    token = create_refresh_token({"sub": "user123"})
    payload = decode_token(token)
    assert payload["sub"] == "user123"
    assert payload["type"] == "refresh"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_auth.py::test_password_hash_and_verify -v`
Expected: FAIL

- [ ] **Step 3: Implement auth utils**

`backend/app/auth/utils.py`:
```python
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt, JWTError
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
```

- [ ] **Step 4: Implement auth schemas**

`backend/app/auth/schemas.py`:
```python
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: "UserResponse"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    username: str
    role: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 5: Implement auth dependencies**

`backend/app/auth/dependencies.py`:
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError
from app.database import get_db
from app.models import User
from app.auth.utils import decode_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
```

- [ ] **Step 6: Run all auth tests**

Run: `cd backend && python -m pytest tests/test_auth.py -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/auth/
git commit -m "feat: auth utils (bcrypt, JWT), dependencies (get_current_user, require_admin)"
```

---

## Task 4: Auth Router + Admin Bootstrapping

**Files:**
- Create: `backend/app/auth/router.py`
- Modify: `backend/app/main.py` (add router + bootstrap)
- Test: `backend/tests/test_auth_routes.py`

- [ ] **Step 1: Write auth route tests**

`backend/tests/test_auth_routes.py`:
```python
import pytest
from app.auth.utils import hash_password


@pytest.mark.asyncio
async def test_login_success(client):
    # Bootstrap creates admin user, so login with those credentials
    # We need to create a user first
    from tests.conftest import TestingSessionLocal
    from app.models import User
    import uuid
    async with TestingSessionLocal() as db:
        user = User(
            id=str(uuid.uuid4()),
            username="testuser",
            password_hash=hash_password("testpass"),
            role="user",
        )
        db.add(user)
        await db.commit()

    response = await client.post("/api/auth/login", json={"username": "testuser", "password": "testpass"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["username"] == "testuser"


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    import uuid
    async with TestingSessionLocal() as db:
        user = User(id=str(uuid.uuid4()), username="u", password_hash=hash_password("right"), role="user")
        db.add(user)
        await db.commit()

    response = await client.post("/api/auth/login", json={"username": "u", "password": "wrong"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    import uuid
    async with TestingSessionLocal() as db:
        user = User(id=str(uuid.uuid4()), username="r", password_hash=hash_password("p"), role="user")
        db.add(user)
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "r", "password": "p"})
    refresh_token = login.json()["refresh_token"]

    response = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert "refresh_token" in response.json()


@pytest.mark.asyncio
async def test_me_endpoint(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    import uuid
    async with TestingSessionLocal() as db:
        user = User(id=str(uuid.uuid4()), username="me", password_hash=hash_password("p"), role="admin")
        db.add(user)
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "me", "password": "p"})
    token = login.json()["access_token"]

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["username"] == "me"
    assert response.json()["role"] == "admin"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_auth_routes.py -v`
Expected: FAIL (no routes)

- [ ] **Step 3: Implement auth router**

`backend/app/auth/router.py`:
```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User
from app.auth.utils import verify_password, create_access_token, create_refresh_token, decode_token
from app.auth.schemas import LoginRequest, TokenResponse, RefreshRequest, UserResponse
from app.auth.dependencies import get_current_user
from jose import JWTError

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    token_data = {"sub": user.id, "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    token_data = {"sub": user.id, "role": user.role}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
    }


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)
```

- [ ] **Step 4: Add admin bootstrap to main.py lifespan and register router**

Update `backend/app/main.py`:
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from app.database import init_db, async_session
from app.config import settings
from app.models import User
from app.auth.utils import hash_password
from app.auth.router import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Bootstrap admin user
    async with async_session() as db:
        result = await db.execute(select(User).limit(1))
        if not result.scalar_one_or_none():
            if not settings.admin_password:
                raise RuntimeError("ADMIN_PASSWORD is required on first run (no users exist)")
            admin = User(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
                role="admin",
            )
            db.add(admin)
            await db.commit()
    yield


app = FastAPI(title="EdgeAI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Run all auth tests**

Run: `cd backend && python -m pytest tests/test_auth_routes.py tests/test_auth.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/auth/router.py backend/app/main.py backend/tests/test_auth_routes.py
git commit -m "feat: auth router (login, refresh, me) with admin bootstrapping"
```

---

## Task 5: Integrations CRUD

**Files:**
- Create: `backend/app/integrations/__init__.py`, `backend/app/integrations/router.py`, `backend/app/integrations/schemas.py`
- Modify: `backend/app/main.py` (register router)
- Test: `backend/tests/test_integrations.py`

- [ ] **Step 1: Write integration tests**

`backend/tests/test_integrations.py`:
```python
import pytest
from app.auth.utils import hash_password
import uuid


async def create_admin_and_login(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    uid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="admin", password_hash=hash_password("admin"), role="admin")
        db.add(user)
        await db.commit()
    login = await client.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    return login.json()["access_token"]


async def create_user_and_login(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    uid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="user1", password_hash=hash_password("pass"), role="user")
        db.add(user)
        await db.commit()
    login = await client.post("/api/auth/login", json={"username": "user1", "password": "pass"})
    return login.json()["access_token"]


@pytest.mark.asyncio
async def test_create_integration_admin(client):
    token = await create_admin_and_login(client)
    response = await client.post(
        "/api/integrations",
        json={"name": "Marketing", "provider_type": "ragflow", "provider_config": {"base_url": "http://localhost:9380", "api_key": "key", "chat_id": "abc", "type": "chat"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Marketing"
    assert response.json()["provider_type"] == "ragflow"


@pytest.mark.asyncio
async def test_create_integration_non_admin_forbidden(client):
    await create_admin_and_login(client)  # need admin to exist
    token = await create_user_and_login(client)
    response = await client.post(
        "/api/integrations",
        json={"name": "Test", "provider_type": "ragflow", "provider_config": {}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_integrations(client):
    token = await create_admin_and_login(client)
    await client.post(
        "/api/integrations",
        json={"name": "Chat1", "provider_type": "ragflow", "provider_config": {"base_url": "x", "api_key": "k", "chat_id": "c", "type": "chat"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    user_token = await create_user_and_login(client)
    response = await client.get("/api/integrations", headers={"Authorization": f"Bearer {user_token}"})
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_update_integration(client):
    token = await create_admin_and_login(client)
    create = await client.post(
        "/api/integrations",
        json={"name": "Old", "provider_type": "ragflow", "provider_config": {"base_url": "x", "api_key": "k", "chat_id": "c", "type": "chat"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    iid = create.json()["id"]
    response = await client.put(
        f"/api/integrations/{iid}",
        json={"name": "New"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "New"


@pytest.mark.asyncio
async def test_delete_integration(client):
    token = await create_admin_and_login(client)
    create = await client.post(
        "/api/integrations",
        json={"name": "Del", "provider_type": "ragflow", "provider_config": {"base_url": "x", "api_key": "k", "chat_id": "c", "type": "chat"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    iid = create.json()["id"]
    response = await client.delete(f"/api/integrations/{iid}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_integrations.py -v`
Expected: FAIL

- [ ] **Step 3: Implement integration schemas**

`backend/app/integrations/schemas.py`:
```python
from pydantic import BaseModel
from typing import Any


class IntegrationCreate(BaseModel):
    name: str
    provider_type: str  # "ragflow" or "openai_compatible"
    provider_config: dict[str, Any]
    description: str | None = None
    icon: str | None = None


class IntegrationUpdate(BaseModel):
    name: str | None = None
    provider_config: dict[str, Any] | None = None
    description: str | None = None
    icon: str | None = None


class IntegrationResponse(BaseModel):
    id: str
    name: str
    provider_type: str
    description: str | None
    icon: str | None

    model_config = {"from_attributes": True}
```

Note: `IntegrationResponse` deliberately excludes `provider_config` — API keys must not leak to frontend.

- [ ] **Step 4: Implement integration router**

`backend/app/integrations/router.py`:
```python
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Integration, User
from app.auth.dependencies import get_current_user, require_admin
from app.integrations.schemas import IntegrationCreate, IntegrationUpdate, IntegrationResponse

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("", response_model=list[IntegrationResponse])
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Integration).order_by(Integration.created_at))
    return [IntegrationResponse.model_validate(i) for i in result.scalars().all()]


@router.post("", response_model=IntegrationResponse, status_code=201)
async def create_integration(
    body: IntegrationCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    integration = Integration(
        name=body.name,
        provider_type=body.provider_type,
        provider_config=json.dumps(body.provider_config),
        description=body.description,
        icon=body.icon,
        updated_by=admin.id,
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return IntegrationResponse.model_validate(integration)


@router.put("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: str,
    body: IntegrationUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    if body.name is not None:
        integration.name = body.name
    if body.provider_config is not None:
        integration.provider_config = json.dumps(body.provider_config)
    if body.description is not None:
        integration.description = body.description
    if body.icon is not None:
        integration.icon = body.icon
    integration.updated_by = admin.id

    await db.commit()
    await db.refresh(integration)
    return IntegrationResponse.model_validate(integration)


@router.delete("/{integration_id}", status_code=204)
async def delete_integration(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    await db.delete(integration)
    await db.commit()
```

- [ ] **Step 5: Register router in main.py**

Add to `backend/app/main.py`:
```python
from app.integrations.router import router as integrations_router
# ... after auth_router
app.include_router(integrations_router)
```

- [ ] **Step 6: Run tests**

Run: `cd backend && python -m pytest tests/test_integrations.py -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/integrations/ backend/app/main.py backend/tests/test_integrations.py
git commit -m "feat: integrations CRUD (admin-only create/update/delete)"
```

---

## Task 6: Provider Interface + OpenAI-Compatible Provider

**Files:**
- Create: `backend/app/chat/__init__.py`, `backend/app/chat/providers/__init__.py`, `backend/app/chat/providers/base.py`, `backend/app/chat/providers/openai_compat.py`, `backend/app/chat/providers/factory.py`
- Test: `backend/tests/test_providers.py`

- [ ] **Step 1: Write provider tests**

`backend/tests/test_providers.py`:
```python
import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from app.chat.providers.base import ChatProvider, ChatResponse, StreamChunk
from app.chat.providers.openai_compat import OpenAICompatProvider
from app.chat.providers.factory import get_provider
from app.models import Integration


def test_chat_response_dataclass():
    r = ChatResponse(content="hello", references=None, provider_session_id=None)
    assert r.content == "hello"


def test_stream_chunk_dataclass():
    c = StreamChunk(content="hi", done=False)
    assert c.done is False
    c2 = StreamChunk(content="", done=True, references=[{"doc": "test"}], provider_session_id="sid")
    assert c2.done is True


@pytest.mark.asyncio
async def test_openai_compat_send_message():
    config = {
        "base_url": "https://api.example.com/v1",
        "api_key": "sk-test",
        "model": "gpt-4",
        "system_prompt": "You are helpful.",
        "parameters": {"temperature": 0.7, "max_tokens": 100},
    }
    provider = OpenAICompatProvider(config)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "Hello from LLM"}}]
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.send_message("Hi", context=["some context"])
        assert isinstance(result, ChatResponse)
        assert result.content == "Hello from LLM"


def test_get_provider_openai():
    integration = MagicMock(spec=Integration)
    integration.provider_type = "openai_compatible"
    integration.provider_config = json.dumps({
        "base_url": "https://api.example.com/v1",
        "api_key": "sk-test",
        "model": "gpt-4",
        "system_prompt": "Hi",
    })
    provider = get_provider(integration)
    assert isinstance(provider, OpenAICompatProvider)


def test_get_provider_unknown_raises():
    integration = MagicMock(spec=Integration)
    integration.provider_type = "unknown"
    integration.provider_config = "{}"
    with pytest.raises(ValueError, match="Unknown provider"):
        get_provider(integration)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_providers.py -v`
Expected: FAIL

- [ ] **Step 3: Implement base provider**

`backend/app/chat/providers/base.py`:
```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncGenerator


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
    ) -> ChatResponse:
        ...

    @abstractmethod
    async def stream_message(
        self,
        message: str,
        context: list[str] | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        ...
```

- [ ] **Step 4: Implement OpenAI-compatible provider**

`backend/app/chat/providers/openai_compat.py`:
```python
import json
from typing import AsyncGenerator
import httpx
from app.chat.providers.base import ChatProvider, ChatResponse, StreamChunk


class OpenAICompatProvider(ChatProvider):
    def __init__(self, config: dict):
        self.base_url = config["base_url"].rstrip("/")
        self.api_key = config["api_key"]
        self.model = config["model"]
        self.system_prompt = config.get("system_prompt", "")
        self.parameters = config.get("parameters", {})

    def _build_messages(self, message: str, context: list[str] | None = None) -> list[dict]:
        messages = []
        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})
        if context:
            for ctx in context:
                messages.append({"role": "system", "content": f"[Injected context]: {ctx}"})
        messages.append({"role": "user", "content": message})
        return messages

    async def send_message(self, message: str, context: list[str] | None = None) -> ChatResponse:
        messages = self._build_messages(message, context)
        payload = {"model": self.model, "messages": messages, "stream": False, **self.parameters}

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return ChatResponse(content=content)

    async def stream_message(self, message: str, context: list[str] | None = None) -> AsyncGenerator[StreamChunk, None]:
        messages = self._build_messages(message, context)
        payload = {"model": self.model, "messages": messages, "stream": True, **self.parameters}

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                timeout=120.0,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        yield StreamChunk(content="", done=True)
                        return
                    data = json.loads(data_str)
                    delta = data["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield StreamChunk(content=content)
        yield StreamChunk(content="", done=True)
```

- [ ] **Step 5: Implement provider factory**

`backend/app/chat/providers/factory.py`:
```python
import json
from app.models import Integration
from app.chat.providers.base import ChatProvider
from app.chat.providers.openai_compat import OpenAICompatProvider


def get_provider(integration: Integration) -> ChatProvider:
    config = json.loads(integration.provider_config)

    if integration.provider_type == "openai_compatible":
        return OpenAICompatProvider(config)
    elif integration.provider_type == "ragflow":
        from app.chat.providers.ragflow import RagflowProvider
        return RagflowProvider(config)
    else:
        raise ValueError(f"Unknown provider type: {integration.provider_type}")
```

- [ ] **Step 6: Run tests**

Run: `cd backend && python -m pytest tests/test_providers.py -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/chat/
git commit -m "feat: provider interface + OpenAI-compatible provider with streaming"
```

---

## Task 7: RAGFlow Provider

**Files:**
- Create: `backend/app/chat/providers/ragflow.py`
- Test: `backend/tests/test_ragflow_provider.py`

- [ ] **Step 1: Write RAGFlow provider tests**

`backend/tests/test_ragflow_provider.py`:
```python
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.chat.providers.ragflow import RagflowProvider
from app.chat.providers.base import ChatResponse


@pytest.mark.asyncio
async def test_ragflow_send_message():
    config = {
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
    }
    provider = RagflowProvider(config)

    mock_session = MagicMock()
    mock_session.id = "session-123"

    # Mock the ask method to return a message-like object
    mock_message = MagicMock()
    mock_message.content = "Optimized query result"
    mock_message.reference = []
    mock_session.ask = MagicMock(return_value=iter([mock_message]))

    mock_chat = MagicMock()
    mock_chat.create_session.return_value = mock_session

    mock_rag = MagicMock()
    mock_rag.list_chats.return_value = [mock_chat]

    with patch("app.chat.providers.ragflow.RAGFlow", return_value=mock_rag):
        result = await provider.send_message("Optimize this query", context=["some context"])
        assert isinstance(result, ChatResponse)
        assert result.content == "Optimized query result"
        assert result.provider_session_id == "session-123"


@pytest.mark.asyncio
async def test_ragflow_send_with_context_prepends():
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

    with patch("app.chat.providers.ragflow.RAGFlow", return_value=mock_rag):
        await provider.send_message("my question", context=["ctx1", "ctx2"])
        assert "[Injected context]:" in captured_question
        assert "my question" in captured_question
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_ragflow_provider.py -v`
Expected: FAIL

- [ ] **Step 3: Implement RAGFlow provider**

`backend/app/chat/providers/ragflow.py`:
```python
import json
from typing import AsyncGenerator
from ragflow_sdk import RAGFlow
from app.chat.providers.base import ChatProvider, ChatResponse, StreamChunk


class RagflowProvider(ChatProvider):
    def __init__(self, config: dict):
        self.base_url = config["base_url"]
        self.api_key = config["api_key"]
        self.chat_or_agent_id = config.get("chat_id") or config.get("agent_id")
        self.entity_type = config.get("type", "chat")  # "chat" or "agent"

    def _get_entity(self, rag: RAGFlow):
        if self.entity_type == "chat":
            chats = rag.list_chats(id=self.chat_or_agent_id)
            if not chats:
                raise ValueError(f"RAGFlow chat {self.chat_or_agent_id} not found")
            return chats[0]
        else:
            agents = rag.list_agents(id=self.chat_or_agent_id)
            if not agents:
                raise ValueError(f"RAGFlow agent {self.chat_or_agent_id} not found")
            return agents[0]

    def _build_question(self, message: str, context: list[str] | None = None) -> str:
        if not context:
            return message
        ctx_parts = [f"[Injected context]: {c}" for c in context]
        return "\n\n".join(ctx_parts) + f"\n\nUser question: {message}"

    def _extract_references(self, message_obj) -> list[dict] | None:
        refs = getattr(message_obj, "reference", None)
        if not refs:
            return None
        if isinstance(refs, list):
            result = []
            for ref in refs:
                result.append({
                    "content": getattr(ref, "content", ""),
                    "document_name": getattr(ref, "document_name", ""),
                    "similarity": getattr(ref, "similarity", 0),
                })
            return result if result else None
        return None

    async def send_message(self, message: str, context: list[str] | None = None) -> ChatResponse:
        rag = RAGFlow(api_key=self.api_key, base_url=self.base_url)
        entity = self._get_entity(rag)
        session = entity.create_session()
        question = self._build_question(message, context)

        full_content = ""
        references = None
        for chunk in session.ask(question, stream=False):
            full_content = chunk.content
            references = self._extract_references(chunk)

        return ChatResponse(
            content=full_content,
            references=references,
            provider_session_id=session.id,
        )

    async def stream_message(self, message: str, context: list[str] | None = None) -> AsyncGenerator[StreamChunk, None]:
        rag = RAGFlow(api_key=self.api_key, base_url=self.base_url)
        entity = self._get_entity(rag)
        session = entity.create_session()
        question = self._build_question(message, context)

        last_content = ""
        references = None
        for chunk in session.ask(question, stream=True):
            new_text = chunk.content[len(last_content):]
            last_content = chunk.content
            references = self._extract_references(chunk)
            if new_text:
                yield StreamChunk(content=new_text)

        yield StreamChunk(
            content="",
            done=True,
            references=references,
            provider_session_id=session.id,
        )
```

- [ ] **Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_ragflow_provider.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/chat/providers/ragflow.py backend/tests/test_ragflow_provider.py
git commit -m "feat: RAGFlow provider with chat/agent support and streaming"
```

---

## Task 8: Chat Router (Send + Sessions)

**Files:**
- Create: `backend/app/chat/router.py`, `backend/app/chat/schemas.py`
- Modify: `backend/app/main.py` (register router)
- Test: `backend/tests/test_chat.py`

- [ ] **Step 1: Write chat route tests**

`backend/tests/test_chat.py`:
```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_chat.py -v`
Expected: FAIL

- [ ] **Step 3: Implement chat schemas**

`backend/app/chat/schemas.py`:
```python
from datetime import datetime
from pydantic import BaseModel


class SendMessageRequest(BaseModel):
    message: str
    pinned_ids: list[str] | None = None
    stream: bool = False


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    references: str | None = None
    pinned: bool
    sequence: int

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    id: str
    integration_id: str
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionDetailResponse(BaseModel):
    id: str
    integration_id: str
    title: str
    messages: list[MessageResponse]

    model_config = {"from_attributes": True}


class SendMessageResponse(BaseModel):
    session_id: str
    assistant_message: MessageResponse
```

- [ ] **Step 4: Implement chat router**

`backend/app/chat/router.py`:
```python
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Integration, Session, Message, PinnedResponse, User
from app.auth.dependencies import get_current_user
from app.chat.schemas import SendMessageRequest, SendMessageResponse, SessionResponse, SessionDetailResponse, MessageResponse
from app.chat.providers.factory import get_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/{integration_id}/send")
async def send_message(
    integration_id: str,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Fetch integration
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # Fetch pinned context if provided
    context = None
    if body.pinned_ids:
        pin_result = await db.execute(
            select(PinnedResponse).where(
                PinnedResponse.id.in_(body.pinned_ids),
                PinnedResponse.user_id == user.id,
            )
        )
        pins = pin_result.scalars().all()
        context = [p.content for p in pins]

    # Create session
    title = body.message[:80] + ("..." if len(body.message) > 80 else "")
    session = Session(
        user_id=user.id,
        integration_id=integration_id,
        title=title,
    )
    db.add(session)
    await db.flush()

    # Save user message
    user_msg = Message(
        session_id=session.id,
        role="user",
        content=body.message,
        sequence=1,
    )
    db.add(user_msg)

    # Handle streaming separately
    if body.stream:
        await db.commit()
        return await _stream_response(integration, session.id, body.message, context)

    # Non-streaming: send message
    provider = get_provider(integration)
    try:
        response = await provider.send_message(body.message, context=context)
    except Exception as e:
        logger.error(f"Provider error: {e}")
        raise HTTPException(status_code=502, detail="Chat provider is unavailable")

    # Save assistant message
    assistant_msg = Message(
        session_id=session.id,
        role="assistant",
        content=response.content,
        references=json.dumps(response.references) if response.references else None,
        sequence=2,
    )
    db.add(assistant_msg)

    # Update ragflow session id if present
    if response.provider_session_id:
        session.ragflow_session_id = response.provider_session_id

    await db.commit()
    await db.refresh(assistant_msg)

    return SendMessageResponse(
        session_id=session.id,
        assistant_message=MessageResponse.model_validate(assistant_msg),
    )


async def _stream_response(integration, session_id, message, context):
    """Return SSE streaming response. Saves full message to DB after stream completes."""
    from sse_starlette.sse import EventSourceResponse

    provider = get_provider(integration)

    async def event_generator():
        full_content = ""
        references = None
        provider_session_id = None

        try:
            async for chunk in provider.stream_message(message, context=context):
                if chunk.done:
                    references = chunk.references
                    provider_session_id = chunk.provider_session_id
                    yield {"event": "done", "data": json.dumps({
                        "references": references,
                        "provider_session_id": provider_session_id,
                    })}
                else:
                    full_content += chunk.content
                    yield {"data": chunk.content}
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield {"event": "error", "data": json.dumps({"detail": "Provider error during streaming"})}
            return

        # Save assistant message after stream completes
        from app.database import async_session
        async with async_session() as save_db:
            assistant_msg = Message(
                session_id=session_id,
                role="assistant",
                content=full_content,
                references=json.dumps(references) if references else None,
                sequence=2,
            )
            save_db.add(assistant_msg)
            if provider_session_id:
                result = await save_db.execute(select(Session).where(Session.id == session_id))
                sess = result.scalar_one()
                sess.ragflow_session_id = provider_session_id
            await save_db.commit()

    return EventSourceResponse(event_generator())


@router.get("/{integration_id}/sessions", response_model=list[SessionResponse])
async def list_sessions(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Session)
        .where(Session.user_id == user.id, Session.integration_id == integration_id)
        .order_by(Session.created_at.desc())
        .limit(10)
    )
    sessions = result.scalars().all()
    return [SessionResponse.model_validate(s) for s in sessions]


@router.get("/{integration_id}/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    integration_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
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

    msg_result = await db.execute(
        select(Message).where(Message.session_id == session_id).order_by(Message.sequence)
    )
    messages = msg_result.scalars().all()

    return SessionDetailResponse(
        id=session.id,
        integration_id=session.integration_id,
        title=session.title,
        messages=[MessageResponse.model_validate(m) for m in messages],
    )
```

- [ ] **Step 5: Register chat router in main.py**

Add to `backend/app/main.py`:
```python
from app.chat.router import router as chat_router
app.include_router(chat_router)
```

- [ ] **Step 6: Run tests**

Run: `cd backend && python -m pytest tests/test_chat.py -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/chat/ backend/app/main.py backend/tests/test_chat.py
git commit -m "feat: chat router with send, session list, session detail endpoints"
```

---

## Task 9: Pins CRUD

**Files:**
- Create: `backend/app/pins/__init__.py`, `backend/app/pins/router.py`, `backend/app/pins/schemas.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_pins.py`

- [ ] **Step 1: Write pin tests**

`backend/tests/test_pins.py`:
```python
import pytest
import json
import uuid
from app.auth.utils import hash_password


async def setup_message(client):
    """Create user, integration, session, message, and return token + message_id."""
    from tests.conftest import TestingSessionLocal
    from app.models import User, Integration, Session, Message

    uid = str(uuid.uuid4())
    iid = str(uuid.uuid4())
    sid = str(uuid.uuid4())
    mid = str(uuid.uuid4())

    async with TestingSessionLocal() as db:
        user = User(id=uid, username="pinner", password_hash=hash_password("p"), role="user")
        integration = Integration(id=iid, name="Test", provider_type="ragflow", provider_config="{}", updated_by=uid)
        session = Session(id=sid, user_id=uid, integration_id=iid, title="test")
        message = Message(id=mid, session_id=sid, role="assistant", content="Pin this response", sequence=2)
        db.add_all([user, integration, session, message])
        await db.commit()

    login = await client.post("/api/auth/login", json={"username": "pinner", "password": "p"})
    token = login.json()["access_token"]
    return token, mid, iid


@pytest.mark.asyncio
async def test_create_pin(client):
    token, mid, iid = await setup_message(client)
    response = await client.post(
        "/api/pins",
        json={"message_id": mid, "label": "useful response"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["label"] == "useful response"
    assert response.json()["content"] == "Pin this response"


@pytest.mark.asyncio
async def test_list_pins(client):
    token, mid, iid = await setup_message(client)
    await client.post("/api/pins", json={"message_id": mid, "label": "pin1"}, headers={"Authorization": f"Bearer {token}"})
    response = await client.get("/api/pins", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_update_pin_label(client):
    token, mid, iid = await setup_message(client)
    create = await client.post("/api/pins", json={"message_id": mid, "label": "old"}, headers={"Authorization": f"Bearer {token}"})
    pid = create.json()["id"]
    response = await client.put(f"/api/pins/{pid}", json={"label": "new"}, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["label"] == "new"


@pytest.mark.asyncio
async def test_delete_pin(client):
    token, mid, iid = await setup_message(client)
    create = await client.post("/api/pins", json={"message_id": mid, "label": "del"}, headers={"Authorization": f"Bearer {token}"})
    pid = create.json()["id"]
    response = await client.delete(f"/api/pins/{pid}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204

    # Verify message.pinned is reset
    from tests.conftest import TestingSessionLocal
    from app.models import Message
    from sqlalchemy import select
    async with TestingSessionLocal() as db:
        result = await db.execute(select(Message).where(Message.id == mid))
        msg = result.scalar_one()
        assert msg.pinned is False


@pytest.mark.asyncio
async def test_duplicate_pin_rejected(client):
    token, mid, iid = await setup_message(client)
    await client.post("/api/pins", json={"message_id": mid, "label": "first"}, headers={"Authorization": f"Bearer {token}"})
    response = await client.post("/api/pins", json={"message_id": mid, "label": "second"}, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 409
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_pins.py -v`
Expected: FAIL

- [ ] **Step 3: Implement pin schemas**

`backend/app/pins/schemas.py`:
```python
from pydantic import BaseModel


class PinCreate(BaseModel):
    message_id: str
    label: str


class PinUpdate(BaseModel):
    label: str


class PinResponse(BaseModel):
    id: str
    message_id: str
    integration_id: str
    label: str
    content: str
    integration_name: str | None = None

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Implement pin router**

`backend/app/pins/router.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import PinnedResponse, Message, User
from app.auth.dependencies import get_current_user
from app.pins.schemas import PinCreate, PinUpdate, PinResponse

router = APIRouter(prefix="/api/pins", tags=["pins"])


@router.get("", response_model=list[PinResponse])
async def list_pins(
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    offset = (page - 1) * page_size
    result = await db.execute(
        select(PinnedResponse)
        .options(selectinload(PinnedResponse.integration))
        .where(PinnedResponse.user_id == user.id)
        .order_by(PinnedResponse.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    pins = result.scalars().all()
    responses = []
    for p in pins:
        integration_name = None
        if p.integration:
            integration_name = p.integration.name
        responses.append(PinResponse(
            id=p.id,
            message_id=p.message_id,
            integration_id=p.integration_id,
            label=p.label,
            content=p.content,
            integration_name=integration_name,
        ))
    return responses


@router.post("", response_model=PinResponse, status_code=201)
async def create_pin(
    body: PinCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Check for duplicate
    existing = await db.execute(
        select(PinnedResponse).where(
            PinnedResponse.user_id == user.id,
            PinnedResponse.message_id == body.message_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Message already pinned")

    # Fetch the message
    msg_result = await db.execute(select(Message).where(Message.id == body.message_id))
    message = msg_result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Get integration_id from session
    from app.models import Session
    sess_result = await db.execute(select(Session).where(Session.id == message.session_id))
    session = sess_result.scalar_one()

    pin = PinnedResponse(
        user_id=user.id,
        message_id=body.message_id,
        integration_id=session.integration_id,
        label=body.label,
        content=message.content,
    )
    db.add(pin)

    # Mark message as pinned
    message.pinned = True

    await db.commit()
    await db.refresh(pin)

    return PinResponse(
        id=pin.id,
        message_id=pin.message_id,
        integration_id=pin.integration_id,
        label=pin.label,
        content=pin.content,
    )


@router.put("/{pin_id}", response_model=PinResponse)
async def update_pin(
    pin_id: str,
    body: PinUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PinnedResponse).where(PinnedResponse.id == pin_id, PinnedResponse.user_id == user.id)
    )
    pin = result.scalar_one_or_none()
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    pin.label = body.label
    await db.commit()
    await db.refresh(pin)

    return PinResponse(
        id=pin.id,
        message_id=pin.message_id,
        integration_id=pin.integration_id,
        label=pin.label,
        content=pin.content,
    )


@router.delete("/{pin_id}", status_code=204)
async def delete_pin(
    pin_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PinnedResponse).where(PinnedResponse.id == pin_id, PinnedResponse.user_id == user.id)
    )
    pin = result.scalar_one_or_none()
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    # Reset message.pinned if message still exists
    msg_result = await db.execute(select(Message).where(Message.id == pin.message_id))
    message = msg_result.scalar_one_or_none()
    if message:
        message.pinned = False

    await db.delete(pin)
    await db.commit()
```

- [ ] **Step 5: Register router in main.py**

Add to `backend/app/main.py`:
```python
from app.pins.router import router as pins_router
app.include_router(pins_router)
```

- [ ] **Step 6: Run tests**

Run: `cd backend && python -m pytest tests/test_pins.py -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/pins/ backend/app/main.py backend/tests/test_pins.py
git commit -m "feat: pinned responses CRUD with duplicate prevention and cascade cleanup"
```

---

## Task 10: Admin Router

**Files:**
- Create: `backend/app/admin/__init__.py`, `backend/app/admin/router.py`, `backend/app/admin/schemas.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_admin.py`

- [ ] **Step 1: Write admin tests**

`backend/tests/test_admin.py`:
```python
import pytest
import uuid
from app.auth.utils import hash_password


async def admin_login(client):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    uid = str(uuid.uuid4())
    async with TestingSessionLocal() as db:
        user = User(id=uid, username="admin", password_hash=hash_password("admin"), role="admin")
        db.add(user)
        await db.commit()
    login = await client.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    return login.json()["access_token"]


@pytest.mark.asyncio
async def test_create_user(client):
    token = await admin_login(client)
    response = await client.post(
        "/api/admin/users",
        json={"username": "newuser", "password": "pass123", "role": "user"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["username"] == "newuser"


@pytest.mark.asyncio
async def test_list_users(client):
    token = await admin_login(client)
    response = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_update_user(client):
    token = await admin_login(client)
    create = await client.post(
        "/api/admin/users",
        json={"username": "upd", "password": "p", "role": "user"},
        headers={"Authorization": f"Bearer {token}"},
    )
    uid = create.json()["id"]
    response = await client.put(
        f"/api/admin/users/{uid}",
        json={"role": "admin"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_delete_user(client):
    token = await admin_login(client)
    create = await client.post(
        "/api/admin/users",
        json={"username": "del", "password": "p", "role": "user"},
        headers={"Authorization": f"Bearer {token}"},
    )
    uid = create.json()["id"]
    response = await client.delete(f"/api/admin/users/{uid}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_admin.py -v`
Expected: FAIL

- [ ] **Step 3: Implement admin schemas and router**

`backend/app/admin/schemas.py`:
```python
from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"


class UserUpdate(BaseModel):
    role: str | None = None
    password: str | None = None
```

`backend/app/admin/router.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User
from app.auth.dependencies import require_admin
from app.auth.utils import hash_password
from app.auth.schemas import UserResponse
from app.admin.schemas import UserCreate, UserUpdate

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    offset = (page - 1) * page_size
    result = await db.execute(select(User).order_by(User.created_at).offset(offset).limit(page_size))
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already exists")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role is not None:
        user.role = body.role
    if body.password is not None:
        user.password_hash = hash_password(body.password)

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
```

- [ ] **Step 4: Register router in main.py**

Add to `backend/app/main.py`:
```python
from app.admin.router import router as admin_router
app.include_router(admin_router)
```

- [ ] **Step 5: Run tests**

Run: `cd backend && python -m pytest tests/test_admin.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/admin/ backend/app/main.py backend/tests/test_admin.py
git commit -m "feat: admin user management (CRUD, password reset)"
```

---

## Task 11: Frontend Scaffolding

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/vite-env.d.ts`

- [ ] **Step 1: Initialize React + TypeScript + Vite project**

```bash
cd /home/thanh-tran/EdgeAI
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install axios zustand react-router-dom
npm install -D @types/react-router-dom
```

- [ ] **Step 2: Configure Vite dev proxy**

Update `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Set up App.tsx with router skeleton**

`frontend/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

function App() {
  const { accessToken } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<div>Login Page (TODO)</div>} />
        <Route path="/chat" element={
          accessToken ? <div>Chat Page (TODO)</div> : <Navigate to="/login" />
        } />
        <Route path="/admin" element={
          accessToken ? <div>Admin Page (TODO)</div> : <Navigate to="/login" />
        } />
        <Route path="*" element={<Navigate to="/chat" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 4: Verify dev server starts**

```bash
cd frontend && npm run dev
```
Expected: Vite dev server starts on http://localhost:5173

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffolding with React, TypeScript, Vite, router skeleton"
```

---

## Task 12: Frontend API Client + Auth Store

**Files:**
- Create: `frontend/src/api/client.ts`, `frontend/src/api/auth.ts`, `frontend/src/store/authStore.ts`

- [ ] **Step 1: Implement API client with JWT interceptor**

`frontend/src/api/client.ts`:
```typescript
import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`
          return client(originalRequest)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default client
```

- [ ] **Step 2: Implement auth API calls**

`frontend/src/api/auth.ts`:
```typescript
import client from './client'

export interface User {
  id: string
  username: string
  role: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: User
}

export const loginApi = (username: string, password: string) =>
  client.post<LoginResponse>('/auth/login', { username, password })

export const getMeApi = () =>
  client.get<User>('/auth/me')
```

- [ ] **Step 3: Implement auth store**

`frontend/src/store/authStore.ts`:
```typescript
import { create } from 'zustand'
import { loginApi, getMeApi, User } from '../api/auth'

interface AuthState {
  user: User | null
  accessToken: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  loading: false,

  login: async (username, password) => {
    const { data } = await loginApi(username, password)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    set({ user: data.user, accessToken: data.access_token })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, accessToken: null })
    window.location.href = '/login'
  },

  checkAuth: async () => {
    try {
      set({ loading: true })
      const { data } = await getMeApi()
      set({ user: data, loading: false })
    } catch {
      set({ user: null, accessToken: null, loading: false })
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
  },
}))
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/ frontend/src/store/authStore.ts
git commit -m "feat: API client with JWT refresh interceptor + auth store"
```

---

## Task 13: Login Page

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Implement LoginPage**

`frontend/src/pages/LoginPage.tsx`:
```tsx
import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
      navigate('/chat')
    } catch {
      setError('Invalid credentials')
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0d1117' }}>
      <form onSubmit={handleSubmit} style={{ background: '#161b22', padding: 32, borderRadius: 8, border: '1px solid #30363d', width: 360 }}>
        <h1 style={{ color: '#64ffda', marginBottom: 24, fontSize: 24 }}>EdgeAI</h1>
        {error && <div style={{ color: '#cf6679', marginBottom: 12, fontSize: 14 }}>{error}</div>}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ width: '100%', padding: 10, marginBottom: 12, background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e0e0e0', boxSizing: 'border-box' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: 10, marginBottom: 16, background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e0e0e0', boxSizing: 'border-box' }}
        />
        <button type="submit" style={{ width: '100%', padding: 10, background: '#64ffda', color: '#0d1117', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          Sign In
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Wire LoginPage into App.tsx**

Update `App.tsx` to import and use `LoginPage`:
```tsx
import LoginPage from './pages/LoginPage'
// In routes:
<Route path="/login" element={<LoginPage />} />
```

- [ ] **Step 3: Verify login page renders**

Run: `cd frontend && npm run dev` — navigate to http://localhost:5173/login
Expected: Login form renders with EdgeAI title

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/App.tsx
git commit -m "feat: login page with auth store integration"
```

---

## Task 14: Chat Page Layout + Integration List + Chat Store

**Files:**
- Create: `frontend/src/pages/ChatPage.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/components/IntegrationList.tsx`, `frontend/src/api/integrations.ts`, `frontend/src/store/chatStore.ts`

- [ ] **Step 1: Implement API calls**

`frontend/src/api/integrations.ts`:
```typescript
import client from './client'

export interface Integration {
  id: string
  name: string
  provider_type: string
  description: string | null
  icon: string | null
}

export const listIntegrationsApi = () =>
  client.get<Integration[]>('/integrations')
```

`frontend/src/api/chat.ts`:
```typescript
import client from './client'

export interface MessageData {
  id: string
  role: string
  content: string
  references: string | null
  pinned: boolean
  sequence: number
}

export interface SessionData {
  id: string
  integration_id: string
  title: string
  created_at: string
}

export interface SessionDetail {
  id: string
  integration_id: string
  title: string
  messages: MessageData[]
}

export interface SendResponse {
  session_id: string
  assistant_message: MessageData
}

export const sendMessageApi = (integrationId: string, message: string, pinnedIds?: string[]) =>
  client.post<SendResponse>(`/chat/${integrationId}/send`, { message, pinned_ids: pinnedIds, stream: false })

export const sendMessageStreamApi = async (
  integrationId: string,
  message: string,
  pinnedIds: string[] | undefined,
  onChunk: (text: string) => void,
  onDone: (refs: unknown, sessionId: string | null) => void,
  onError: (error: string) => void,
) => {
  const token = localStorage.getItem('access_token')
  const response = await fetch(`/api/chat/${integrationId}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message, pinned_ids: pinnedIds, stream: true }),
  })

  if (!response.ok) {
    onError('Failed to connect to chat provider')
    return
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  if (!reader) return

  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        onChunk(line.slice(6))
      } else if (line.startsWith('event: done')) {
        // Next data line has metadata
      } else if (line.startsWith('event: error')) {
        // Next data line has error
      }
      // Parse "data:" after "event: done"
      if (line.startsWith('data: {')) {
        try {
          const meta = JSON.parse(line.slice(6))
          if (meta.references !== undefined) {
            onDone(meta.references, meta.provider_session_id)
          }
          if (meta.detail) {
            onError(meta.detail)
          }
        } catch {
          // plain text chunk, already handled
        }
      }
    }
  }
}

export const getSessionsApi = (integrationId: string) =>
  client.get<SessionData[]>(`/chat/${integrationId}/sessions`)

export const getSessionApi = (integrationId: string, sessionId: string) =>
  client.get<SessionDetail>(`/chat/${integrationId}/sessions/${sessionId}`)
```

- [ ] **Step 2: Implement chat store**

`frontend/src/store/chatStore.ts`:
```typescript
import { create } from 'zustand'
import { Integration } from '../api/integrations'
import { MessageData, SessionData } from '../api/chat'

interface ChatState {
  activeIntegration: Integration | null
  sessions: SessionData[]
  currentMessages: MessageData[]
  isStreaming: boolean
  setActiveIntegration: (integration: Integration) => void
  setSessions: (sessions: SessionData[]) => void
  setCurrentMessages: (messages: MessageData[]) => void
  addMessage: (message: MessageData) => void
  updateLastMessage: (updater: (prevContent: string) => string) => void
  setStreaming: (streaming: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeIntegration: null,
  sessions: [],
  currentMessages: [],
  isStreaming: false,

  setActiveIntegration: (integration) => set({ activeIntegration: integration, currentMessages: [] }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentMessages: (messages) => set({ currentMessages: messages }),
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
  clearMessages: () => set({ currentMessages: [] }),
}))
```

- [ ] **Step 3: Implement Layout + IntegrationList**

`frontend/src/components/Layout.tsx`:
```tsx
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0d1117', color: '#e0e0e0' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <span style={{ fontSize: 18, fontWeight: 'bold', color: '#64ffda', cursor: 'pointer' }} onClick={() => navigate('/chat')}>EdgeAI</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#8b949e', fontSize: 12 }}>{user?.username}</span>
          {user?.role === 'admin' && (
            <button onClick={() => navigate('/admin')} style={{ padding: '4px 10px', background: '#21262d', border: '1px solid #30363d', borderRadius: 4, color: '#8b949e', cursor: 'pointer', fontSize: 11 }}>Admin</button>
          )}
          <button onClick={logout} style={{ padding: '4px 10px', background: '#21262d', border: '1px solid #30363d', borderRadius: 4, color: '#8b949e', cursor: 'pointer', fontSize: 11 }}>Logout</button>
        </div>
      </header>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
```

`frontend/src/components/IntegrationList.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { listIntegrationsApi, Integration } from '../api/integrations'
import { useChatStore } from '../store/chatStore'

export default function IntegrationList() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const { activeIntegration, setActiveIntegration } = useChatStore()

  useEffect(() => {
    listIntegrationsApi().then(({ data }) => setIntegrations(data))
  }, [])

  return (
    <div style={{ width: 220, background: '#0d1117', borderRight: '1px solid #30363d', padding: 12, overflowY: 'auto' }}>
      <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Integrations</div>
      {integrations.map((i) => (
        <div
          key={i.id}
          onClick={() => setActiveIntegration(i)}
          style={{
            padding: 10,
            background: activeIntegration?.id === i.id ? '#1a2332' : '#161b22',
            border: `1px solid ${activeIntegration?.id === i.id ? '#64ffda' : '#30363d'}`,
            borderRadius: 6,
            marginBottom: 6,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 13, color: activeIntegration?.id === i.id ? '#fff' : '#c9d1d9' }}>
            {i.icon || '💬'} {i.name}
          </div>
          <div style={{ fontSize: 10, color: activeIntegration?.id === i.id ? '#64ffda' : '#8b949e' }}>
            {i.provider_type === 'ragflow' ? 'ragflow' : 'openai'}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Implement ChatPage**

`frontend/src/pages/ChatPage.tsx`:
```tsx
import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import Layout from '../components/Layout'
import IntegrationList from '../components/IntegrationList'
import SessionHistory from '../components/SessionHistory'
import ChatWindow from '../components/ChatWindow'

export default function ChatPage() {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', width: 220, borderRight: '1px solid #30363d' }}>
        <IntegrationList />
        <SessionHistory />
      </div>
      <ChatWindow />
    </Layout>
  )
}
```

Create placeholder components that will be implemented in the next tasks:

`frontend/src/components/SessionHistory.tsx`:
```tsx
export default function SessionHistory() {
  return <div style={{ padding: 12, borderTop: '1px solid #30363d' }}>
    <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1 }}>Recent Sessions</div>
  </div>
}
```

`frontend/src/components/ChatWindow.tsx`:
```tsx
export default function ChatWindow() {
  return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
    Select an integration to start chatting
  </div>
}
```

- [ ] **Step 5: Update App.tsx**

```tsx
import ChatPage from './pages/ChatPage'
// In routes:
<Route path="/chat" element={accessToken ? <ChatPage /> : <Navigate to="/login" />} />
```

- [ ] **Step 6: Verify layout renders**

Run: `cd frontend && npm run dev`
Expected: Layout with sidebar and placeholder chat area

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: chat page layout with integration list sidebar and chat store"
```

---

## Task 15: ChatWindow + MessageBubble + Send

**Files:**
- Modify: `frontend/src/components/ChatWindow.tsx`
- Create: `frontend/src/components/MessageBubble.tsx`, `frontend/src/components/PinnedBanner.tsx`

- [ ] **Step 1: Implement MessageBubble**

`frontend/src/components/MessageBubble.tsx`:
```tsx
import { MessageData } from '../api/chat'

interface Props {
  message: MessageData
  onPin?: (messageId: string) => void
}

export default function MessageBubble({ message, onPin }: Props) {
  const isUser = message.role === 'user'
  const refs = message.references ? JSON.parse(message.references) : null

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
      <div style={{
        background: isUser ? '#1a2332' : '#161b22',
        border: '1px solid #30363d',
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        padding: '12px 16px',
        maxWidth: '70%',
      }}>
        <div style={{ color: '#e0e0e0', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {message.content}
        </div>
        {!isUser && (
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #30363d', display: 'flex', gap: 8 }}>
            {onPin && !message.pinned && (
              <button onClick={() => onPin(message.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(187,134,252,0.1)', border: '1px solid rgba(187,134,252,0.2)', borderRadius: 3, color: '#bb86fc', cursor: 'pointer' }}>
                📌 Pin
              </button>
            )}
            {message.pinned && <span style={{ fontSize: 11, color: '#bb86fc' }}>📌 Pinned</span>}
            <button onClick={() => navigator.clipboard.writeText(message.content)} style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(100,255,218,0.1)', border: '1px solid rgba(100,255,218,0.2)', borderRadius: 3, color: '#64ffda', cursor: 'pointer' }}>
              📋 Copy
            </button>
          </div>
        )}
        {refs && refs.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#484f58' }}>
            📄 References: {refs.map((r: { document_name: string }) => r.document_name).join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement PinnedBanner**

`frontend/src/components/PinnedBanner.tsx`:
```tsx
interface PinItem {
  id: string
  label: string
  content: string
}

interface Props {
  pins: PinItem[]
  onRemove: (id: string) => void
}

export default function PinnedBanner({ pins, onRemove }: Props) {
  if (pins.length === 0) return null

  return (
    <div style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
      <span style={{ color: '#ffd700' }}>📌 Injected context:</span>
      {pins.map((p) => (
        <span key={p.id} style={{ marginLeft: 8, color: '#c9d1d9' }}>
          "{p.label}"
          <span onClick={() => onRemove(p.id)} style={{ color: '#484f58', cursor: 'pointer', marginLeft: 4 }}>[remove]</span>
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Implement full ChatWindow**

`frontend/src/components/ChatWindow.tsx`:
```tsx
import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { usePinStore } from '../store/pinStore'
import { sendMessageStreamApi, getSessionsApi } from '../api/chat'
import MessageBubble from './MessageBubble'
import PinnedBanner from './PinnedBanner'
import PinSelector from './PinSelector'

export default function ChatWindow() {
  const { activeIntegration, currentMessages, addMessage, clearMessages, setSessions, isStreaming, setStreaming, updateLastMessage } = useChatStore()
  const { selectedPins, removeSelectedPin, clearSelectedPins } = usePinStore()
  const [input, setInput] = useState('')
  const [showPinSelector, setShowPinSelector] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages])

  if (!activeIntegration) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
      Select an integration to start chatting
    </div>
  }

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return
    setError('')
    clearMessages()

    const userMsg = { id: 'temp-user', role: 'user', content: input, references: null, pinned: false, sequence: 1 }
    addMessage(userMsg)

    // Add empty assistant message that will be filled by streaming
    const assistantMsg = { id: 'temp-assistant', role: 'assistant', content: '', references: null, pinned: false, sequence: 2 }
    addMessage(assistantMsg)

    const pinnedIds = selectedPins.map((p) => p.id)
    const message = input
    setInput('')
    setStreaming(true)

    try {
      await sendMessageStreamApi(
        activeIntegration.id,
        message,
        pinnedIds.length > 0 ? pinnedIds : undefined,
        (chunk) => {
          // Append each chunk to the assistant message
          updateLastMessage((prev) => prev + chunk)
        },
        async (refs) => {
          // Stream done — refresh sessions
          clearSelectedPins()
          const sessionsRes = await getSessionsApi(activeIntegration.id)
          setSessions(sessionsRes.data)
        },
        (errorMsg) => {
          setError(errorMsg)
        },
      )
    } catch {
      setError('Failed to get response. Please try again.')
    } finally {
      setStreaming(false)
    }
  }

  const handlePin = async (messageId: string) => {
    // Will be wired to pin API in pins task
    const label = prompt('Enter a label for this pin:')
    if (!label) return
    const { createPinApi } = await import('../api/pins')
    try {
      await createPinApi(messageId, label)
      // Mark message as pinned in local state
      useChatStore.setState((state) => ({
        currentMessages: state.currentMessages.map((m) =>
          m.id === messageId ? { ...m, pinned: true } : m
        ),
      }))
    } catch {
      alert('Failed to pin message')
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 15, color: '#fff' }}>{activeIntegration.icon || '💬'} {activeIntegration.name}</span>
          <span style={{ fontSize: 11, color: '#64ffda', marginLeft: 8, padding: '2px 6px', background: 'rgba(100,255,218,0.1)', borderRadius: 3 }}>
            {activeIntegration.provider_type}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#8b949e' }}>New session each message</span>
      </div>

      <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
        <PinnedBanner pins={selectedPins} onRemove={removeSelectedPin} />
        {currentMessages.map((m, i) => (
          <MessageBubble key={i} message={m} onPin={m.role === 'assistant' ? handlePin : undefined} />
        ))}
        {isStreaming && <div style={{ color: '#8b949e', fontSize: 13 }}>Thinking...</div>}
        {error && <div style={{ color: '#cf6679', fontSize: 13 }}>{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '12px 20px', borderTop: '1px solid #30363d' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 16, cursor: 'pointer', color: '#8b949e' }} onClick={() => setShowPinSelector(!showPinSelector)} title="Attach pinned responses">📌</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={`Ask ${activeIntegration.name} something...`}
            style={{ flex: 1, background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#e0e0e0', fontSize: 13, outline: 'none' }}
          />
          <button onClick={handleSend} disabled={isStreaming} style={{ background: '#64ffda', color: '#0d1117', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 'bold', cursor: 'pointer', border: 'none' }}>
            Send
          </button>
        </div>
        {showPinSelector && <PinSelector onClose={() => setShowPinSelector(false)} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create placeholder PinSelector and pinStore**

`frontend/src/store/pinStore.ts`:
```typescript
import { create } from 'zustand'

export interface PinItem {
  id: string
  label: string
  content: string
  integration_name?: string
}

interface PinState {
  allPins: PinItem[]
  selectedPins: PinItem[]
  setAllPins: (pins: PinItem[]) => void
  toggleSelectedPin: (pin: PinItem) => void
  removeSelectedPin: (id: string) => void
  clearSelectedPins: () => void
}

export const usePinStore = create<PinState>((set) => ({
  allPins: [],
  selectedPins: [],
  setAllPins: (pins) => set({ allPins: pins }),
  toggleSelectedPin: (pin) => set((state) => {
    const exists = state.selectedPins.find((p) => p.id === pin.id)
    if (exists) {
      return { selectedPins: state.selectedPins.filter((p) => p.id !== pin.id) }
    }
    return { selectedPins: [...state.selectedPins, pin] }
  }),
  removeSelectedPin: (id) => set((state) => ({ selectedPins: state.selectedPins.filter((p) => p.id !== id) })),
  clearSelectedPins: () => set({ selectedPins: [] }),
}))
```

`frontend/src/api/pins.ts`:
```typescript
import client from './client'
import { PinItem } from '../store/pinStore'

export const listPinsApi = (page = 1, pageSize = 50) =>
  client.get<PinItem[]>('/pins', { params: { page, page_size: pageSize } })

export const createPinApi = (messageId: string, label: string) =>
  client.post('/pins', { message_id: messageId, label })

export const updatePinApi = (pinId: string, label: string) =>
  client.put(`/pins/${pinId}`, { label })

export const deletePinApi = (pinId: string) =>
  client.delete(`/pins/${pinId}`)
```

`frontend/src/components/PinSelector.tsx`:
```tsx
import { useEffect } from 'react'
import { usePinStore } from '../store/pinStore'
import { listPinsApi } from '../api/pins'

interface Props {
  onClose: () => void
}

export default function PinSelector({ onClose }: Props) {
  const { allPins, setAllPins, selectedPins, toggleSelectedPin } = usePinStore()

  useEffect(() => {
    listPinsApi().then(({ data }) => setAllPins(data))
  }, [])

  return (
    <div style={{ marginTop: 8, background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 12, maxHeight: 200, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#8b949e' }}>Select pinned responses to inject:</span>
        <span onClick={onClose} style={{ cursor: 'pointer', color: '#8b949e', fontSize: 12 }}>Close</span>
      </div>
      {allPins.length === 0 && <div style={{ color: '#484f58', fontSize: 12 }}>No pinned responses yet</div>}
      {allPins.map((pin) => {
        const isSelected = selectedPins.some((p) => p.id === pin.id)
        return (
          <div
            key={pin.id}
            onClick={() => toggleSelectedPin(pin)}
            style={{
              padding: 8,
              borderRadius: 4,
              marginBottom: 4,
              cursor: 'pointer',
              background: isSelected ? 'rgba(255,215,0,0.1)' : 'transparent',
              border: `1px solid ${isSelected ? 'rgba(255,215,0,0.3)' : 'transparent'}`,
            }}
          >
            <div style={{ fontSize: 12, color: '#c9d1d9' }}>{pin.label}</div>
            <div style={{ fontSize: 10, color: '#484f58', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pin.integration_name && <span style={{ color: '#8b949e' }}>[{pin.integration_name}] </span>}
              {pin.content.slice(0, 80)}...
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: chat window with message send, pin/copy actions, pin injection UI"
```

---

## Task 16: Session History Component

**Files:**
- Modify: `frontend/src/components/SessionHistory.tsx`

- [ ] **Step 1: Implement SessionHistory**

`frontend/src/components/SessionHistory.tsx`:
```tsx
import { useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { getSessionsApi, getSessionApi } from '../api/chat'

export default function SessionHistory() {
  const { activeIntegration, sessions, setSessions, setCurrentMessages } = useChatStore()

  useEffect(() => {
    if (activeIntegration) {
      getSessionsApi(activeIntegration.id).then(({ data }) => setSessions(data))
    }
  }, [activeIntegration])

  const viewSession = async (sessionId: string) => {
    if (!activeIntegration) return
    const { data } = await getSessionApi(activeIntegration.id, sessionId)
    setCurrentMessages(data.messages)
  }

  if (!activeIntegration) return null

  return (
    <div style={{ padding: 12, borderTop: '1px solid #30363d', overflowY: 'auto', flex: 1 }}>
      <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Recent Sessions</div>
      {sessions.length === 0 && <div style={{ fontSize: 12, color: '#484f58' }}>No sessions yet</div>}
      {sessions.map((s) => (
        <div
          key={s.id}
          onClick={() => viewSession(s.id)}
          style={{ padding: 8, borderRadius: 4, marginBottom: 4, cursor: 'pointer', color: '#8b949e', fontSize: 12 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#161b22')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {s.title.slice(0, 40)}{s.title.length > 40 ? '...' : ''}
          <span style={{ color: '#484f58', fontSize: 10, marginLeft: 4 }}>
            {new Date(s.created_at).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SessionHistory.tsx
git commit -m "feat: session history sidebar with click-to-view past sessions"
```

---

## Task 17: Admin Page

**Files:**
- Create: `frontend/src/pages/AdminPage.tsx`, `frontend/src/components/AdminPanel.tsx`, `frontend/src/components/UserManagement.tsx`, `frontend/src/api/admin.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Implement admin API calls**

`frontend/src/api/admin.ts`:
```typescript
import client from './client'
import { User } from './auth'
import { Integration } from './integrations'

export const listUsersApi = (page = 1, pageSize = 50) =>
  client.get<User[]>('/admin/users', { params: { page, page_size: pageSize } })

export const createUserApi = (username: string, password: string, role: string) =>
  client.post<User>('/admin/users', { username, password, role })

export const updateUserApi = (userId: string, data: { role?: string; password?: string }) =>
  client.put<User>(`/admin/users/${userId}`, data)

export const deleteUserApi = (userId: string) =>
  client.delete(`/admin/users/${userId}`)

export const createIntegrationApi = (data: { name: string; provider_type: string; provider_config: Record<string, unknown>; description?: string; icon?: string }) =>
  client.post<Integration>('/integrations', data)

export const updateIntegrationApi = (id: string, data: Record<string, unknown>) =>
  client.put<Integration>(`/integrations/${id}`, data)

export const deleteIntegrationApi = (id: string) =>
  client.delete(`/integrations/${id}`)
```

- [ ] **Step 2: Implement UserManagement component**

`frontend/src/components/UserManagement.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { User } from '../api/auth'
import { listUsersApi, createUserApi, updateUserApi, deleteUserApi } from '../api/admin'

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('user')

  const loadUsers = () => listUsersApi().then(({ data }) => setUsers(data))
  useEffect(() => { loadUsers() }, [])

  const handleCreate = async () => {
    if (!newUsername || !newPassword) return
    await createUserApi(newUsername, newPassword, newRole)
    setNewUsername('')
    setNewPassword('')
    loadUsers()
  }

  return (
    <div>
      <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>Users</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0' }} />
        <input placeholder="Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0' }} />
        <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0' }}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={handleCreate} style={{ padding: '8px 16px', background: '#64ffda', color: '#0d1117', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Username</th>
            <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Role</th>
            <th style={{ textAlign: 'right', padding: 8, color: '#8b949e' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid #21262d' }}>
              <td style={{ padding: 8 }}>{u.username}</td>
              <td style={{ padding: 8 }}>{u.role}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>
                <button onClick={() => { updateUserApi(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }); loadUsers() }} style={{ marginRight: 8, padding: '4px 8px', background: '#21262d', border: '1px solid #30363d', borderRadius: 4, color: '#8b949e', cursor: 'pointer', fontSize: 11 }}>
                  Toggle Role
                </button>
                <button onClick={() => { if (confirm('Delete user?')) { deleteUserApi(u.id).then(loadUsers) } }} style={{ padding: '4px 8px', background: '#21262d', border: '1px solid #cf6679', borderRadius: 4, color: '#cf6679', cursor: 'pointer', fontSize: 11 }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Implement AdminPanel (integration management)**

`frontend/src/components/AdminPanel.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { Integration, listIntegrationsApi } from '../api/integrations'
import { createIntegrationApi, deleteIntegrationApi } from '../api/admin'

export default function AdminPanel() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState('ragflow')
  const [configJson, setConfigJson] = useState('{}')

  const load = () => listIntegrationsApi().then(({ data }) => setIntegrations(data))
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      const config = JSON.parse(configJson)
      await createIntegrationApi({ name, provider_type: providerType, provider_config: config })
      setName('')
      setConfigJson('{}')
      load()
    } catch {
      alert('Invalid JSON config')
    }
  }

  return (
    <div>
      <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>Integrations</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0' }} />
        <select value={providerType} onChange={(e) => setProviderType(e.target.value)} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0' }}>
          <option value="ragflow">RAGFlow</option>
          <option value="openai_compatible">OpenAI Compatible</option>
        </select>
        <textarea placeholder='{"base_url":"...","api_key":"..."}' value={configJson} onChange={(e) => setConfigJson(e.target.value)} rows={2} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0', flex: 1, minWidth: 300, fontFamily: 'monospace', fontSize: 12 }} />
        <button onClick={handleCreate} style={{ padding: '8px 16px', background: '#64ffda', color: '#0d1117', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add</button>
      </div>
      {integrations.map((i) => (
        <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#161b22', border: '1px solid #30363d', borderRadius: 6, marginBottom: 8 }}>
          <div>
            <span style={{ color: '#e0e0e0' }}>{i.name}</span>
            <span style={{ fontSize: 10, color: '#8b949e', marginLeft: 8 }}>{i.provider_type}</span>
          </div>
          <button onClick={() => { if (confirm('Delete integration?')) deleteIntegrationApi(i.id).then(load) }} style={{ padding: '4px 8px', background: '#21262d', border: '1px solid #cf6679', borderRadius: 4, color: '#cf6679', cursor: 'pointer', fontSize: 11 }}>Delete</button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Implement AdminPage**

`frontend/src/pages/AdminPage.tsx`:
```tsx
import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import AdminPanel from '../components/AdminPanel'
import UserManagement from '../components/UserManagement'

export default function AdminPage() {
  const { user, checkAuth } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/chat')
  }, [user])

  return (
    <Layout>
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <h2 style={{ color: '#64ffda', marginBottom: 24 }}>Admin Panel</h2>
        <div style={{ marginBottom: 32 }}>
          <AdminPanel />
        </div>
        <UserManagement />
      </div>
    </Layout>
  )
}
```

- [ ] **Step 5: Wire AdminPage into App.tsx**

```tsx
import AdminPage from './pages/AdminPage'
// In routes:
<Route path="/admin" element={accessToken ? <AdminPage /> : <Navigate to="/login" />} />
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: admin page with integration management and user CRUD"
```

---

## Task 18: Docker + Nginx + Compose

**Files:**
- Create: `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml`

- [ ] **Step 1: Backend Dockerfile**

`backend/Dockerfile`:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

RUN mkdir -p /app/data

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Frontend Nginx config**

`frontend/nginx.conf`:
```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 3: Frontend Dockerfile**

`frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 4: Docker Compose**

`docker-compose.yml`:
```yaml
services:
  backend:
    build: ./backend
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - DATABASE_URL=sqlite+aiosqlite:///app/data/edgeai.db
    volumes:
      - ./data:/app/data
    expose:
      - "8000"

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
```

- [ ] **Step 5: Test Docker Compose build**

```bash
cd /home/thanh-tran/EdgeAI
docker compose build
```
Expected: Both images build successfully

- [ ] **Step 6: Test Docker Compose up**

```bash
SECRET_KEY=test-secret ADMIN_PASSWORD=admin123 docker compose up -d
```
Expected: Both containers start, http://localhost:3000 serves the app

- [ ] **Step 7: Stop and commit**

```bash
docker compose down
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile frontend/nginx.conf
git commit -m "feat: Docker Compose deployment with Nginx reverse proxy"
```

---

## Task 19: Global CSS Reset + Final Polish

**Files:**
- Modify: `frontend/src/index.css` or create `frontend/src/global.css`

- [ ] **Step 1: Add global styles**

`frontend/src/index.css`:
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: #0d1117;
  color: #e0e0e0;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #0d1117;
}

::-webkit-scrollbar-thumb {
  background: #30363d;
  border-radius: 3px;
}

::selection {
  background: rgba(100, 255, 218, 0.2);
}
```

- [ ] **Step 2: Run all backend tests**

```bash
cd /home/thanh-tran/EdgeAI/backend && python -m pytest tests/ -v
```
Expected: All tests pass

- [ ] **Step 3: Run frontend build check**

```bash
cd /home/thanh-tran/EdgeAI/frontend && npm run build
```
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: global CSS reset and scrollbar styling"
```

---

## Summary

**19 tasks, ordered for incremental buildability:**

| # | Task | Category |
|---|------|----------|
| 1 | Project scaffolding + git init | Backend |
| 2 | Database models | Backend |
| 3 | Auth utils + dependencies | Backend |
| 4 | Auth router + admin bootstrap | Backend |
| 5 | Integrations CRUD | Backend |
| 6 | Provider interface + OpenAI provider | Backend |
| 7 | RAGFlow provider | Backend |
| 8 | Chat router (send + sessions) | Backend |
| 9 | Pins CRUD | Backend |
| 10 | Admin router | Backend |
| 11 | Frontend scaffolding | Frontend |
| 12 | API client + auth store | Frontend |
| 13 | Login page | Frontend |
| 14 | Chat page layout + integration list | Frontend |
| 15 | ChatWindow + MessageBubble + send | Frontend |
| 16 | Session history | Frontend |
| 17 | Admin page | Frontend |
| 18 | Docker + Nginx + Compose | Deployment |
| 19 | CSS reset + final polish | Frontend |

Each task is independently testable and committable. Backend tasks 1-10 can complete before any frontend work begins. Frontend tasks 11-17 can be developed with the backend running locally. Task 18 wraps everything for production deployment.
