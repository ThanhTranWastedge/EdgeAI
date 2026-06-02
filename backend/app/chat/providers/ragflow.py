import json
from typing import AsyncGenerator

import httpx

from app.chat.providers.base import ChatHistoryMessage, ChatProvider, ChatResponse, StreamChunk


class RagflowProvider(ChatProvider):
    def __init__(self, config: dict):
        self.base_url = config["base_url"].rstrip("/")
        self.api_key = config["api_key"]
        self.chat_or_agent_id = config.get("chat_id") or config.get("agent_id")
        self.entity_type = config.get("type", "chat")
        self.model = config.get("model", "model")
        self.parameters = config.get("parameters", {})
        self._headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _endpoint(self) -> str:
        if self.entity_type == "agent":
            return f"{self.base_url}/api/v1/agents_openai/{self.chat_or_agent_id}/chat/completions"
        return f"{self.base_url}/api/v1/openai/{self.chat_or_agent_id}/chat/completions"

    def _chat_fallback_endpoint(self) -> str:
        return f"{self.base_url}/api/v1/chats_openai/{self.chat_or_agent_id}/chat/completions"

    def _should_use_chat_fallback(self, exc: httpx.HTTPStatusError) -> bool:
        return self.entity_type == "chat" and exc.response.status_code in {404, 405}

    def _build_messages(
        self,
        message: str,
        context: list[str] | None = None,
        history: list[ChatHistoryMessage] | None = None,
    ) -> list[dict]:
        messages = []
        if context:
            for ctx in context:
                messages.append({"role": "system", "content": f"[Injected context]: {ctx}"})
        if history:
            messages.extend({"role": item["role"], "content": item["content"]} for item in history)
        messages.append({"role": "user", "content": message})
        return messages

    def _payload(self, message: str, context=None, history=None, stream=False) -> dict:
        payload = {
            "model": self.model,
            "messages": self._build_messages(message, context, history),
            "stream": stream,
            **self.parameters,
        }
        if self.entity_type == "chat":
            extra_body = dict(payload.get("extra_body") or {})
            extra_body.setdefault("reference", True)
            payload["extra_body"] = extra_body
        return payload

    def _extract_reference(self, message_obj: dict) -> dict | list[dict] | None:
        reference = message_obj.get("reference")
        return reference or None

    async def send_message(self, message: str, context=None, history=None) -> ChatResponse:
        payload = self._payload(message, context, history, stream=False)
        async with httpx.AsyncClient(headers=self._headers, timeout=120.0) as client:
            try:
                response = await client.post(self._endpoint(), json=payload)
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                if not self._should_use_chat_fallback(exc):
                    raise
                response = await client.post(self._chat_fallback_endpoint(), json=payload)
                response.raise_for_status()
            data = response.json()

        message_obj = data["choices"][0]["message"]
        return ChatResponse(
            content=message_obj.get("content") or "",
            references=self._extract_reference(message_obj),
            provider_session_id=data.get("id"),
        )

    async def _stream_chunks(
        self,
        client: httpx.AsyncClient,
        endpoint: str,
        payload: dict,
    ) -> AsyncGenerator[StreamChunk, None]:
        references = None
        provider_session_id = None
        async with client.stream("POST", endpoint, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data_str = line[len("data:"):].strip()
                if data_str.strip() == "[DONE]":
                    yield StreamChunk(
                        content="",
                        done=True,
                        references=references,
                        provider_session_id=provider_session_id,
                    )
                    return
                data = json.loads(data_str)
                provider_session_id = data.get("id") or provider_session_id
                delta = data["choices"][0].get("delta", {})
                if delta.get("reference"):
                    references = delta["reference"]
                content = delta.get("content") or ""
                if content:
                    yield StreamChunk(content=content)
        yield StreamChunk(
            content="",
            done=True,
            references=references,
            provider_session_id=provider_session_id,
        )

    async def stream_message(
        self,
        message: str,
        context=None,
        history=None,
    ) -> AsyncGenerator[StreamChunk, None]:
        payload = self._payload(message, context, history, stream=True)
        async with httpx.AsyncClient(headers=self._headers, timeout=120.0) as client:
            yielded_chunk = False
            try:
                async for chunk in self._stream_chunks(client, self._endpoint(), payload):
                    yielded_chunk = True
                    yield chunk
            except httpx.HTTPStatusError as exc:
                if yielded_chunk or not self._should_use_chat_fallback(exc):
                    raise
                async for chunk in self._stream_chunks(client, self._chat_fallback_endpoint(), payload):
                    yield chunk
