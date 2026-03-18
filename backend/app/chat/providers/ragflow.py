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

        queue: asyncio.Queue[StreamChunk | None] = asyncio.Queue()

        def _stream_sync():
            last_content = ""
            last_chunk = None
            try:
                for chunk in session.ask(question, stream=True):
                    content = chunk.content or ""
                    if content.startswith(last_content):
                        new_text = content[len(last_content):]
                    else:
                        # Content reset (e.g. agent switching components)
                        new_text = content
                    last_content = content
                    last_chunk = chunk
                    if new_text:
                        queue.put_nowait(StreamChunk(content=new_text))
            except Exception as e:
                queue.put_nowait(StreamChunk(content=str(e), done=True))
                return
            references = self._extract_references(last_chunk) if last_chunk else None
            queue.put_nowait(StreamChunk(
                content="", done=True, references=references,
                provider_session_id=session.id,
            ))

        loop = asyncio.get_event_loop()
        task = loop.run_in_executor(None, _stream_sync)

        while True:
            # Wait for either a chunk or the thread to finish
            try:
                chunk = await asyncio.wait_for(queue.get(), timeout=0.1)
                yield chunk
                if chunk.done:
                    break
            except asyncio.TimeoutError:
                if task.done():
                    # Drain remaining items
                    while not queue.empty():
                        chunk = queue.get_nowait()
                        yield chunk
                    break
