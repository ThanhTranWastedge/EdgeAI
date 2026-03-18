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

If the integration has an opening greeting configured, you'll see it as a welcome message when no conversation is active.

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

## Settings

Click the **Settings** button in the top navigation bar to access your account settings.

### Changing Your Password

1. Go to **Settings**
2. Enter your current password
3. Enter your new password and confirm it
4. Click **Update Password**

## Manager Features

If your account has the **manager** role, you'll see a **Manager** button in the top navigation bar. Managers can create and manage user accounts and control which integrations each user can access.

### Managing Users

1. Go to **Manager** > **Users**
2. To add a user: enter username, password, select role (User or Manager), click **Add**
3. To toggle a user's role between User and Manager: click **Toggle Role**
4. To remove a user: click **Delete**

Managers cannot create, edit, or delete admin accounts, and cannot change their own role.

### Managing Integration Access

Users have **no access to any integration by default**. A manager or admin must explicitly grant access.

1. Go to **Manager** > **Integration Access**
2. Select a user from the dropdown
3. Check the integrations the user should have access to
4. Click **Save Access**

Users will only see and be able to chat with integrations they've been granted access to. Managers and admins always see all integrations.

## Admin Features

If your account has admin privileges, you'll see both **Manager** and **Admin** buttons in the top navigation bar. Admins have all manager capabilities plus the ability to manage integrations and all user roles.

### Managing Integrations

Integrations connect EdgeAI to AI providers. As an admin, you can:

1. Go to **Admin** > **Integrations**
2. Fill in the integration details:
   - **Name** — Display name (e.g., "Marketing Assistant")
   - **Provider Type** — Choose RAGFlow or OpenAI Compatible
   - **Config JSON** — Provider-specific configuration (see below)
   - **Opening Greeting** (optional) — A welcome message shown to users when they select this integration
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

### Managing Users (Admin)

1. Go to **Admin** > **Users**
2. To add a user: enter username, password, select role (User, Manager, or Admin), click **Add**
3. To cycle a user's role (User → Manager → Admin): click **Toggle Role**
4. To remove a user: click **Delete**

Admins can manage all roles including other admins. For day-to-day user management, the Manager page is recommended.

## Deployment

See `docs/deployment-guide.md` for full deployment instructions including Docker setup, backups, HTTPS, and troubleshooting.

### Quick Start

```bash
git clone --no-checkout <repo-url> EdgeAI && cd EdgeAI
git sparse-checkout init --no-cone
git sparse-checkout set '/*' '!CLAUDE.md' '!docs/'
git checkout

cp .env.example .env
# Edit .env — set SECRET_KEY and ADMIN_PASSWORD
docker compose up -d
```

The app will be available at `http://localhost:3000`. Data persists in the `./data/` directory between restarts.
