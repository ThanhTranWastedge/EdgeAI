# EdgeAI UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the EdgeAI frontend from dark-theme inline styles to a modern light-theme Tailwind CSS design with sidebar navigation, preserving all existing functionality.

**Architecture:** Phased migration — install Tailwind and build the shared sidebar layout first, then convert each page individually. Each phase produces a buildable app. Pages render inside a shared `Layout` component via React Router's `<Outlet />`.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4, lucide-react, Zustand, react-router-dom v7

**Spec:** `docs/superpowers/specs/2026-03-19-ui-redesign-design.md`

---

### Task 1: Infrastructure + Sidebar Layout

**Files:**
- Modify: `frontend/package.json` (add dependencies)
- Modify: `frontend/vite.config.ts` (add Tailwind plugin)
- Modify: `frontend/src/index.css` (replace with Tailwind + light-theme markdown styles)
- Modify: `frontend/src/App.tsx` (nested route layout)
- Modify: `frontend/src/components/Layout.tsx` (full rewrite — sidebar + Outlet)
- Modify: `frontend/src/pages/AgentConfiguration.tsx` (stub placeholder if broken)

- [ ] **Step 1: Install dependencies**

```bash
cd frontend && npm install -D tailwindcss @tailwindcss/vite && npm install lucide-react
```

- [ ] **Step 2: Add Tailwind plugin to vite.config.ts**

Replace `frontend/vite.config.ts` with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Replace index.css**

Replace `frontend/src/index.css` with:

```css
@import "tailwindcss";

.markdown-body h1, .markdown-body h2, .markdown-body h3,
.markdown-body h4, .markdown-body h5, .markdown-body h6 {
  margin-top: 12px;
  margin-bottom: 6px;
  color: #0f172a;
}
.markdown-body h1 { font-size: 1.4em; }
.markdown-body h2 { font-size: 1.25em; }
.markdown-body h3 { font-size: 1.1em; }
.markdown-body p { margin: 6px 0; }
.markdown-body ul, .markdown-body ol {
  margin: 6px 0;
  padding-left: 20px;
}
.markdown-body li { margin: 3px 0; }
.markdown-body code {
  background: #f1f5f9;
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 0.9em;
}
.markdown-body pre {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px;
  margin: 8px 0;
  overflow-x: auto;
}
.markdown-body pre code {
  background: none;
  padding: 0;
}
.markdown-body strong { color: #0f172a; }
.markdown-body a { color: #0284c7; }
.markdown-body blockquote {
  border-left: 3px solid #e2e8f0;
  padding-left: 10px;
  margin: 6px 0;
  color: #64748b;
}
.markdown-body table {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
}
.markdown-body th, .markdown-body td {
  border: 1px solid #e2e8f0;
  padding: 6px 10px;
  text-align: left;
}
.markdown-body th {
  background: #f8fafc;
  color: #0f172a;
}
.markdown-body hr {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 10px 0;
}
```

- [ ] **Step 4: Rewrite Layout.tsx as sidebar + Outlet**

Replace `frontend/src/components/Layout.tsx` with:

```tsx
import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { MessageSquare, Bot, Users, Shield, HelpCircle, Settings, LogOut } from 'lucide-react'

interface NavItemProps {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
        ${active
          ? 'bg-sky-50 text-sky-600 font-semibold'
          : 'text-slate-600 hover:bg-slate-100'
        }`}
    >
      {icon}
      {label}
    </button>
  )
}

export default function Layout() {
  const { user, logout, checkAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    checkAuth()
  }, [])

  const isActive = (path: string) => location.pathname === path
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'
  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col bg-slate-50 border-r border-slate-200">
        {/* Logo */}
        <div className="h-16 px-6 flex items-center">
          <span
            className="text-xl font-bold text-sky-500 cursor-pointer"
            onClick={() => navigate('/chat')}
          >
            EdgeAI
          </span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 space-y-1">
          <NavItem
            icon={<MessageSquare className="w-5 h-5" />}
            label="Chat"
            active={isActive('/chat')}
            onClick={() => navigate('/chat')}
          />
          <NavItem
            icon={<Bot className="w-5 h-5" />}
            label="Agents"
            active={isActive('/agents')}
            onClick={() => navigate('/agents')}
          />

          {/* Role-gated items */}
          {isManagerOrAdmin && (
            <div className="border-t border-slate-200 my-2 pt-2">
              {isManagerOrAdmin && (
                <NavItem
                  icon={<Users className="w-5 h-5" />}
                  label="Manager"
                  path="/manager"
                  active={isActive('/manager')}
                  onClick={() => navigate('/manager')}
                />
              )}
              {isAdmin && (
                <NavItem
                  icon={<Shield className="w-5 h-5" />}
                  label="Admin"
                  path="/admin"
                  active={isActive('/admin')}
                  onClick={() => navigate('/admin')}
                />
              )}
            </div>
          )}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-4 space-y-1">
          <div className="border-t border-slate-200 pt-3 mb-1" />
          <NavItem
            icon={<HelpCircle className="w-5 h-5" />}
            label="Help"
            path="/help"
            active={isActive('/help')}
            onClick={() => navigate('/help')}
          />
          <NavItem
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            path="/settings"
            active={isActive('/settings')}
            onClick={() => navigate('/settings')}
          />

          {/* User info + logout */}
          <div className="border-t border-slate-200 mt-3 pt-3 px-4">
            <div className="text-sm font-medium text-slate-900">
              {user?.fullname || user?.username}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">
                {user?.role}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 h-screen overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Update App.tsx with nested route layout**

Replace `frontend/src/App.tsx` with:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import AdminPage from './pages/AdminPage'
import ManagerPage from './pages/ManagerPage'
import HelpPage from './pages/HelpPage'
import SettingsPage from './pages/SettingsPage'
import AgentConfiguration from './pages/AgentConfiguration'

function App() {
  const { accessToken } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={accessToken ? <Layout /> : <Navigate to="/login" />}>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/agents" element={<AgentConfiguration />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/manager" element={<ManagerPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/chat" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 6: Stub AgentConfiguration if it fails to compile**

Check if `frontend/src/pages/AgentConfiguration.tsx` exists and whether it compiles. If it fails (e.g., missing lucide-react import with wrong icons, broken Tailwind), replace its contents with a placeholder:

```tsx
export default function AgentConfiguration() {
  return (
    <div className="p-8">
      <h2 className="text-lg font-semibold text-slate-900">Agent Configuration</h2>
      <p className="text-sm text-slate-500 mt-2">Coming soon — this page will be built in a later phase.</p>
    </div>
  )
}
```

- [ ] **Step 7: Verify build passes**

```bash
cd frontend && npm run build
```

Expected: Build succeeds. The app now renders with a sidebar layout. Existing pages will have dark inline styles against the light sidebar — this is expected during migration.

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: install Tailwind CSS and build sidebar layout

- Install tailwindcss, @tailwindcss/vite, lucide-react
- Rewrite Layout.tsx as sidebar + Outlet
- Update App.tsx with nested route layout
- Replace index.css with Tailwind import + light-theme markdown styles
- Stub AgentConfiguration placeholder"
```

---

### Task 2: LoginPage

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`

- [ ] **Step 1: Rewrite LoginPage with Tailwind**

Replace `frontend/src/pages/LoginPage.tsx` with:

```tsx
import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
      navigate('/chat')
    } catch {
      setError('Invalid credentials')
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 w-[400px]">
        <h1 className="text-2xl font-bold text-sky-500 mb-6">EdgeAI</h1>
        {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx
git commit -m "feat: restyle LoginPage with Tailwind light theme"
```

---

### Task 3: ChatPage + Chat Components

This is the largest task — 7 files to restyle.

**Files:**
- Modify: `frontend/src/pages/ChatPage.tsx`
- Modify: `frontend/src/components/ChatWindow.tsx`
- Modify: `frontend/src/components/MessageBubble.tsx`
- Modify: `frontend/src/components/IntegrationList.tsx`
- Modify: `frontend/src/components/SessionHistory.tsx`
- Modify: `frontend/src/components/PinSelector.tsx`
- Modify: `frontend/src/components/PinnedBanner.tsx`

- [ ] **Step 1: Rewrite ChatPage.tsx**

Replace with (removes `<Layout>` wrapper, adds `flex h-full` root):

```tsx
import { useAuthStore } from '../store/authStore'
import IntegrationList from '../components/IntegrationList'
import SessionHistory from '../components/SessionHistory'
import ChatWindow from '../components/ChatWindow'

export default function ChatPage() {
  return (
    <div className="flex h-full">
      <div className="w-56 flex flex-col border-r border-slate-200 bg-white">
        <IntegrationList />
        <SessionHistory />
      </div>
      <ChatWindow />
    </div>
  )
}
```

Note: `checkAuth()` is now handled by Layout.tsx, so it's removed from ChatPage.

- [ ] **Step 2: Rewrite IntegrationList.tsx**

```tsx
import { useEffect, useState } from 'react'
import { listIntegrationsApi, Integration } from '../api/integrations'
import { useChatStore } from '../store/chatStore'

export default function IntegrationList() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const { activeIntegration, setActiveIntegration } = useChatStore()

  useEffect(() => {
    listIntegrationsApi().then(({ data }) => setIntegrations(data))
  }, [])

  return (
    <div className="p-3 overflow-y-auto">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 px-2">
        Integrations
      </div>
      {integrations.map((i) => {
        const isActive = activeIntegration?.id === i.id
        return (
          <div
            key={i.id}
            onClick={() => setActiveIntegration(i)}
            className={`px-3 py-2 rounded-lg mb-1 cursor-pointer text-sm transition-colors
              ${isActive
                ? 'bg-sky-50 text-sky-600 font-medium'
                : 'text-slate-700 hover:bg-slate-50'
              }`}
          >
            {i.icon || '\uD83D\uDCAC'} {i.name}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Rewrite SessionHistory.tsx**

```tsx
import { useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { getSessionsApi, getSessionApi } from '../api/chat'

export default function SessionHistory() {
  const { activeIntegration, sessions, setSessions, setCurrentMessages } = useChatStore()

  useEffect(() => {
    if (activeIntegration) {
      getSessionsApi(activeIntegration.id).then(({ data }) => setSessions(data))
    }
  }, [activeIntegration])

  const viewSession = async (sessionId: string) => {
    if (!activeIntegration) return
    const { data } = await getSessionApi(activeIntegration.id, sessionId)
    setCurrentMessages(data.messages)
  }

  if (!activeIntegration) return null

  return (
    <div className="p-3 border-t border-slate-200 overflow-y-auto flex-1">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 px-2">
        Recent Sessions
      </div>
      {sessions.length === 0 && (
        <div className="text-xs text-slate-400 px-2">No sessions yet</div>
      )}
      {sessions.map((s) => (
        <div
          key={s.id}
          onClick={() => viewSession(s.id)}
          className="px-2 py-1.5 rounded text-xs text-slate-500 cursor-pointer hover:bg-slate-50 mb-0.5 transition-colors"
        >
          <span className="text-slate-700">
            {s.title.slice(0, 40)}{s.title.length > 40 ? '...' : ''}
          </span>
          <span className="text-slate-400 text-[10px] ml-1">
            {new Date(s.created_at).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Rewrite MessageBubble.tsx**

```tsx
import Markdown from 'react-markdown'
import { MessageData } from '../api/chat'

interface Props {
  message: MessageData
  onPin?: (messageId: string) => void
}

export default function MessageBubble({ message, onPin }: Props) {
  const isUser = message.role === 'user'
  const refs = message.references ? JSON.parse(message.references) : null

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-xl px-4 py-3 max-w-[70%] text-sm leading-relaxed
          ${isUser
            ? 'bg-sky-50 text-slate-900 rounded-br-sm'
            : 'bg-white border border-slate-200 text-slate-900 rounded-bl-sm'
          }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="markdown-body">
            <Markdown>{message.content}</Markdown>
          </div>
        )}
        {!isUser && (
          <div className="mt-2 pt-2 border-t border-slate-100 flex gap-2">
            {onPin && !message.pinned && (
              <button
                onClick={() => onPin(message.id)}
                className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-600 border border-purple-100 hover:bg-purple-100 transition-colors cursor-pointer"
              >
                Pin
              </button>
            )}
            {message.pinned && (
              <span className="text-xs text-purple-500">Pinned</span>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(message.content)}
              className="text-xs px-2 py-1 rounded bg-sky-50 text-sky-600 border border-sky-100 hover:bg-sky-100 transition-colors cursor-pointer"
            >
              Copy
            </button>
          </div>
        )}
        {refs && refs.length > 0 && (
          <div className="mt-2 text-[10px] text-slate-400">
            References: {refs.map((r: { document_name: string }) => r.document_name).join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Rewrite ChatWindow.tsx**

```tsx
import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { usePinStore } from '../store/pinStore'
import { sendMessageStreamApi, getSessionsApi } from '../api/chat'
import MessageBubble from './MessageBubble'
import PinnedBanner from './PinnedBanner'
import PinSelector from './PinSelector'

export default function ChatWindow() {
  const { activeIntegration, currentMessages, addMessage, clearMessages, setSessions, isStreaming, setStreaming, updateLastMessage } = useChatStore()
  const { selectedPins, removeSelectedPin, clearSelectedPins } = usePinStore()
  const [input, setInput] = useState('')
  const [showPinSelector, setShowPinSelector] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages])

  if (!activeIntegration) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Select an integration to start chatting
      </div>
    )
  }

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return
    setError('')
    clearMessages()

    const userMsg = { id: 'temp-user', role: 'user', content: input, references: null, pinned: false, sequence: 1 }
    addMessage(userMsg)

    const assistantMsg = { id: 'temp-assistant', role: 'assistant', content: '', references: null, pinned: false, sequence: 2 }
    addMessage(assistantMsg)

    const pinnedIds = selectedPins.map((p) => p.id)
    const message = input
    setInput('')
    setStreaming(true)

    try {
      await sendMessageStreamApi(
        activeIntegration.id,
        message,
        pinnedIds.length > 0 ? pinnedIds : undefined,
        (chunk) => {
          updateLastMessage((prev) => prev + chunk)
        },
        async (_refs) => {
          clearSelectedPins()
          const sessionsRes = await getSessionsApi(activeIntegration.id)
          setSessions(sessionsRes.data)
        },
        (errorMsg) => {
          setError(errorMsg)
        },
      )
    } catch {
      setError('Failed to get response. Please try again.')
    } finally {
      setStreaming(false)
    }
  }

  const handlePin = async (messageId: string) => {
    const label = prompt('Enter a label for this pin:')
    if (!label) return
    const { createPinApi } = await import('../api/pins')
    try {
      await createPinApi(messageId, label)
      useChatStore.setState((state) => ({
        currentMessages: state.currentMessages.map((m) =>
          m.id === messageId ? { ...m, pinned: true } : m
        ),
      }))
    } catch {
      alert('Failed to pin message')
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="h-14 px-6 flex items-center justify-between border-b border-slate-200 bg-white">
        <span className="text-sm font-medium text-slate-900">
          {activeIntegration.icon || '\uD83D\uDCAC'} {activeIntegration.name}
        </span>
        <span className="text-xs text-slate-400">New session each message</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <PinnedBanner pins={selectedPins} onRemove={removeSelectedPin} />
        {currentMessages.length === 0 && activeIntegration.opening_greeting && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border border-slate-200 rounded-xl rounded-bl-sm px-4 py-3 max-w-[70%] text-sm leading-relaxed text-slate-900 whitespace-pre-wrap">
              {activeIntegration.opening_greeting}
            </div>
          </div>
        )}
        {currentMessages.map((m, i) => (
          <MessageBubble key={i} message={m} onPin={m.role === 'assistant' ? handlePin : undefined} />
        ))}
        {isStreaming && <div className="text-slate-400 text-sm animate-pulse">Thinking...</div>}
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-3 border-t border-slate-200 bg-white">
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowPinSelector(!showPinSelector)}
            title="Attach pinned responses"
            className="text-slate-400 hover:text-sky-500 text-sm cursor-pointer transition-colors"
          >
            Pin
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={`Ask ${activeIntegration.name} something...`}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming}
            className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Send
          </button>
        </div>
        {showPinSelector && <PinSelector onClose={() => setShowPinSelector(false)} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Rewrite PinSelector.tsx**

```tsx
import { useEffect } from 'react'
import { usePinStore } from '../store/pinStore'
import { listPinsApi } from '../api/pins'

interface Props {
  onClose: () => void
}

export default function PinSelector({ onClose }: Props) {
  const { allPins, setAllPins, selectedPins, toggleSelectedPin } = usePinStore()

  useEffect(() => {
    if (allPins.length === 0) {
      listPinsApi().then(({ data }) => setAllPins(data))
    }
  }, [])

  return (
    <div className="mt-2 bg-white border border-slate-200 rounded-lg p-3 max-h-[200px] overflow-y-auto shadow-sm">
      <div className="flex justify-between mb-2">
        <span className="text-xs text-slate-500">Select pinned responses to inject:</span>
        <span onClick={onClose} className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 transition-colors">
          Close
        </span>
      </div>
      {allPins.length === 0 && <div className="text-xs text-slate-400">No pinned responses yet</div>}
      {allPins.map((pin) => {
        const isSelected = selectedPins.some((p) => p.id === pin.id)
        return (
          <div
            key={pin.id}
            onClick={() => toggleSelectedPin(pin)}
            className={`p-2 rounded cursor-pointer mb-1 transition-colors
              ${isSelected
                ? 'bg-amber-50 border border-amber-200'
                : 'hover:bg-slate-50 border border-transparent'
              }`}
          >
            <div className="text-xs text-slate-700">{pin.label}</div>
            <div className="text-[10px] text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
              {pin.integration_name && <span className="text-slate-500">[{pin.integration_name}] </span>}
              {pin.content.slice(0, 80)}...
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 7: Rewrite PinnedBanner.tsx**

```tsx
interface PinItem {
  id: string
  label: string
  content: string
}

interface Props {
  pins: PinItem[]
  onRemove: (id: string) => void
}

export default function PinnedBanner({ pins, onRemove }: Props) {
  if (pins.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs">
      <span className="text-amber-600 font-medium">Injected context:</span>
      {pins.map((p) => (
        <span key={p.id} className="ml-2 text-slate-700">
          "{p.label}"
          <span
            onClick={() => onRemove(p.id)}
            className="text-slate-400 cursor-pointer ml-1 hover:text-red-500 transition-colors"
          >
            [remove]
          </span>
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/ChatPage.tsx frontend/src/components/
git commit -m "feat: restyle ChatPage and all chat components with Tailwind

Restyle ChatWindow, MessageBubble, IntegrationList, SessionHistory,
PinSelector, PinnedBanner with light theme Tailwind classes.
Remove Layout wrapper from ChatPage (now handled by App.tsx Outlet)."
```

---

### Task 4: AgentConfiguration

**Files:**
- Modify: `frontend/src/pages/AgentConfiguration.tsx` (full rewrite)

- [ ] **Step 1: Rewrite AgentConfiguration.tsx**

Replace the entire file with:

```tsx
import { useState } from 'react'
import { X, ChevronDown } from 'lucide-react'

export default function AgentConfiguration() {
  const [activeTab, setActiveTab] = useState('Configuration')

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Agent Configuration</h1>
          <span className="bg-green-100 text-green-700 text-xs font-medium rounded-full px-2.5 py-1">
            Active
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-lg bg-white text-slate-600 text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
            Discard Changes
          </button>
          <button className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors cursor-pointer">
            Save Configuration
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex gap-1 p-1 bg-slate-100 rounded-xl mb-8">
        {['Configuration', 'Prompt', 'Advanced'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer
              ${activeTab === tab
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Configuration Tab */}
      {activeTab === 'Configuration' && (
        <div className="space-y-6">
          {/* General Settings Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-semibold text-slate-900">General Settings</h2>
              <p className="text-xs text-slate-400 mt-1">Basic identification and fallback behavior for this agent.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="agent-name" className="block text-sm font-medium text-slate-700 mb-1">Agent Name</label>
                <input
                  id="agent-name"
                  type="text"
                  defaultValue="Marketing Agent"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="empty-response" className="block text-sm font-medium text-slate-700 mb-1">Empty Response Message</label>
                <input
                  id="empty-response"
                  type="text"
                  defaultValue="I don't know"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1">This message will be sent when the agent cannot find a relevant answer.</p>
              </div>
            </div>
          </div>

          {/* Retrieval & Model Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-semibold text-slate-900">Retrieval & Model</h2>
              <p className="text-xs text-slate-400 mt-1">Configure which data this agent can access and its reasoning engine.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Connected Datasets</label>
                <div className="min-h-[46px] p-2 rounded-lg border border-slate-200 bg-slate-50 flex flex-wrap gap-2 items-center focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 transition-all">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-slate-700 text-sm border border-slate-200">
                    Marketing Playbooks
                    <button className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-slate-700 text-sm border border-slate-200">
                    Q3 Campaign Results
                    <button className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  </span>
                  <input
                    type="text"
                    placeholder="Add dataset..."
                    className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">The agent will only use information found within these datasets.</p>
              </div>
              <div>
                <label htmlFor="llm-select" className="block text-sm font-medium text-slate-700 mb-1">Language Model (LLM)</label>
                <div className="relative">
                  <select
                    id="llm-select"
                    defaultValue="gpt-4o"
                    className="w-full appearance-none px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors cursor-pointer"
                  >
                    <option value="gpt-4o">GPT-4o (OpenAI)</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo (OpenAI)</option>
                    <option value="claude-3-opus">Claude 3 Opus (Anthropic)</option>
                    <option value="claude-3-sonnet">Claude 3.5 Sonnet (Anthropic)</option>
                    <option value="mistral-large">Mistral Large (Mistral)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder for other tabs */}
      {activeTab !== 'Configuration' && (
        <div className="h-64 flex bg-white border border-dashed border-slate-300 rounded-xl items-center justify-center">
          <p className="text-slate-400 text-sm">Content for {activeTab} panel</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AgentConfiguration.tsx
git commit -m "feat: build AgentConfiguration page with card-based Tailwind layout"
```

---

### Task 5: AdminPage + Components

**Files:**
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/src/components/AdminPanel.tsx`
- Modify: `frontend/src/components/UserManagement.tsx`

- [ ] **Step 1: Rewrite AdminPage.tsx**

```tsx
import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import AdminPanel from '../components/AdminPanel'
import UserManagement from '../components/UserManagement'

export default function AdminPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/chat')
  }, [user])

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Admin Panel</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-semibold text-slate-900">Integrations</h3>
        </div>
        <div className="p-6">
          <AdminPanel />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-semibold text-slate-900">Users</h3>
        </div>
        <div className="p-6">
          <UserManagement />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite AdminPanel.tsx**

```tsx
import { useEffect, useState } from 'react'
import { Integration, listIntegrationsApi, createIntegrationApi, deleteIntegrationApi } from '../api/integrations'

export default function AdminPanel() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState('ragflow')
  const [configJson, setConfigJson] = useState('{}')
  const [greeting, setGreeting] = useState('')

  const load = () => listIntegrationsApi().then(({ data }) => setIntegrations(data))
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    let config: Record<string, unknown>
    try {
      config = JSON.parse(configJson)
    } catch {
      alert('Invalid JSON config')
      return
    }
    try {
      await createIntegrationApi({ name, provider_type: providerType, provider_config: config, opening_greeting: greeting || undefined })
      setName('')
      setConfigJson('{}')
      setGreeting('')
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create integration'
      alert(msg)
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
        <select value={providerType} onChange={(e) => setProviderType(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer">
          <option value="ragflow">RAGFlow</option>
          <option value="openai_compatible">OpenAI Compatible</option>
        </select>
        <textarea placeholder='{"base_url":"...","api_key":"..."}' value={configJson} onChange={(e) => setConfigJson(e.target.value)} rows={2} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-mono flex-1 min-w-[300px] transition-colors" />
        <input placeholder="Opening Greeting (optional)" value={greeting} onChange={(e) => setGreeting(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 flex-1 min-w-[200px] transition-colors" />
        <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors cursor-pointer">Add</button>
      </div>
      <div className="space-y-2">
        {integrations.map((i) => (
          <div key={i.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <span className="text-sm text-slate-900">{i.name}</span>
              <span className="text-xs text-slate-400 ml-2">{i.provider_type}</span>
            </div>
            <button onClick={async () => { if (confirm('Delete integration?')) { await deleteIntegrationApi(i.id); load() } }} className="px-3 py-1 rounded-lg text-xs text-red-500 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite UserManagement.tsx**

```tsx
import { useEffect, useState } from 'react'
import { User } from '../api/auth'
import { listUsersApi, createUserApi, updateUserApi, deleteUserApi } from '../api/admin'

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [newUsername, setNewUsername] = useState('')
  const [newFullname, setNewFullname] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('user')

  const loadUsers = () => listUsersApi().then(({ data }) => setUsers(data))
  useEffect(() => { loadUsers() }, [])

  const handleCreate = async () => {
    if (!newUsername || !newPassword) return
    await createUserApi({ username: newUsername, password: newPassword, role: newRole, fullname: newFullname || undefined })
    setNewUsername('')
    setNewFullname('')
    setNewPassword('')
    loadUsers()
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
        <input placeholder="Full Name" value={newFullname} onChange={(e) => setNewFullname(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
        <input placeholder="Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
        <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer">
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors cursor-pointer">Add</button>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Username</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Full Name</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Role</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3 text-sm text-slate-900">{u.username}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{u.fullname || '—'}</td>
              <td className="px-4 py-3 text-sm text-slate-900">{u.role}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={async () => {
                  const cycle: Record<string, string> = { user: 'manager', manager: 'admin', admin: 'user' }
                  await updateUserApi(u.id, { role: cycle[u.role] || 'user' }); loadUsers()
                }} className="mr-2 px-2 py-1 rounded text-xs text-sky-600 border border-sky-200 hover:bg-sky-50 transition-colors cursor-pointer">
                  Toggle Role
                </button>
                <button onClick={async () => { if (confirm('Delete user?')) { await deleteUserApi(u.id); loadUsers() } }} className="px-2 py-1 rounded text-xs text-red-500 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AdminPage.tsx frontend/src/components/AdminPanel.tsx frontend/src/components/UserManagement.tsx
git commit -m "feat: restyle AdminPage, AdminPanel, UserManagement with Tailwind"
```

---

### Task 6: ManagerPage + Components

**Files:**
- Modify: `frontend/src/pages/ManagerPage.tsx`
- Modify: `frontend/src/components/ManagerPanel.tsx`
- Modify: `frontend/src/components/UserAccessEditor.tsx`

- [ ] **Step 1: Rewrite ManagerPage.tsx**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { User } from '../api/auth'
import { listManagerUsersApi } from '../api/manager'
import ManagerPanel from '../components/ManagerPanel'
import UserAccessEditor from '../components/UserAccessEditor'

export default function ManagerPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])

  const loadUsers = useCallback(() => {
    listManagerUsersApi().then(({ data }) => setUsers(data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (user && user.role === 'user') navigate('/chat')
  }, [user])

  useEffect(() => { loadUsers() }, [loadUsers])

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Manager Panel</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-semibold text-slate-900">Users</h3>
        </div>
        <div className="p-6">
          <ManagerPanel users={users} onUsersChange={loadUsers} />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-semibold text-slate-900">Integration Access</h3>
        </div>
        <div className="p-6">
          <UserAccessEditor users={users} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite ManagerPanel.tsx**

```tsx
import { useState } from 'react'
import { User } from '../api/auth'
import { createManagerUserApi, updateManagerUserApi, deleteManagerUserApi } from '../api/manager'

interface Props {
  users: User[]
  onUsersChange: () => void
}

export default function ManagerPanel({ users, onUsersChange }: Props) {
  const [newUsername, setNewUsername] = useState('')
  const [newFullname, setNewFullname] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('user')

  const handleCreate = async () => {
    if (!newUsername || !newPassword) return
    await createManagerUserApi({ username: newUsername, password: newPassword, role: newRole, fullname: newFullname || undefined })
    setNewUsername('')
    setNewFullname('')
    setNewPassword('')
    onUsersChange()
  }

  const nextRole = (role: string) => role === 'user' ? 'manager' : 'user'

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
        <input placeholder="Full Name" value={newFullname} onChange={(e) => setNewFullname(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
        <input placeholder="Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
        <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer">
          <option value="user">User</option>
          <option value="manager">Manager</option>
        </select>
        <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors cursor-pointer">Add</button>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Username</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Full Name</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Role</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3 text-sm text-slate-900">{u.username}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{u.fullname || '—'}</td>
              <td className="px-4 py-3 text-sm text-slate-900">{u.role}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={async () => { await updateManagerUserApi(u.id, { role: nextRole(u.role) }); onUsersChange() }} className="mr-2 px-2 py-1 rounded text-xs text-sky-600 border border-sky-200 hover:bg-sky-50 transition-colors cursor-pointer">
                  Toggle Role
                </button>
                <button onClick={async () => { if (confirm('Delete user?')) { await deleteManagerUserApi(u.id); onUsersChange() } }} className="px-2 py-1 rounded text-xs text-red-500 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite UserAccessEditor.tsx**

```tsx
import { useEffect, useState } from 'react'
import { User } from '../api/auth'
import { Integration, listIntegrationsApi } from '../api/integrations'
import { getUserAccessApi, setUserAccessApi } from '../api/manager'

interface Props {
  users: User[]
}

export default function UserAccessEditor({ users }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [grantedIds, setGrantedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listIntegrationsApi().then(({ data }) => setIntegrations(data))
  }, [])

  useEffect(() => {
    if (!selectedUserId) {
      setGrantedIds(new Set())
      return
    }
    getUserAccessApi(selectedUserId).then(({ data }) => {
      setGrantedIds(new Set(data.map((a) => a.integration_id)))
    })
  }, [selectedUserId])

  const toggleIntegration = (id: string) => {
    setGrantedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    if (!selectedUserId) return
    setSaving(true)
    await setUserAccessApi(selectedUserId, Array.from(grantedIds))
    setSaving(false)
  }

  return (
    <div>
      <select
        value={selectedUserId}
        onChange={(e) => setSelectedUserId(e.target.value)}
        className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 mb-4 min-w-[200px] cursor-pointer"
      >
        <option value="">Select a user...</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
        ))}
      </select>

      {selectedUserId && (
        <>
          <div className="mb-3 space-y-1">
            {integrations.length === 0 && <div className="text-sm text-slate-400">No integrations available</div>}
            {integrations.map((i) => (
              <label key={i.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={grantedIds.has(i.id)}
                  onChange={() => toggleIntegration(i.id)}
                  className="rounded border-slate-300 text-sky-500 focus:ring-sky-500/20"
                />
                <span className="text-slate-900">{i.name}</span>
                <span className="text-xs text-slate-400">({i.provider_type})</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Access'}
          </button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ManagerPage.tsx frontend/src/components/ManagerPanel.tsx frontend/src/components/UserAccessEditor.tsx
git commit -m "feat: restyle ManagerPage, ManagerPanel, UserAccessEditor with Tailwind"
```

---

### Task 7: SettingsPage + HelpPage

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/pages/HelpPage.tsx`

- [ ] **Step 1: Rewrite SettingsPage.tsx**

```tsx
import { useState } from 'react'
import { AxiosError } from 'axios'
import { changePasswordApi } from '../api/auth'

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setMessage('')
    setError('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    try {
      await changePasswordApi({ current_password: currentPassword, new_password: newPassword })
      setMessage('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const detail = err instanceof AxiosError ? err.response?.data?.detail : undefined
      setError(detail || 'Failed to change password')
    }
  }

  return (
    <div className="p-8 max-w-lg">
      <h2 className="text-lg font-semibold text-slate-900 mb-6">Settings</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-semibold text-slate-900">Change Password</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="current-pw" className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
            <input id="current-pw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
          </div>
          <div>
            <label htmlFor="new-pw" className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
          </div>
          <div>
            <label htmlFor="confirm-pw" className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
            <input id="confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
          </div>
          <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors cursor-pointer">
            Update Password
          </button>
          {message && <div className="text-green-500 text-sm">{message}</div>}
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite HelpPage.tsx**

```tsx
import { useAuthStore } from '../store/authStore'

export default function HelpPage() {
  const user = useAuthStore((s) => s.user)
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-lg font-semibold text-slate-900 mb-6">Help</h2>

      <div className="space-y-6 text-sm">
        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Getting Started</h3>
          <p className="text-slate-600 leading-relaxed">
            EdgeAI lets you chat with AI assistants powered by different providers.
            Select an integration from the sidebar, type your message, and press <code className="bg-slate-100 text-slate-800 rounded px-1.5 py-0.5 text-xs font-mono">Enter</code> or click <code className="bg-slate-100 text-slate-800 rounded px-1.5 py-0.5 text-xs font-mono">Send</code>.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Chat Page Layout</h3>
          <ol className="list-decimal list-inside text-slate-600 leading-loose">
            <li><strong className="text-slate-900">Left sidebar (top)</strong> — Available integrations (AI assistants you have access to)</li>
            <li><strong className="text-slate-900">Left sidebar (bottom)</strong> — Recent session history for the selected integration</li>
            <li><strong className="text-slate-900">Main area</strong> — Chat window with message input</li>
          </ol>
          <p className="text-slate-600 leading-relaxed mt-2">
            Each message creates a new session — EdgeAI is designed for single question-and-answer interactions.
            If an integration has an opening greeting, it will appear as a welcome message when you first select it.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Viewing Past Sessions</h3>
          <p className="text-slate-600 leading-relaxed">
            Click any session in the <strong className="text-slate-900">Recent Sessions</strong> sidebar to review both your question and the assistant's response.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Pinning Responses</h3>
          <p className="text-slate-600 leading-relaxed">
            Pinning saves useful responses so you can reuse them as context in future chats — even with different integrations.
          </p>
          <ol className="list-decimal list-inside text-slate-600 leading-loose mt-1">
            <li>After receiving a response, click the <strong className="text-slate-900">Pin</strong> button below the message</li>
            <li>Enter a descriptive label (e.g., "Marketing strategy summary")</li>
            <li>The message is saved to your pin collection</li>
          </ol>
        </section>

        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Injecting Pins as Context</h3>
          <ol className="list-decimal list-inside text-slate-600 leading-loose">
            <li>Click the <strong className="text-slate-900">Pin</strong> button next to the input field to open the pin selector</li>
            <li>Check the pins you want to inject — a banner shows selected pins</li>
            <li>Type your message and send</li>
          </ol>
          <p className="text-slate-600 leading-relaxed mt-2">
            The pinned content is automatically prepended to your question as additional context.
            This is useful for carrying knowledge across different integrations — for example, pin a RAGFlow response and inject it into an OpenAI chat for further analysis.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Message Actions</h3>
          <ol className="list-decimal list-inside text-slate-600 leading-loose">
            <li><strong className="text-slate-900">Pin</strong> — Save the response for future context injection</li>
            <li><strong className="text-slate-900">Copy</strong> — Copy the response text to your clipboard</li>
          </ol>
          <p className="text-slate-600 leading-relaxed mt-2">
            RAGFlow responses may also show <strong className="text-slate-900">References</strong> at the bottom, listing the source documents used.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Settings</h3>
          <p className="text-slate-600 leading-relaxed">
            Click <strong className="text-slate-900">Settings</strong> in the sidebar to access your account settings.
          </p>
          <ol className="list-decimal list-inside text-slate-600 leading-loose mt-1">
            <li>Enter your current password</li>
            <li>Enter your new password and confirm it</li>
            <li>Click <strong className="text-slate-900">Update Password</strong></li>
          </ol>
        </section>

        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Integration Access</h3>
          <p className="text-slate-600 leading-relaxed">
            You can only see and chat with integrations that have been granted to you by a manager or admin.
            If you don't see any integrations, contact your manager to request access.
          </p>
        </section>

        {isManagerOrAdmin && (
          <div className="border-t border-slate-200 pt-6 mt-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Manager Guide</h2>

            <section className="mb-6">
              <h3 className="text-base font-semibold text-slate-900 mb-2">Managing Users</h3>
              <ol className="list-decimal list-inside text-slate-600 leading-loose">
                <li>Go to <strong className="text-slate-900">Manager</strong> in the sidebar</li>
                <li>Under <strong className="text-slate-900">Users</strong>, enter a username, password, and select a role (User or Manager)</li>
                <li>Click <strong className="text-slate-900">Add</strong> to create the account</li>
              </ol>
              <p className="text-slate-600 leading-relaxed mt-2">
                You can also <strong className="text-slate-900">Toggle Role</strong> to switch a user between User and Manager, or <strong className="text-slate-900">Delete</strong> to remove an account.
                Managers cannot create, edit, or delete admin accounts.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-slate-900 mb-2">Managing Integration Access</h3>
              <p className="text-slate-600 leading-relaxed">
                Users have <strong className="text-slate-900">no access to any integration by default</strong>. You must explicitly grant access for each user.
              </p>
              <ol className="list-decimal list-inside text-slate-600 leading-loose mt-1">
                <li>Go to <strong className="text-slate-900">Manager</strong> &gt; <strong className="text-slate-900">Integration Access</strong></li>
                <li>Select a user from the dropdown</li>
                <li>Check the integrations the user should have access to</li>
                <li>Click <strong className="text-slate-900">Save Access</strong></li>
              </ol>
              <p className="text-slate-600 leading-relaxed mt-2">
                Users will only see integrations they have been granted access to. Managers and admins always see all integrations.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify full build**

```bash
cd frontend && npm run build
```

Expected: Build passes with zero errors. All pages are now using Tailwind CSS with the light theme.

- [ ] **Step 4: Verify no remaining inline styles**

Search for any remaining `style={{` or `style={` in the source files:

```bash
grep -r "style={{" frontend/src/ --include="*.tsx" || echo "No remaining inline styles"
grep -r "style={" frontend/src/ --include="*.tsx" || echo "No remaining inline styles"
```

Expected: No results (all inline styles have been replaced).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx frontend/src/pages/HelpPage.tsx
git commit -m "feat: restyle SettingsPage and HelpPage with Tailwind

Complete UI redesign migration — all pages now use Tailwind CSS
with light theme. No inline styles remain."
```
