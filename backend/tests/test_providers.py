import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from app.chat.providers.base import ChatProvider, ChatResponse, StreamChunk
from app.chat.providers.openai_compat import OpenAICompatProvider
from app.chat.providers.factory import get_provider
from app.models import Integration


def test_chat_response_dataclass():
    r = ChatResponse(content="hello", references=None, provider_session_id=None)
    assert r.content == "hello"


def test_stream_chunk_dataclass():
    c = StreamChunk(content="hi", done=False)
    assert c.done is False
    c2 = StreamChunk(content="", done=True, references=[{"doc": "test"}], provider_session_id="sid")
    assert c2.done is True


@pytest.mark.asyncio
async def test_openai_compat_send_message():
    config = {
        "base_url": "https://api.example.com/v1",
        "api_key": "sk-test",
        "model": "gpt-4",
        "system_prompt": "You are helpful.",
        "parameters": {"temperature": 0.7, "max_tokens": 100},
    }
    provider = OpenAICompatProvider(config)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "Hello from LLM"}}]
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.send_message("Hi", context=["some context"])
        assert isinstance(result, ChatResponse)
        assert result.content == "Hello from LLM"


@pytest.mark.asyncio
async def test_openai_compat_includes_history_between_context_and_latest_message():
    config = {
        "base_url": "https://api.example.com/v1",
        "api_key": "sk-test",
        "model": "gpt-4",
        "system_prompt": "You are helpful.",
        "parameters": {"temperature": 0.7},
    }
    provider = OpenAICompatProvider(config)

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "Follow-up answer"}}]
    }
    mock_response.raise_for_status = MagicMock()

    captured_payload = None

    async def fake_post(*args, **kwargs):
        nonlocal captured_payload
        captured_payload = kwargs["json"]
        return mock_response

    history = [
        {"role": "user", "content": "Initial question"},
        {"role": "assistant", "content": "Initial answer"},
    ]

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=fake_post):
        result = await provider.send_message(
            "Follow-up question",
            context=["Pinned context"],
            history=history,
        )

    assert result.content == "Follow-up answer"
    assert captured_payload["messages"] == [
        {"role": "system", "content": "You are helpful."},
        {"role": "system", "content": "[Injected context]: Pinned context"},
        {"role": "user", "content": "Initial question"},
        {"role": "assistant", "content": "Initial answer"},
        {"role": "user", "content": "Follow-up question"},
    ]


def test_get_provider_openai():
    integration = MagicMock(spec=Integration)
    integration.provider_type = "openai_compatible"
    integration.provider_config = json.dumps({
        "base_url": "https://api.example.com/v1",
        "api_key": "sk-test",
        "model": "gpt-4",
        "system_prompt": "Hi",
    })
    provider = get_provider(integration)
    assert isinstance(provider, OpenAICompatProvider)


def test_get_provider_unknown_raises():
    integration = MagicMock(spec=Integration)
    integration.provider_type = "unknown"
    integration.provider_config = "{}"
    with pytest.raises(ValueError, match="Unknown provider"):
        get_provider(integration)
