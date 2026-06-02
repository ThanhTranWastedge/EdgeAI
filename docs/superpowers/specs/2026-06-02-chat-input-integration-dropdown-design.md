# Chat Input Integration Dropdown Design

## Objective

Move chat/integration selection from the sidebar into the chat input composer. Users can choose the target chat for each message, set an account-level default chat, and send follow-up questions with the visible conversation history to the currently selected target.

The design supports mixed-chat conversations while preserving existing integration-scoped APIs for compatibility.

## Product Behavior

- The chat input dropdown is the only chat selector.
- The sidebar no longer shows the Integrations list.
- Recent Sessions becomes a global list of the user's conversations, shown only on the Chat page.
- A conversation can switch target chats between turns.
- Each send goes to the currently selected chat and includes the visible transcript history plus the new user message.
- Assistant messages show a subtle source label such as `Answered by Invoice Bot`.
- Recent session items show the title and a subtle last-used chat label.
- Reopening a session restores the session's last-used chat when the user still has access. If not, it falls back to the resolved default chat.
- Historical transcripts remain viewable even if access to a previously used chat changes.
- New Chat resets to the saved default chat, or the first accessible chat if the saved default is unavailable.
- Selecting a chat does not update the default. Users set the default through an explicit dropdown action.
- The 10-user-question limit remains per conversation, regardless of how many chats answer within that conversation.
- Pins remain request-scoped and apply only to the next message.
- No retry UI is included in this feature.

## Frontend Design

The chat composer contains:

- chat selector on the left on desktop
- chat selector in a compact row above the textarea on mobile
- New Chat icon button near the selector
- existing Pin control
- textarea with placeholder based on the selected chat, such as `Ask WasteEdge Chat something...`
- subtle `x/10` question counter near the send control
- existing send button

The dropdown is a simple menu for v1. It shows:

- chat name
- provider type as secondary text
- checkmark for the currently selected chat
- separate default marker for the saved default
- `Set as default` action

The saved default appears first, followed by the remaining accessible chats in backend order.

Opening greetings remain tied to the currently selected chat while the conversation is empty. If the user switches chat before sending, the greeting changes. Once messages exist, greetings are hidden.

The dropdown is disabled while a response is streaming.

Accessible integrations should be fetched at Chat page load and stored in shared chat state or a dedicated hook, because the selector, default resolution, empty state, session restore, and placeholder all need the same list.

If the user has no accessible chats, the composer is disabled and the chat area shows a concise empty state:

`No chats available. Contact your manager for access.`

## Backend API Design

Add session-centered endpoints for the new UI:

- `GET /api/chat/sessions`
  - Returns global recent sessions for the authenticated user.
  - Includes starting and last-used chat metadata.
- `GET /api/chat/sessions/{session_id}`
  - Returns a session owned by the authenticated user, regardless of current access to historical integrations.
  - Includes message-level integration metadata.
- `POST /api/chat/send`
  - Creates the session on first send.
  - Body includes `integration_id`, `message`, optional `pinned_ids`, and `stream`.
- `POST /api/chat/sessions/{session_id}/send`
  - Appends a follow-up to an existing owned session.
  - Body includes `integration_id`, `message`, optional `pinned_ids`, and `stream`.

Preserve existing integration-scoped endpoints:

- `POST /api/chat/{integration_id}/send`
- `GET /api/chat/{integration_id}/sessions`
- `GET /api/chat/{integration_id}/sessions/{session_id}`

The old send endpoint can delegate to the new send logic using the path `integration_id`. Old session list/detail endpoints remain integration-filtered for compatibility.

Current integration access is required for the selected send target. Historical session viewing only requires session ownership.

## Data Model

Add nullable `users.default_integration_id`.

Keep `sessions.integration_id` as the starting integration for compatibility. Add:

- `sessions.integration_name`
- `sessions.last_integration_id`
- `sessions.last_integration_name`

Add message metadata:

- `messages.integration_id`
- `messages.integration_name`

Store the selected integration id and name snapshot on both the user message and assistant message for each turn. The UI primarily labels assistant messages, but both sides should be auditable.

Name snapshots are intentional. They keep old transcripts readable after integration rename or deletion.

Existing rows without new metadata are still valid. For display, infer missing message/session integration metadata from `sessions.integration_id` and the current integration row when available.

## Default Chat Preference

The saved default chat is account-scoped, not browser-scoped.

Expose the preference through authenticated APIs:

- include `default_integration_id` in `/api/auth/me`
- add `PUT /api/auth/default-integration` with body `{ "integration_id": string | null }`

The update endpoint validates that a non-null integration id is currently accessible to the authenticated user. Passing `null` clears the saved default.

The frontend resolves a usable default by:

1. using the saved default if it is in the accessible integrations list
2. otherwise using the first accessible integration
3. otherwise leaving no target selected and disabling the composer

Fallback resolution does not write back to the database. Only the explicit `Set as default` dropdown action updates `users.default_integration_id`.

Deleting an integration clears matching `users.default_integration_id` values during the delete transaction.

## Provider History

For every send, EdgeAI builds provider history from the full visible transcript, then appends the new user message last.

This ordering is mandatory for RAGFlow's OpenAI-compatible API, which returns an error if the final conversation item is not from `user`.

Assistant messages generated by other chats should be labeled inside the provider history. Example:

```text
Assistant (Invoice Bot): The matching invoices are...
```

OpenAI-compatible providers continue to send structured chat-completion `messages`.

RAGFlow integrations use OpenAI-compatible endpoints:

- RAGFlow `type: "chat"`: `POST /api/v1/openai/{chat_id}/chat/completions`
- RAGFlow `type: "agent"`: `POST /api/v1/agents_openai/{agent_id}/chat/completions`

Both receive structured `messages` rather than a flattened transcript string. EdgeAI's stored transcript remains the source of truth. Provider session ids, if returned, are stored only as metadata and are not used to reconstruct mixed-chat history.

For RAGFlow references:

- chat sends should request `extra_body.reference: true`
- reference metadata should be parsed from final streaming chunks or final non-stream responses when present
- existing frontend reference display should continue to work

If an older RAGFlow deployment does not support the OpenAI-compatible endpoint, EdgeAI should return a clear provider error rather than silently falling back to hidden provider session state.

## Persistence And Streaming

First sends create a session only when the user submits a message. Selecting a dropdown option or clicking New Chat does not create an empty session.

For streaming sends, keep the current optimistic UI pattern:

- append a temporary user message with selected chat metadata
- append an empty temporary assistant message with selected chat metadata
- stream chunks into the assistant bubble
- reload the persisted session on completion or persisted error when a session id is available

If a provider fails after the user message/session is persisted, the error assistant message stores the attempted integration metadata. The session's last-used integration also reflects that attempted target.

## Migration

Add idempotent startup migrations for existing SQLite deployments. `Base.metadata.create_all` is not enough for existing databases because it does not add columns to existing tables.

Startup migration responsibilities:

- add new nullable columns if missing
- leave existing user, integration, session, message, and pin data intact
- preserve current test behavior with in-memory SQLite and `create_all`

## Error Handling

- Sending to an inaccessible selected integration returns the existing access error.
- Loading an owned historical session does not fail because the user lost access to a historical integration.
- If the restored last-used integration is inaccessible or deleted, the frontend loads the transcript and selects the resolved default target.
- If the saved default is unavailable, the frontend resolves a usable target without overwriting the saved preference.
- If there are no accessible integrations, the composer stays disabled.
- If the 10-question cap is reached, sending is disabled and the backend remains authoritative.

## Testing

Backend pytest coverage should include:

- default chat preference get/update
- fallback when saved default is unavailable
- integration deletion clearing defaults
- global session listing and session detail
- first send through `POST /api/chat/send`
- follow-up send through `POST /api/chat/sessions/{session_id}/send`
- mixed-target conversation history sent to the selected provider
- current send target requires access
- historical session view does not require current access to every historical integration
- 10-question cap across mixed targets
- per-message and per-session integration metadata
- old integration-scoped endpoint compatibility
- RAGFlow chat and agent OpenAI-compatible request formatting
- RAGFlow streaming and non-streaming reference parsing
- provider history ordering with the new user message last

Frontend verification uses the existing project checks:

- `npm run build`
- lint checks, with unrelated pre-existing lint failures documented if they remain

No new frontend test framework is part of this feature.

## Documentation

Update `docs/developer-guide.md` with:

- new session-centered APIs
- compatibility behavior for old integration-scoped APIs
- new schema columns
- account default chat preference
- mixed-chat provider history rules
- RAGFlow OpenAI-compatible endpoints
- startup migration behavior

Update `docs/user-guide.md` with:

- dropdown chat selection in the input
- setting a default chat
- global recent sessions
- assistant source labels
- switching target chats during a conversation
- pins remaining request-scoped
- 10-question conversation limit

## Sources

- RAGFlow HTTP API reference: https://ragflow.io/docs/http_api_reference
