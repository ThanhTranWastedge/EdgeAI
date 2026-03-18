from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncGenerator


@dataclass
class ChatResponse:
    content: str
    references: list[dict] | None = None
    provider_session_id: str | None = None


@dataclass
class StreamChunk:
    content: str
    done: bool = False
    references: list[dict] | None = None
    provider_session_id: str | None = None


class ChatProvider(ABC):
    @abstractmethod
    async def send_message(
        self,
        message: str,
        context: list[str] | None = None,
    ) -> ChatResponse:
        ...

    @abstractmethod
    async def stream_message(
        self,
        message: str,
        context: list[str] | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        ...
