from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, Integration, UserIntegrationAccess
from app.auth.dependencies import require_manager_or_admin
from app.auth.utils import hash_password
from app.auth.schemas import UserResponse
from app.manager.schemas import ManagerUserCreate, ManagerUserUpdate, SetUserAccess, UserAccessResponse
from app.constants import ROLE_ADMIN, ROLE_MANAGER, ROLE_USER

router = APIRouter(prefix="/api/manager", tags=["manager"])

ALLOWED_ROLES = (ROLE_USER, ROLE_MANAGER)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    result = await db.execute(
        select(User)
        .where(User.role.in_(ALLOWED_ROLES))
        .order_by(User.created_at)
    )
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    body: ManagerUserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    if body.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Cannot create user with admin role")

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
    body: ManagerUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot modify admin users")

    if body.role is not None:
        if body.role not in ALLOWED_ROLES:
            raise HTTPException(status_code=403, detail="Cannot set role to admin")
        if user_id == current_user.id:
            raise HTTPException(status_code=403, detail="Cannot change own role")
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
    current_user: User = Depends(require_manager_or_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete own account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot delete admin users")

    await db.execute(
        delete(UserIntegrationAccess).where(UserIntegrationAccess.user_id == user_id)
    )
    await db.delete(user)
    await db.commit()


@router.get("/users/{user_id}/access", response_model=list[UserAccessResponse])
async def get_user_access(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    rows = await db.execute(
        select(UserIntegrationAccess, Integration.name)
        .join(Integration, UserIntegrationAccess.integration_id == Integration.id)
        .where(UserIntegrationAccess.user_id == user_id)
    )
    return [
        UserAccessResponse(id=access.id, integration_id=access.integration_id, integration_name=name)
        for access, name in rows.all()
    ]


@router.put("/users/{user_id}/access", response_model=list[UserAccessResponse])
async def set_user_access(
    user_id: str,
    body: SetUserAccess,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    if body.integration_ids:
        existing = await db.execute(
            select(Integration.id).where(Integration.id.in_(body.integration_ids))
        )
        found_ids = {row[0] for row in existing.all()}
        invalid = set(body.integration_ids) - found_ids
        if invalid:
            raise HTTPException(
                status_code=422, detail=f"Invalid integration IDs: {sorted(invalid)}"
            )

    await db.execute(
        delete(UserIntegrationAccess).where(UserIntegrationAccess.user_id == user_id)
    )

    for integration_id in body.integration_ids:
        db.add(UserIntegrationAccess(
            user_id=user_id,
            integration_id=integration_id,
            granted_by=current_user.id,
        ))

    await db.commit()

    rows = await db.execute(
        select(UserIntegrationAccess, Integration.name)
        .join(Integration, UserIntegrationAccess.integration_id == Integration.id)
        .where(UserIntegrationAccess.user_id == user_id)
    )
    return [
        UserAccessResponse(id=access.id, integration_id=access.integration_id, integration_name=name)
        for access, name in rows.all()
    ]
