import Layout from '../components/Layout'

const sectionStyle = { marginBottom: 28 }
const h3Style = { color: '#64ffda', marginBottom: 8, fontSize: 16 }
const pStyle = { color: '#c9d1d9', lineHeight: 1.6, margin: '4px 0' }
const olStyle = { color: '#c9d1d9', lineHeight: 1.8, paddingLeft: 20, margin: '4px 0' }
const codeStyle = { background: '#21262d', padding: '2px 6px', borderRadius: 3, fontSize: 13, color: '#e0e0e0' }

export default function HelpPage() {
  return (
    <Layout>
      <div style={{ flex: 1, padding: 32, overflowY: 'auto', maxWidth: 720 }}>
        <h2 style={{ color: '#64ffda', marginBottom: 24 }}>Help</h2>

        <div style={sectionStyle}>
          <h3 style={h3Style}>Getting Started</h3>
          <p style={pStyle}>
            EdgeAI lets you chat with AI assistants powered by different providers.
            Select an integration from the sidebar, type your message, and press <span style={codeStyle}>Enter</span> or click <span style={codeStyle}>Send</span>.
          </p>
        </div>

        <div style={sectionStyle}>
          <h3 style={h3Style}>Chat Page Layout</h3>
          <ol style={olStyle}>
            <li><strong>Left sidebar (top)</strong> — Available integrations (AI assistants you have access to)</li>
            <li><strong>Left sidebar (bottom)</strong> — Recent session history for the selected integration</li>
            <li><strong>Main area</strong> — Chat window with message input</li>
          </ol>
          <p style={pStyle}>
            Each message creates a new session — EdgeAI is designed for single question-and-answer interactions.
            If an integration has an opening greeting, it will appear as a welcome message when you first select it.
          </p>
        </div>

        <div style={sectionStyle}>
          <h3 style={h3Style}>Viewing Past Sessions</h3>
          <p style={pStyle}>
            Click any session in the <strong>Recent Sessions</strong> sidebar to review both your question and the assistant's response.
          </p>
        </div>

        <div style={sectionStyle}>
          <h3 style={h3Style}>Pinning Responses</h3>
          <p style={pStyle}>
            Pinning saves useful responses so you can reuse them as context in future chats — even with different integrations.
          </p>
          <ol style={olStyle}>
            <li>After receiving a response, click the <strong>Pin</strong> button below the message</li>
            <li>Enter a descriptive label (e.g., "Marketing strategy summary")</li>
            <li>The message is saved to your pin collection</li>
          </ol>
        </div>

        <div style={sectionStyle}>
          <h3 style={h3Style}>Injecting Pins as Context</h3>
          <ol style={olStyle}>
            <li>Click the <strong>Pin</strong> button next to the input field to open the pin selector</li>
            <li>Check the pins you want to inject — a yellow banner shows selected pins</li>
            <li>Type your message and send</li>
          </ol>
          <p style={pStyle}>
            The pinned content is automatically prepended to your question as additional context.
            This is useful for carrying knowledge across different integrations — for example, pin a RAGFlow response and inject it into an OpenAI chat for further analysis.
          </p>
        </div>

        <div style={sectionStyle}>
          <h3 style={h3Style}>Message Actions</h3>
          <ol style={olStyle}>
            <li><strong>Pin</strong> — Save the response for future context injection</li>
            <li><strong>Copy</strong> — Copy the response text to your clipboard</li>
          </ol>
          <p style={pStyle}>
            RAGFlow responses may also show <strong>References</strong> at the bottom, listing the source documents used.
          </p>
        </div>

        <div style={sectionStyle}>
          <h3 style={h3Style}>Settings</h3>
          <p style={pStyle}>
            Click <strong>Settings</strong> in the top navigation bar to access your account settings.
          </p>
          <ol style={olStyle}>
            <li>Enter your current password</li>
            <li>Enter your new password and confirm it</li>
            <li>Click <strong>Update Password</strong></li>
          </ol>
        </div>

        <div style={sectionStyle}>
          <h3 style={h3Style}>Integration Access</h3>
          <p style={pStyle}>
            You can only see and chat with integrations that have been granted to you by a manager or admin.
            If you don't see any integrations, contact your manager to request access.
          </p>
        </div>
      </div>
    </Layout>
  )
}
