import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.chat.providers.ragflow import RagflowProvider
from app.chat.providers.base import ChatResponse


@pytest.mark.asyncio
async def test_ragflow_send_message():
    config = {
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
    }
    provider = RagflowProvider(config)

    mock_session = MagicMock()
    mock_session.id = "session-123"

    mock_message = MagicMock()
    mock_message.content = "Optimized query result"
    mock_message.reference = []
    mock_session.ask = MagicMock(return_value=iter([mock_message]))

    mock_chat = MagicMock()
    mock_chat.create_session.return_value = mock_session

    mock_rag = MagicMock()
    mock_rag.list_chats.return_value = [mock_chat]

    with patch("app.chat.providers.ragflow.RAGFlow", return_value=mock_rag):
        result = await provider.send_message("Optimize this query", context=["some context"])
        assert isinstance(result, ChatResponse)
        assert result.content == "Optimized query result"
        assert result.provider_session_id == "session-123"


@pytest.mark.asyncio
async def test_ragflow_send_with_context_prepends():
    config = {
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
        "type": "chat",
    }
    provider = RagflowProvider(config)

    mock_session = MagicMock()
    mock_session.id = "s1"
    mock_message = MagicMock()
    mock_message.content = "answer"
    mock_message.reference = []

    captured_question = None
    def fake_ask(question, stream=False):
        nonlocal captured_question
        captured_question = question
        return iter([mock_message])

    mock_session.ask = fake_ask
    mock_chat = MagicMock()
    mock_chat.create_session.return_value = mock_session
    mock_rag = MagicMock()
    mock_rag.list_chats.return_value = [mock_chat]

    with patch("app.chat.providers.ragflow.RAGFlow", return_value=mock_rag):
        await provider.send_message("my question", context=["ctx1", "ctx2"])
        assert "[Injected context]:" in captured_question
        assert "my question" in captured_question
