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

    return PinResponse.model_validate(pin)


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

    return PinResponse.model_validate(pin)


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
