import asyncio
import json
from typing import AsyncGenerator
from ragflow_sdk import RAGFlow
from app.chat.providers.base import ChatProvider, ChatResponse, StreamChunk


class RagflowProvider(ChatProvider):
    def __init__(self, config: dict):
        self.base_url = config["base_url"]
        self.api_key = config["api_key"]
        self.chat_or_agent_id = config.get("chat_id") or config.get("agent_id")
        self.entity_type = config.get("type", "chat")  # "chat" or "agent"

    def _get_entity(self, rag: RAGFlow):
        if self.entity_type == "chat":
            chats = rag.list_chats(id=self.chat_or_agent_id)
            if not chats:
                raise ValueError(f"RAGFlow chat {self.chat_or_agent_id} not found")
            return chats[0]
        else:
            agents = rag.list_agents(id=self.chat_or_agent_id)
            if not agents:
                raise ValueError(f"RAGFlow agent {self.chat_or_agent_id} not found")
            return agents[0]

    def _build_question(self, message: str, context: list[str] | None = None) -> str:
        if not context:
            return message
        ctx_parts = [f"[Injected context]: {c}" for c in context]
        return "\n\n".join(ctx_parts) + f"\n\nUser question: {message}"

    def _extract_references(self, message_obj) -> list[dict] | None:
        refs = getattr(message_obj, "reference", None)
        if not refs:
            return None
        if isinstance(refs, list):
            result = []
            for ref in refs:
                result.append({
                    "content": getattr(ref, "content", ""),
                    "document_name": getattr(ref, "document_name", ""),
                    "similarity": getattr(ref, "similarity", 0),
                })
            return result if result else None
        return None

    def _sync_send(self, message: str, context: list[str] | None = None) -> ChatResponse:
        rag = RAGFlow(api_key=self.api_key, base_url=self.base_url)
        entity = self._get_entity(rag)
        session = entity.create_session()
        question = self._build_question(message, context)

        full_content = ""
        references = None
        for chunk in session.ask(question, stream=False):
            full_content = chunk.content
            references = self._extract_references(chunk)

        return ChatResponse(
            content=full_content,
            references=references,
            provider_session_id=session.id,
        )

    async def send_message(self, message: str, context: list[str] | None = None) -> ChatResponse:
        return await asyncio.to_thread(self._sync_send, message, context)

    async def stream_message(self, message: str, context: list[str] | None = None) -> AsyncGenerator[StreamChunk, None]:
        rag = RAGFlow(api_key=self.api_key, base_url=self.base_url)
        entity = self._get_entity(rag)
        session = entity.create_session()
        question = self._build_question(message, context)

        last_content = ""
        references = None
        for chunk in session.ask(question, stream=True):
            new_text = chunk.content[len(last_content):]
            last_content = chunk.content
            references = self._extract_references(chunk)
            if new_text:
                yield StreamChunk(content=new_text)

        yield StreamChunk(
            content="",
            done=True,
            references=references,
            provider_session_id=session.id,
        )
