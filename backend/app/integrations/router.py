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
