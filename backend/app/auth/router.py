from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, Integration, UserIntegrationAccess
from app.auth.utils import verify_password, hash_password, create_access_token, create_refresh_token, decode_token
from app.auth.schemas import (
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    UserResponse,
    ChangePasswordRequest,
    DefaultIntegrationRequest,
)
from app.auth.dependencies import get_current_user
from app.constants import ROLE_USER
from jose import JWTError

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _make_tokens(user: User) -> dict:
    data = {"sub": user.id, "role": user.role}
    return {
        "access_token": create_access_token(data),
        "refresh_token": create_refresh_token(data),
    }


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    tokens = _make_tokens(user)
    return TokenResponse(
        **tokens,
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

    return _make_tokens(user)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


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


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password updated"}
