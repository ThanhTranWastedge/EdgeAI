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


def test_ragflow_build_question_without_context_or_history_preserves_raw_message():
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
    })

    assert provider._build_question("plain question") == "plain question"


@pytest.mark.asyncio
async def test_ragflow_send_with_history_builds_transcript_before_latest_question():
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

    history = [
        {"role": "user", "content": "What is the policy?"},
        {"role": "assistant", "content": "The policy is A."},
    ]

    with patch("app.chat.providers.ragflow.RAGFlow", return_value=mock_rag):
        await provider.send_message(
            "Can you expand on that?",
            context=["Pinned context"],
            history=history,
        )

    assert captured_question.index("[Injected context]: Pinned context") < captured_question.index("[Conversation so far]")
    assert "User: What is the policy?" in captured_question
    assert "Assistant: The policy is A." in captured_question
    assert captured_question.endswith("User question: Can you expand on that?")


@pytest.mark.asyncio
async def test_ragflow_agent_lookup_filters_client_side():
    config = {
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "agent_id": "agent-uuid",
        "type": "agent",
    }
    provider = RagflowProvider(config)

    mock_session = MagicMock()
    mock_session.id = "agent-session"
    mock_message = MagicMock()
    mock_message.content = "agent answer"
    mock_message.reference = []
    mock_session.ask = MagicMock(return_value=iter([mock_message]))

    other_agent = MagicMock()
    other_agent.id = "other-agent"
    target_agent = MagicMock()
    target_agent.id = "agent-uuid"
    target_agent.create_session.return_value = mock_session

    class Ragflow0255Mock:
        def list_agents(self):
            return [other_agent, target_agent]

    with patch("app.chat.providers.ragflow.RAGFlow", return_value=Ragflow0255Mock()):
        result = await provider.send_message("question")
        assert result.content == "agent answer"
        target_agent.create_session.assert_called_once()


def test_extract_references_preserves_ragflow_chunk_dicts():
    provider = RagflowProvider({
        "base_url": "http://localhost:9380",
        "api_key": "ragflow-key",
        "chat_id": "chat-uuid",
    })
    message = MagicMock()
    message.reference = [
        {"content": "chunk", "document_name": "doc.md", "similarity": 0.91, "id": "chunk-1"}
    ]

    assert provider._extract_references(message) == message.reference
