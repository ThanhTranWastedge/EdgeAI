from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncGenerator, Literal, TypedDict


class ChatHistoryMessage(TypedDict):
    role: Literal["user", "assistant"]
    content: str


@dataclass
class ChatResponse:
    content: str
    references: object | None = None
    provider_session_id: str | None = None


@dataclass
class StreamChunk:
    content: str
    done: bool = False
    references: object | None = None
    provider_session_id: str | None = None


class ChatProvider(ABC):
    @abstractmethod
    async def send_message(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> ChatResponse:
        ...

    @abstractmethod
    async def stream_message(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        ...
