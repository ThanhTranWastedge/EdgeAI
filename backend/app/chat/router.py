import json
import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Integration, Session, Message, PinnedResponse, User, UserIntegrationAccess
from app.auth.dependencies import get_current_user
from app.constants import ROLE_USER
from app.chat.schemas import (
    SendMessageRequest,
    TargetedSendMessageRequest,
    SendMessageResponse,
    SessionResponse,
    SessionDetailResponse,
    MessageResponse,
)
from app.chat.providers.base import ChatHistoryMessage
from app.chat.providers.factory import get_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _serialize_refs(references) -> str | None:
    return json.dumps(references) if references else None


MAX_USER_QUESTIONS_PER_SESSION = 10
ASSISTANT_STREAM_ERROR_MESSAGE = "Assistant response failed during streaming. Please start a new chat or try another question."
_session_append_locks: dict[str, asyncio.Lock] = {}


def _get_session_append_lock(session_id: str) -> asyncio.Lock:
    lock = _session_append_locks.get(session_id)
    if lock is None:
        lock = asyncio.Lock()
        _session_append_locks[session_id] = lock
    return lock


async def _ensure_integration_access(db: AsyncSession, user: User, integration_id: str) -> None:
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


async def _get_owned_session(
    db: AsyncSession,
    user: User,
    session_id: str,
) -> Session:
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


async def _count_user_messages(db: AsyncSession, session_id: str) -> int:
    result = await db.execute(
        select(func.count()).select_from(Message).where(
            Message.session_id == session_id,
            Message.role == "user",
        )
    )
    return int(result.scalar_one())


async def _get_next_sequence(db: AsyncSession, session_id: str) -> int:
    result = await db.execute(
        select(func.max(Message.sequence)).where(Message.session_id == session_id)
    )
    max_sequence = result.scalar_one_or_none()
    return int(max_sequence or 0) + 1


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


async def _send_streaming(
    db: AsyncSession,
    user: User,
    integration: Integration,
    message: str,
    context,
    existing_session: Session | None,
    history,
    next_sequence: int | None,
    append_lock=None,
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
    return await _stream_response(
        integration,
        session.id,
        message,
        context,
        history,
        user_sequence + 1,
        append_lock=append_lock,
    )


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


async def _stream_response(
    integration,
    session_id,
    message,
    context,
    history,
    assistant_sequence,
    append_lock=None,
):
    """Return SSE streaming response. Saves full message to DB after stream completes."""
    from sse_starlette.sse import EventSourceResponse

    provider = get_provider(integration)

    async def event_generator():
        full_content = ""
        references = None
        provider_session_id = None
        assistant_saved = False

        try:
            try:
                chunk_count = 0
                async for chunk in provider.stream_message(message, context=context, history=history):
                    if chunk.done:
                        references = chunk.references
                        provider_session_id = chunk.provider_session_id
                        logger.debug(f"Stream complete: {chunk_count} chunks, {len(full_content)} chars")
                        await _save_stream_assistant_message(
                            session_id,
                            full_content,
                            references,
                            assistant_sequence,
                            provider_session_id,
                        )
                        assistant_saved = True
                        yield {"event": "done", "data": json.dumps({
                            "references": references,
                            "provider_session_id": provider_session_id,
                            "session_id": session_id,
                        })}
                    else:
                        chunk_count += 1
                        full_content += chunk.content
                        yield {"data": chunk.content}
            except Exception as e:
                logger.error(f"Stream error after {chunk_count} chunks ({len(full_content)} chars): {e}")
                await _save_stream_assistant_message(
                    session_id,
                    ASSISTANT_STREAM_ERROR_MESSAGE,
                    None,
                    assistant_sequence,
                )
                yield {"event": "error", "data": json.dumps({
                    "detail": "Provider error during streaming",
                    "session_id": session_id,
                })}
                return

            if not assistant_saved:
                await _save_stream_assistant_message(
                    session_id,
                    full_content,
                    references,
                    assistant_sequence,
                    provider_session_id,
                )
        finally:
            if append_lock:
                append_lock.release()

    return EventSourceResponse(event_generator())


async def _save_stream_assistant_message(
    session_id,
    content,
    references,
    assistant_sequence,
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
        )
        save_db.add(assistant_msg)
        if provider_session_id:
            await save_db.execute(
                Session.__table__.update()
                .where(Session.__table__.c.id == session_id)
                .values(ragflow_session_id=provider_session_id)
            )
        await save_db.commit()


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
        .limit(100)
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
        integration_name=session.integration_name,
        last_integration_id=session.last_integration_id,
        last_integration_name=session.last_integration_name,
        title=session.title,
        messages=[MessageResponse.model_validate(m) for m in messages],
    )
