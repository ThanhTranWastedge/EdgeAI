from unittest.mock import patch

import httpx
import pytest

from app.chat.providers.ragflow import RagflowProvider


def _http_status_error(status_code: int, url: str) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", url)
    response = httpx.Response(status_code, request=request)
    return httpx.HTTPStatusError(
        f"RAGFlow returned {status_code}",
        request=request,
        response=response,
    )


@pytest.mark.asyncio
async def test_ragflow_chat_uses_openai_compatible_messages():
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
    })

    captured = {}

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "id": "completion-id",
                "choices": [
                    {
                        "message": {
                            "content": "chat answer",
                            "reference": {"chunks": {"1": {"document_name": "doc.md"}}},
                        }
                    }
                ],
            }

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def post(self, url, json):
            captured["url"] = url
            captured["json"] = json
            return Response()

    with patch("app.chat.providers.ragflow.httpx.AsyncClient", return_value=Client()) as async_client:
        result = await provider.send_message(
            "latest",
            context=["pin", "second pin"],
            history=[
                {"role": "user", "content": "prior question"},
                {"role": "assistant", "content": "Assistant (Other): prior"},
            ],
        )

    async_client.assert_called_once_with(
        headers={
            "Authorization": "Bearer ragflow-key",
            "Content-Type": "application/json",
        },
        timeout=120.0,
    )
    assert captured["url"] == "http://localhost:9380/api/v1/openai/chat-uuid/chat/completions"
    assert captured["json"]["model"] == "model"
    assert captured["json"]["stream"] is False
    assert captured["json"]["extra_body"]["reference"] is True
    assert captured["json"]["messages"] == [
        {"role": "system", "content": "[Injected context]: pin"},
        {"role": "system", "content": "[Injected context]: second pin"},
        {"role": "user", "content": "prior question"},
        {"role": "assistant", "content": "Assistant (Other): prior"},
        {"role": "user", "content": "latest"},
    ]
    assert result.content == "chat answer"
    assert result.references == {"chunks": {"1": {"document_name": "doc.md"}}}
    assert result.provider_session_id == "completion-id"


def test_ragflow_chat_payload_preserves_configured_extra_body():
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
        "parameters": {
            "temperature": 0.2,
            "extra_body": {
                "reference": False,
                "top_k": 10,
            },
        },
    })

    payload = provider._payload("question")

    assert payload["temperature"] == 0.2
    assert payload["extra_body"] == {
        "reference": False,
        "top_k": 10,
    }


@pytest.mark.parametrize("status_code", [404, 405])
@pytest.mark.asyncio
async def test_ragflow_chat_falls_back_to_deprecated_openai_endpoint(status_code):
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
    })

    captured = []
    payloads = []

    class ErrorResponse:
        def __init__(self, url):
            self.url = url

        def raise_for_status(self):
            raise _http_status_error(status_code, self.url)

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "id": "fallback-completion",
                "choices": [{"message": {"content": "fallback answer"}}],
            }

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def post(self, url, json):
            captured.append(url)
            payloads.append(json)
            if len(captured) == 1:
                return ErrorResponse(url)
            return Response()

    with patch("app.chat.providers.ragflow.httpx.AsyncClient", return_value=Client()):
        result = await provider.send_message("question", context=["pin"])

    assert captured == [
        "http://localhost:9380/api/v1/openai/chat-uuid/chat/completions",
        "http://localhost:9380/api/v1/chats_openai/chat-uuid/chat/completions",
    ]
    assert payloads[0] == payloads[1]
    assert result.content == "fallback answer"
    assert result.provider_session_id == "fallback-completion"


@pytest.mark.asyncio
async def test_ragflow_chat_does_not_fallback_on_server_error():
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
    })

    captured = []

    class ErrorResponse:
        def __init__(self, url):
            self.url = url

        def raise_for_status(self):
            raise _http_status_error(500, self.url)

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def post(self, url, json):
            captured.append(url)
            return ErrorResponse(url)

    with patch("app.chat.providers.ragflow.httpx.AsyncClient", return_value=Client()):
        with pytest.raises(httpx.HTTPStatusError):
            await provider.send_message("question")

    assert captured == ["http://localhost:9380/api/v1/openai/chat-uuid/chat/completions"]


@pytest.mark.asyncio
async def test_ragflow_agent_uses_agents_openai_endpoint():
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "agent_id": "agent-uuid",
        "type": "agent",
    })

    captured = {}

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "id": "agent-completion",
                "choices": [{"message": {"content": "agent answer"}}],
            }

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def post(self, url, json):
            captured["url"] = url
            captured["json"] = json
            return Response()

    with patch("app.chat.providers.ragflow.httpx.AsyncClient", return_value=Client()) as async_client:
        result = await provider.send_message("question")

    async_client.assert_called_once_with(
        headers={
            "Authorization": "Bearer ragflow-key",
            "Content-Type": "application/json",
        },
        timeout=120.0,
    )
    assert captured["url"] == "http://localhost:9380/api/v1/agents_openai/agent-uuid/chat/completions"
    assert captured["json"]["messages"][-1] == {"role": "user", "content": "question"}
    assert result.content == "agent answer"


@pytest.mark.asyncio
async def test_ragflow_agent_does_not_use_chat_fallback_on_404():
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "agent_id": "agent-uuid",
        "type": "agent",
    })

    captured = []

    class ErrorResponse:
        def __init__(self, url):
            self.url = url

        def raise_for_status(self):
            raise _http_status_error(404, self.url)

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def post(self, url, json):
            captured.append(url)
            return ErrorResponse(url)

    with patch("app.chat.providers.ragflow.httpx.AsyncClient", return_value=Client()):
        with pytest.raises(httpx.HTTPStatusError):
            await provider.send_message("question")

    assert captured == ["http://localhost:9380/api/v1/agents_openai/agent-uuid/chat/completions"]


@pytest.mark.asyncio
async def test_ragflow_stream_parses_content_and_reference():
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
    })

    class StreamResponse:
        def raise_for_status(self):
            pass

        async def aiter_lines(self):
            yield ""
            yield "event: ping"
            yield 'data:{"id":"c1","choices":[{"delta":{"content":null},"finish_reason":null}]}'
            yield 'data: {"id":"c1","choices":[{"delta":{"content":"hello "},"finish_reason":null}]}'
            yield (
                'data:{"id":"c1","choices":[{"delta":{"content":"world"},'
                '"finish_reason":null}]}'
            )
            yield (
                'data:{"id":"c1","choices":[{"delta":{"reference":'
                '{"chunks":{"2":{"document_name":"final.md"}}}},'
                '"finish_reason":null}]}'
            )
            yield "data:[DONE]"

    class StreamContext:
        async def __aenter__(self):
            return StreamResponse()

        async def __aexit__(self, exc_type, exc, tb):
            pass

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        def stream(self, method, url, json):
            return StreamContext()

    with patch("app.chat.providers.ragflow.httpx.AsyncClient", return_value=Client()) as async_client:
        chunks = [chunk async for chunk in provider.stream_message("question")]

    async_client.assert_called_once_with(
        headers={
            "Authorization": "Bearer ragflow-key",
            "Content-Type": "application/json",
        },
        timeout=120.0,
    )
    assert [chunk.content for chunk in chunks] == ["hello ", "world", ""]
    assert chunks[-1].done is True
    assert chunks[-1].references == {"chunks": {"2": {"document_name": "final.md"}}}
    assert chunks[-1].provider_session_id == "c1"


@pytest.mark.parametrize("status_code", [404, 405])
@pytest.mark.asyncio
async def test_ragflow_stream_falls_back_to_deprecated_openai_endpoint(status_code):
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
    })

    captured = []
    payloads = []

    class ErrorStreamResponse:
        def __init__(self, url):
            self.url = url

        def raise_for_status(self):
            raise _http_status_error(status_code, self.url)

    class StreamResponse:
        def raise_for_status(self):
            pass

        async def aiter_lines(self):
            yield 'data: {"id":"fallback-stream","choices":[{"delta":{"content":"fallback"},"finish_reason":null}]}'
            yield "data: [DONE]"

    class StreamContext:
        def __init__(self, response):
            self.response = response

        async def __aenter__(self):
            return self.response

        async def __aexit__(self, exc_type, exc, tb):
            pass

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        def stream(self, method, url, json):
            captured.append(url)
            payloads.append(json)
            if len(captured) == 1:
                return StreamContext(ErrorStreamResponse(url))
            return StreamContext(StreamResponse())

    with patch("app.chat.providers.ragflow.httpx.AsyncClient", return_value=Client()):
        chunks = [chunk async for chunk in provider.stream_message("question")]

    assert captured == [
        "http://localhost:9380/api/v1/openai/chat-uuid/chat/completions",
        "http://localhost:9380/api/v1/chats_openai/chat-uuid/chat/completions",
    ]
    assert payloads[0] == payloads[1]
    assert [chunk.content for chunk in chunks] == ["fallback", ""]
    assert chunks[-1].done is True
    assert chunks[-1].provider_session_id == "fallback-stream"


@pytest.mark.asyncio
async def test_ragflow_stream_does_not_fallback_on_server_error():
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
    })

    captured = []

    class ErrorStreamResponse:
        def __init__(self, url):
            self.url = url

        def raise_for_status(self):
            raise _http_status_error(500, self.url)

    class StreamContext:
        async def __aenter__(self):
            return ErrorStreamResponse(captured[-1])

        async def __aexit__(self, exc_type, exc, tb):
            pass

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        def stream(self, method, url, json):
            captured.append(url)
            return StreamContext()

    with patch("app.chat.providers.ragflow.httpx.AsyncClient", return_value=Client()):
        with pytest.raises(httpx.HTTPStatusError):
            async for _ in provider.stream_message("question"):
                pass

    assert captured == ["http://localhost:9380/api/v1/openai/chat-uuid/chat/completions"]
