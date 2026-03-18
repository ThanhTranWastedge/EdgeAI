import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base
from app.constants import ROLE_USER


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_uuid)
    username = Column(String, unique=True, nullable=False)
    fullname = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default=ROLE_USER)
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


class UserIntegrationAccess(Base):
    __tablename__ = "user_integration_access"
    __table_args__ = (
        UniqueConstraint("user_id", "integration_id", name="uq_user_integration"),
    )

    id = Column(String, primary_key=True, default=new_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    integration_id = Column(String, ForeignKey("integrations.id"), nullable=False)
    granted_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow)
