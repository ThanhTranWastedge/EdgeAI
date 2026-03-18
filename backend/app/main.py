from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from app.database import init_db, async_session
from app.config import settings
from app.models import User
from app.auth.utils import hash_password
from app.auth.router import router as auth_router
from app.integrations.router import router as integrations_router
from app.chat.router import router as chat_router


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
app.include_router(integrations_router)
app.include_router(chat_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
