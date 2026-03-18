import json
from typing import AsyncGenerator
import httpx
from app.chat.providers.base import ChatProvider, ChatResponse, StreamChunk


class OpenAICompatProvider(ChatProvider):
    def __init__(self, config: dict):
        self.base_url = config["base_url"].rstrip("/")
        self.api_key = config["api_key"]
        self.model = config["model"]
        self.system_prompt = config.get("system_prompt", "")
        self.parameters = config.get("parameters", {})
        self._headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    def _build_messages(self, message: str, context: list[str] | None = None) -> list[dict]:
        messages = []
        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})
        if context:
            for ctx in context:
                messages.append({"role": "system", "content": f"[Injected context]: {ctx}"})
        messages.append({"role": "user", "content": message})
        return messages

    async def send_message(self, message: str, context: list[str] | None = None) -> ChatResponse:
        messages = self._build_messages(message, context)
        payload = {"model": self.model, "messages": messages, "stream": False, **self.parameters}

        async with httpx.AsyncClient(headers=self._headers, timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return ChatResponse(content=content)

    async def stream_message(self, message: str, context: list[str] | None = None) -> AsyncGenerator[StreamChunk, None]:
        messages = self._build_messages(message, context)
        payload = {"model": self.model, "messages": messages, "stream": True, **self.parameters}

        async with httpx.AsyncClient(headers=self._headers, timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        yield StreamChunk(content="", done=True)
                        return
                    data = json.loads(data_str)
                    delta = data["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield StreamChunk(content=content)
        yield StreamChunk(content="", done=True)
