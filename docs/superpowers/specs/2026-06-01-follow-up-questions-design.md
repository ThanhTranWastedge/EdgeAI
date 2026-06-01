# Follow-Up Questions Design

## Overview

EdgeAI will support bounded multi-turn chat sessions. A session can contain up to 20 total user questions, normally paired with up to 20 assistant responses. The first question creates a session. Follow-up questions append to the same session when the request includes a session id.

The design keeps the existing chat endpoint and provider abstraction, while adding transcript history as provider input. Local EdgeAI messages are the source of truth for follow-up context across all providers.

## Goals

- Let users ask follow-up questions in the same session.
- Cap each session at 20 total user questions.
- Allow users to continue previous sessions from Recent Sessions.
- Keep selected pins request-scoped and available for follow-ups.
- Preserve existing streaming and non-streaming API behavior where possible.
- Keep the first version provider-agnostic and avoid provider-native session dependencies.

## Non-Goals

- Message editing, deletion, retry, or branching.
- Automatic title regeneration or summarization.
- Provider-native session reuse, including RAGFlow session continuation.
- Integration deletion cleanup changes.
- Multi-session comparison or cross-session transcript merging.

## User Behavior

Selecting an integration without choosing a session starts in a blank chat state with the integration greeting. Sending the first question creates a new session.

Clicking a prior session in Recent Sessions loads its messages and makes it the active session. If that session has fewer than 20 user questions, the user can continue it. If it has 20 user questions, sending is disabled and the UI shows a short message such as:

> 20-question limit reached. Start a new chat to continue.

A New Chat control clears the active session id, current messages, selected pins, and local errors for the selected integration. It does not delete prior history.

Pins remain request-scoped. Users can select pins for any question, including follow-ups. Selected pins are injected only into the request where they are selected, then cleared after a successful send. The transcript carries normal follow-up context.

Session titles remain based on the first question's first 80 characters.

## Backend API

`POST /api/chat/{integration_id}/send` remains the single send endpoint.

`SendMessageRequest` gains an optional field:

```python
session_id: str | None = None
```

When `session_id` is absent, the endpoint creates a new session after validating integration access.

When `session_id` is present, the endpoint verifies:

- the session exists
- the session belongs to the authenticated user
- the session belongs to the requested integration
- the user still has access to the integration
- the session has fewer than 20 existing user messages

For missing, foreign, or integration-mismatched sessions, the backend returns `404 Session not found` to avoid leaking session existence. If current integration access is missing, the backend returns the existing `403` response. If the session already has 20 user messages, the backend returns `400 Session question limit reached`.

The response remains:

```python
{
  "session_id": "...",
  "assistant_message": { ... }
}
```

For streaming requests, the SSE `done` event must include the EdgeAI `session_id` in its metadata so the frontend can set the active session after the first streamed question creates a new session. Provider-native ids, such as `provider_session_id`, remain separate metadata.

## Persistence

Messages append to the existing session using the next available sequence numbers:

- next user message sequence: `max(sequence) + 1`
- next assistant message sequence: `max(sequence) + 2`

This avoids assuming perfect user/assistant pairs in legacy or failed-stream data.

For non-streaming requests, the backend loads prior history, calls the provider, and persists the new user and assistant messages only after the provider succeeds. This preserves the existing no-orphan behavior for provider failures.

For streaming requests, the backend persists the user message before returning the SSE response. When streaming completes, it persists the assistant message. If the provider fails mid-stream after the user message is saved, EdgeAI persists an assistant error message so the transcript shows the failed turn and sequence numbers remain coherent.

Failed persisted user turns count toward the 20-question cap.

Existing two-message sessions are treated as one-question sessions and can be continued until they reach 20 user messages.

## Provider Contract

`ChatProvider` gains a `history` argument while retaining `context` for selected pin content:

```python
async def send_message(
    message: str,
    context: list[str] | None = None,
    history: list[ChatHistoryMessage] | None = None,
) -> ChatResponse:
    ...

async def stream_message(
    message: str,
    context: list[str] | None = None,
    history: list[ChatHistoryMessage] | None = None,
) -> AsyncGenerator[StreamChunk, None]:
    ...
```

`ChatHistoryMessage` should contain only `role` and `content`. References and pin metadata are not included in conversation history.

### OpenAI-Compatible Providers

OpenAI-compatible providers build chat completion messages in this order:

1. configured system prompt, if present
2. selected pin context as system messages, if any
3. prior history as normal `user` and `assistant` messages
4. latest user message

### RAGFlow Providers

RAGFlow providers continue sending one question string. They build it from:

1. selected pin context
2. a readable prior transcript block
3. the latest user question

EdgeAI does not reuse `ragflow_session_id` for follow-up behavior in this version. Local transcript history is the source of truth.

## Frontend Flow

The chat store tracks the active session id in addition to the active integration, session list, current messages, and streaming state.

Selecting an integration clears the active session id and current messages. Clicking a Recent Sessions entry loads the session messages and sets the active session id.

Sending a message no longer clears current messages. The UI appends temporary user and assistant messages, calls the streaming send API with the active `session_id` when present, then appends streamed chunks to the temporary assistant message. On completion, the frontend refreshes Recent Sessions and updates the active session id from the response.

The chat UI displays a subtle user-question counter such as `7/20`. At `20/20`, the input and send button are disabled for that active session and the user is directed to start a new chat.

Pin selection remains available during follow-ups. Sending remains disabled once the session reaches the cap.

## Error Handling

The frontend should prevent sends when the local session is at `20/20`, but the backend remains authoritative.

If the backend returns the session cap error, the frontend shows the same limit message and keeps the loaded transcript intact.

If a streaming provider fails after the user message is saved, the persisted assistant error message is displayed as part of the transcript. If a non-streaming provider fails, no new messages are persisted.

If a loaded session cannot be continued because access changed or the session no longer exists, the frontend should show the backend error and leave the user able to start a new chat.

## Testing

Backend tests should cover:

- creating a new session without `session_id`
- appending to an existing session with `session_id`
- rejecting sessions owned by another user
- rejecting sessions from another integration
- enforcing current integration access before append
- enforcing the 20-question cap
- non-streaming persistence order on provider success and failure
- streaming append behavior
- streaming provider failure after user message persistence
- provider history passed to OpenAI-compatible providers
- transcript formatting for RAGFlow providers

Frontend verification should cover:

- continuing a loaded session
- New Chat clearing active session state without deleting history
- sending without clearing existing messages
- selected pins on follow-ups
- selected pins clearing after successful send
- the `x/20` counter
- disabled send state at `20/20`

## Documentation

`docs/developer-guide.md` must stop describing sessions as single-turn. It should document optional `session_id`, provider history, request-scoped pins, streaming persistence behavior, and the 20-question cap.

`docs/user-guide.md` must describe follow-up questions, continuing previous sessions, the New Chat action, request-scoped pin behavior during follow-ups, and the 20-question limit.
