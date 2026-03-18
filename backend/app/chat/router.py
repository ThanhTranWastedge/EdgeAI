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
