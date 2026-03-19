import { useAuthStore } from '../store/authStore'

export default function HelpPage() {
  const user = useAuthStore((s) => s.user)
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-lg font-semibold text-amcs-black mb-6">Help</h2>

      <div className="space-y-6 text-sm">
        <section>
          <h3 className="text-base font-semibold text-amcs-black mb-2">Getting Started</h3>
          <p className="text-amcs-grey-500 leading-relaxed">
            EdgeAI lets you chat with AI assistants powered by different providers.
            Select an integration from the sidebar, type your message, and press <code className="bg-amcs-grey-100 text-amcs-grey-600 rounded px-1.5 py-0.5 text-xs font-mono">Enter</code> or click <code className="bg-amcs-grey-100 text-amcs-grey-600 rounded px-1.5 py-0.5 text-xs font-mono">Send</code>.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-amcs-black mb-2">Chat Page Layout</h3>
          <ol className="list-decimal list-inside text-amcs-grey-500 leading-loose">
            <li><strong className="text-amcs-black">Left sidebar (top)</strong> — Available integrations (AI assistants you have access to)</li>
            <li><strong className="text-amcs-black">Left sidebar (bottom)</strong> — Recent session history for the selected integration</li>
            <li><strong className="text-amcs-black">Main area</strong> — Chat window with message input</li>
          </ol>
          <p className="text-amcs-grey-500 leading-relaxed mt-2">
            Each message creates a new session — EdgeAI is designed for single question-and-answer interactions.
            If an integration has an opening greeting, it will appear as a welcome message when you first select it.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-amcs-black mb-2">Viewing Past Sessions</h3>
          <p className="text-amcs-grey-500 leading-relaxed">
            Click any session in the <strong className="text-amcs-black">Recent Sessions</strong> sidebar to review both your question and the assistant's response.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-amcs-black mb-2">Pinning Responses</h3>
          <p className="text-amcs-grey-500 leading-relaxed">
            Pinning saves useful responses so you can reuse them as context in future chats — even with different integrations.
          </p>
          <ol className="list-decimal list-inside text-amcs-grey-500 leading-loose mt-1">
            <li>After receiving a response, click the <strong className="text-amcs-black">Pin</strong> button below the message</li>
            <li>Enter a descriptive label (e.g., "Marketing strategy summary")</li>
            <li>The message is saved to your pin collection</li>
          </ol>
        </section>

        <section>
          <h3 className="text-base font-semibold text-amcs-black mb-2">Injecting Pins as Context</h3>
          <ol className="list-decimal list-inside text-amcs-grey-500 leading-loose">
            <li>Click the <strong className="text-amcs-black">Pin</strong> button next to the input field to open the pin selector</li>
            <li>Check the pins you want to inject — a banner shows selected pins</li>
            <li>Type your message and send</li>
          </ol>
          <p className="text-amcs-grey-500 leading-relaxed mt-2">
            The pinned content is automatically prepended to your question as additional context.
            This is useful for carrying knowledge across different integrations — for example, pin a RAGFlow response and inject it into an OpenAI chat for further analysis.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-amcs-black mb-2">Message Actions</h3>
          <ol className="list-decimal list-inside text-amcs-grey-500 leading-loose">
            <li><strong className="text-amcs-black">Pin</strong> — Save the response for future context injection</li>
            <li><strong className="text-amcs-black">Copy</strong> — Copy the response text to your clipboard</li>
          </ol>
          <p className="text-amcs-grey-500 leading-relaxed mt-2">
            RAGFlow responses may also show <strong className="text-amcs-black">References</strong> at the bottom, listing the source documents used.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-amcs-black mb-2">Settings</h3>
          <p className="text-amcs-grey-500 leading-relaxed">
            Click <strong className="text-amcs-black">Settings</strong> in the sidebar to access your account settings.
          </p>
          <ol className="list-decimal list-inside text-amcs-grey-500 leading-loose mt-1">
            <li>Enter your current password</li>
            <li>Enter your new password and confirm it</li>
            <li>Click <strong className="text-amcs-black">Update Password</strong></li>
          </ol>
        </section>

        <section>
          <h3 className="text-base font-semibold text-amcs-black mb-2">Integration Access</h3>
          <p className="text-amcs-grey-500 leading-relaxed">
            You can only see and chat with integrations that have been granted to you by a manager or admin.
            If you don't see any integrations, contact your manager to request access.
          </p>
        </section>

        {isManagerOrAdmin && (
          <div className="border-t border-amcs-grey-100 pt-6 mt-8">
            <h2 className="text-lg font-semibold text-amcs-black mb-4">Manager Guide</h2>

            <section className="mb-6">
              <h3 className="text-base font-semibold text-amcs-black mb-2">Managing Users</h3>
              <ol className="list-decimal list-inside text-amcs-grey-500 leading-loose">
                <li>Go to <strong className="text-amcs-black">Manager</strong> in the sidebar</li>
                <li>Under <strong className="text-amcs-black">Users</strong>, enter a username, password, and select a role (User or Manager)</li>
                <li>Click <strong className="text-amcs-black">Add</strong> to create the account</li>
              </ol>
              <p className="text-amcs-grey-500 leading-relaxed mt-2">
                You can also <strong className="text-amcs-black">Toggle Role</strong> to switch a user between User and Manager, or <strong className="text-amcs-black">Delete</strong> to remove an account.
                Managers cannot create, edit, or delete admin accounts.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-amcs-black mb-2">Managing Integration Access</h3>
              <p className="text-amcs-grey-500 leading-relaxed">
                Users have <strong className="text-amcs-black">no access to any integration by default</strong>. You must explicitly grant access for each user.
              </p>
              <ol className="list-decimal list-inside text-amcs-grey-500 leading-loose mt-1">
                <li>Go to <strong className="text-amcs-black">Manager</strong> &gt; <strong className="text-amcs-black">Integration Access</strong></li>
                <li>Select a user from the dropdown</li>
                <li>Check the integrations the user should have access to</li>
                <li>Click <strong className="text-amcs-black">Save Access</strong></li>
              </ol>
              <p className="text-amcs-grey-500 leading-relaxed mt-2">
                Users will only see integrations they have been granted access to. Managers and admins always see all integrations.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
