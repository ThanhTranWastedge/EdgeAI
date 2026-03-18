# EdgeAI User Guide

EdgeAI is a chat gateway that lets you interact with AI assistants powered by RAGFlow or OpenAI-compatible APIs. You can pin useful responses and inject them as context into future chats across different integrations.

## Getting Started

### Logging In

Navigate to the app URL (default: `http://localhost:3000`) and sign in with the credentials provided by your administrator.

After login, you'll land on the **Chat** page.

### Chat Page Layout

The chat page has three areas:

- **Left sidebar (top):** Available integrations — each represents a configured AI assistant
- **Left sidebar (bottom):** Recent session history for the selected integration
- **Main area:** Chat window with message input

## Chatting

### Sending a Message

1. Click an integration from the sidebar to select it
2. Type your message in the input field at the bottom
3. Press **Enter** or click **Send**

Each message creates a new session — EdgeAI is designed for single question-and-answer interactions, not multi-turn conversations.

The assistant's response streams in real-time. Once complete, the session appears in the sidebar history.

### Viewing Past Sessions

Click any session in the **Recent Sessions** sidebar to view both your question and the assistant's response.

## Pinning Responses

Pinning lets you save useful assistant responses and reuse them as context in future chats — even with different integrations.

### How to Pin

1. After receiving a response, click the **Pin** button below the assistant's message
2. Enter a descriptive label (e.g., "Marketing strategy summary")
3. The message is now saved to your pin collection

### Injecting Pins as Context

1. Click the **Pin** button next to the input field to open the pin selector
2. Check the pins you want to inject — a yellow banner shows selected pins
3. Type your message and send
4. The pinned content is automatically prepended to your question as additional context for the AI

This is useful for carrying knowledge across different integrations. For example, pin a response from a RAGFlow knowledge base and inject it into an OpenAI chat for further analysis.

### Managing Pins

- To **remove a pin from injection**, click `[remove]` on the yellow banner
- To **delete a pin permanently**, use the pin management features

## Message Actions

Each assistant response has two action buttons:

- **Pin** — Save the response for future context injection
- **Copy** — Copy the response text to your clipboard

RAGFlow responses may also show **References** at the bottom, listing the source documents used to generate the answer.

## Admin Features

If your account has admin privileges, you'll see an **Admin** button in the top navigation bar.

### Managing Integrations

Integrations connect EdgeAI to AI providers. As an admin, you can:

1. Go to **Admin** > **Integrations**
2. Fill in the integration details:
   - **Name** — Display name (e.g., "Marketing Assistant")
   - **Provider Type** — Choose RAGFlow or OpenAI Compatible
   - **Config JSON** — Provider-specific configuration (see below)
3. Click **Add**

To delete an integration, click the **Delete** button next to it.

#### RAGFlow Integration Config

```json
{
  "base_url": "http://your-ragflow-server:9380",
  "api_key": "your-ragflow-api-key",
  "chat_id": "chat-assistant-uuid",
  "type": "chat"
}
```

For RAGFlow agents instead of chats:

```json
{
  "base_url": "http://your-ragflow-server:9380",
  "api_key": "your-ragflow-api-key",
  "agent_id": "agent-uuid",
  "type": "agent"
}
```

#### OpenAI-Compatible Integration Config

Works with OpenAI, OpenRouter, local models (Ollama, vLLM), or any API following the OpenAI chat completions format.

```json
{
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-your-api-key",
  "model": "gpt-4",
  "system_prompt": "You are a helpful assistant.",
  "parameters": {
    "temperature": 0.7,
    "max_tokens": 2048
  }
}
```

The `system_prompt` and `parameters` fields are optional.

### Managing Users

1. Go to **Admin** > **Users**
2. To add a user: enter username, password, select role (User or Admin), click **Add**
3. To change a user's role: click **Toggle Role**
4. To remove a user: click **Delete**

## Deployment

### Docker (Recommended)

```bash
SECRET_KEY=your-random-secret ADMIN_PASSWORD=your-admin-password docker compose up -d
```

The app will be available at `http://localhost:3000`.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | — | Random string for JWT signing |
| `ADMIN_PASSWORD` | Yes (first run) | — | Initial admin account password |
| `ADMIN_USERNAME` | No | `admin` | Initial admin account username |

### Stopping

```bash
docker compose down
```

Data persists in the `./data/` directory between restarts.
