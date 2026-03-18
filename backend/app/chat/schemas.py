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
