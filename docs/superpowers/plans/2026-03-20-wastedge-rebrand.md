# WasteEdge Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the EdgeAI frontend from AMCS magenta/pink to WasteEdge teal/green/blue corporate identity, restructure the sidebar to include integrations and sessions, convert chat input to floating bar, and restyle all pages.

**Architecture:** Token swap in Tailwind v4 `@theme` block propagates color changes globally. Then incremental component restyling — sidebar goes dark, chat input floats, IntegrationList/SessionHistory move from ChatPage into Layout sidebar.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (Vite plugin), Zustand, Lucide React icons

**Spec:** `docs/superpowers/specs/2026-03-20-wastedge-rebrand-design.md`

**Verification:** `npm run build` (TypeScript + Vite production build) after each task. No frontend unit tests exist — visual verification via dev server.

---

### Task 1: Replace Brand Tokens

**Files:**
- Modify: `frontend/src/index.css:25-49` (token values in `@theme` block)
- Modify: `frontend/src/index.css:98` (markdown link color note)

- [ ] **Step 1: Update `@theme` token values**

In `frontend/src/index.css`, replace the `@theme` block (lines 25-49) with:

```css
@theme {
  /* ─ Colors ─ */
  --color-amcs-primary: #004457;
  --color-amcs-primary-hover: #005a73;
  --color-amcs-primary-light: #1488CA;
  --color-amcs-black: #131619;
  --color-amcs-white: #ffffff;

  --color-amcs-grey-50: #f5f5f5;
  --color-amcs-grey-100: #ededed;
  --color-amcs-grey-200: #e6e7e7;
  --color-amcs-grey-300: #acacac;
  --color-amcs-grey-400: #848484;
  --color-amcs-grey-500: #484b4c;
  --color-amcs-grey-600: #2c2c2c;

  --color-amcs-positive: #4faf30;
  --color-amcs-positive-light: #f0fdf4;
  --color-amcs-negative: #f97315;
  --color-amcs-negative-light: #fff7ed;

  /* ─ WasteEdge-specific tokens ─ */
  --color-we-sidebar: #004457;
  --color-we-accent: #4faf30;
  --color-we-blue: #1488CA;
  --color-we-sidebar-hover: #005a73;

  /* ─ Font families (Tailwind v4 uses --font-* namespace) ─ */
  --font-heading: "Inter", "Helvetica Neue", Arial, sans-serif;
  --font-body: "Inter", "Helvetica Neue", Arial, sans-serif;
}
```

- [ ] **Step 2: Verify markdown link color is readable**

Check line 98: `.markdown-body a { color: var(--color-amcs-primary); }` — this now resolves to `#004457` (teal). Teal on white is readable (contrast ratio ~9:1). No change needed.

- [ ] **Step 3: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds. All existing `bg-amcs-primary`, `text-amcs-primary`, etc. classes now resolve to new WasteEdge values.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(brand): replace AMCS tokens with WasteEdge colors"
```

---

### Task 2: Update Shared Style Constants

**Files:**
- Modify: `frontend/src/styles.ts:1-21`

- [ ] **Step 1: Replace entire `styles.ts` content**

```typescript
export const inputCls =
  'px-3 py-2 rounded-md border border-amcs-grey-200 bg-amcs-grey-50 text-sm text-amcs-black placeholder:text-amcs-grey-300 focus:outline-none focus:ring-2 focus:ring-we-blue/30 focus:border-amcs-primary transition-colors'

export const selectCls =
  'px-3 py-2 rounded-md border border-amcs-grey-200 bg-amcs-grey-50 text-sm text-amcs-black focus:outline-none focus:ring-2 focus:ring-we-blue/30 focus:border-amcs-primary cursor-pointer'

export const btnPrimaryCls =
  'px-6 py-2 rounded-full bg-amcs-primary text-white text-sm font-medium hover:bg-amcs-primary-hover focus:outline-none focus:ring-2 focus:ring-we-blue/30 transition-colors cursor-pointer'

export const btnDangerCls =
  'px-2 py-1 rounded text-xs text-amcs-negative border border-amcs-negative/30 hover:bg-amcs-negative-light transition-colors cursor-pointer'

export const btnSecondaryCls =
  'mr-2 px-4 py-2 rounded-full text-xs text-amcs-primary border border-amcs-primary hover:bg-amcs-primary hover:text-white transition-colors cursor-pointer'

export const thCls =
  'text-left px-4 py-3 text-xs font-medium text-amcs-grey-400 uppercase tracking-wider bg-amcs-grey-50'

export const labelCls =
  'block text-sm font-medium text-amcs-grey-600 mb-1'
```

Changes from current:
- `inputCls`: `focus:ring-amcs-primary-light/30` → `focus:ring-we-blue/30`
- `selectCls`: `focus:ring-amcs-primary-light/30` → `focus:ring-we-blue/30`
- `btnPrimaryCls`: `focus:ring-amcs-primary-light/30` → `focus:ring-we-blue/30`
- `btnSecondaryCls`: `text-amcs-black border border-amcs-black hover:bg-amcs-black` → `text-amcs-primary border border-amcs-primary hover:bg-amcs-primary`

- [ ] **Step 2: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles.ts
git commit -m "feat(brand): update shared style constants for WasteEdge palette"
```

---

### Task 3: Restyle Sidebar (Layout.tsx)

**Files:**
- Modify: `frontend/src/components/Layout.tsx:1-199`

This is the largest change. The sidebar goes from white to dark teal, NavItem colors invert, and the middle section will later host IntegrationList/SessionHistory (Task 6).

- [ ] **Step 1: Update NavItem colors for dark background**

Replace the NavItem component (lines 17-31) with:

```tsx
function NavItem({ icon, label, active, collapsed, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
        ${active
          ? 'bg-[rgba(79,175,48,0.15)] text-we-accent font-semibold'
          : 'text-white/60 hover:bg-we-sidebar-hover hover:text-white/80'
        }`}
    >
      {icon}
      {!collapsed && label}
    </button>
  )
}
```

- [ ] **Step 2: Update sidebar container and logo section**

Replace the sidebar `<aside>` opening and logo section (lines 83-101) with:

```tsx
      <aside className={`${isCollapsed ? 'w-16' : 'w-60'} flex flex-col bg-we-sidebar transition-all duration-300 overflow-hidden`}>
        {/* Logo + toggle */}
        <div className={`h-16 flex items-center shrink-0 ${isCollapsed ? 'justify-center' : 'px-5 justify-between'} border-b border-white/[0.08]`}>
          {!isCollapsed && (
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate('/chat')}
            >
              <div className="w-7 h-7 bg-we-accent rounded-md flex items-center justify-center text-xs font-extrabold text-white">E</div>
              <span className="text-base font-bold text-white">EdgeAI</span>
            </div>
          )}
          {isCollapsed && (
            <div
              className="w-7 h-7 bg-we-accent rounded-md flex items-center justify-center text-xs font-extrabold text-white cursor-pointer"
              onClick={() => navigate('/chat')}
            >
              E
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="text-white/30 hover:text-white/60 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
```

- [ ] **Step 3: Update nav section**

Replace the nav section (lines 103-134) with:

```tsx
        {/* Main nav */}
        <nav className={`${isCollapsed ? 'px-1' : 'px-3'} py-2 space-y-1 shrink-0 border-b border-white/[0.06]`}>
          <NavItem
            icon={<MessageSquare className="w-5 h-5" />}
            label="Chat"
            active={isActive('/chat')}
            collapsed={isCollapsed}
            onClick={() => navigate('/chat')}
          />

          {/* Role-gated items */}
          {isManagerOrAdmin && (
            <>
              <NavItem
                icon={<Users className="w-5 h-5" />}
                label="Manager"
                active={isActive('/manager')}
                collapsed={isCollapsed}
                onClick={() => navigate('/manager')}
              />
              {isAdmin && (
                <NavItem
                  icon={<Shield className="w-5 h-5" />}
                  label="Admin"
                  active={isActive('/admin')}
                  collapsed={isCollapsed}
                  onClick={() => navigate('/admin')}
                />
              )}
            </>
          )}
        </nav>

        {/* Scrollable middle — will host IntegrationList + SessionHistory in Task 6 */}
        <div className="flex-1 overflow-y-auto" />
```

- [ ] **Step 4: Update bottom section for dark background**

Replace the bottom section (lines 136-190) with:

```tsx
        {/* Bottom section */}
        <div className={`${isCollapsed ? 'px-1' : 'px-3'} pb-4 space-y-1 shrink-0`}>
          <div className="border-t border-white/[0.08] pt-3 mb-1" />
          <NavItem
            icon={<HelpCircle className="w-5 h-5" />}
            label="Help"
            active={isActive('/help')}
            collapsed={isCollapsed}
            onClick={() => navigate('/help')}
          />
          <NavItem
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            active={isActive('/settings')}
            collapsed={isCollapsed}
            onClick={() => navigate('/settings')}
          />

          {/* User info + logout */}
          {isCollapsed ? (
            <div className="border-t border-white/[0.08] mt-3 pt-3 flex flex-col items-center gap-2">
              <div
                className="w-8 h-8 rounded-full bg-we-blue flex items-center justify-center text-xs font-semibold text-white"
                title={user?.fullname || user?.username}
              >
                {getInitials(user?.fullname ?? undefined, user?.username ?? undefined)}
              </div>
              <button
                onClick={logout}
                className="text-white/30 hover:text-amcs-negative transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="border-t border-white/[0.08] mt-3 pt-3 px-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-we-blue flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {getInitials(user?.fullname ?? undefined, user?.username ?? undefined)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90 truncate">
                    {user?.fullname || user?.username}
                  </div>
                  <div className="text-xs text-white/40">{user?.role}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-1 text-xs text-white/30 hover:text-amcs-negative mt-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          )}
        </div>
```

- [ ] **Step 5: Update main content background**

On line 194, change:
```tsx
// From:
<main className="flex-1 min-w-0 h-screen overflow-y-auto bg-amcs-grey-50">
// To:
<main className="flex-1 min-w-0 h-screen overflow-y-auto bg-[#f8fafc]">
```

Also update the outer div on line 81:
```tsx
// From:
<div className="flex h-screen bg-amcs-grey-50">
// To:
<div className="flex h-screen bg-[#f8fafc]">
```

- [ ] **Step 6: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds. Sidebar now renders dark teal with light text.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat(brand): restyle sidebar with WasteEdge dark teal theme"
```

---

### Task 4: Restyle IntegrationList for Dark Sidebar

**Files:**
- Modify: `frontend/src/components/IntegrationList.tsx:1-37`

- [ ] **Step 1: Update IntegrationList styling**

Replace the entire component with:

```tsx
import { useEffect, useState } from 'react'
import { listIntegrationsApi, Integration } from '../api/integrations'
import { useChatStore } from '../store/chatStore'

interface Props {
  collapsed: boolean
}

export default function IntegrationList({ collapsed }: Props) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const { activeIntegration, setActiveIntegration } = useChatStore()

  useEffect(() => {
    listIntegrationsApi().then(({ data }) => setIntegrations(data))
  }, [])

  return (
    <div>
      {!collapsed && (
        <div className="text-[10px] uppercase tracking-[1.2px] text-white/[0.35] px-3 pt-3 pb-1">
          Integrations
        </div>
      )}
      {integrations.map((i) => {
        const isActive = activeIntegration?.id === i.id
        if (collapsed) {
          return (
            <div
              key={i.id}
              onClick={() => setActiveIntegration(i)}
              className="flex justify-center py-1.5 cursor-pointer"
              title={i.name}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-we-accent' : 'bg-white/25'}`} />
            </div>
          )
        }
        return (
          <div
            key={i.id}
            onClick={() => setActiveIntegration(i)}
            className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded-lg cursor-pointer text-xs transition-colors
              ${isActive
                ? 'bg-[rgba(79,175,48,0.12)] text-we-accent'
                : 'text-white/55 hover:text-white/75'
              }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-we-accent' : 'bg-white/25'}`} />
            {i.name}
          </div>
        )
      })}
    </div>
  )
}
```

Key changes: accepts `collapsed` prop, dark-on-light colors, green dot indicators, no padding/border (parent provides), section label in sidebar style.

- [ ] **Step 2: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds. (Component is temporarily disconnected — will be wired into Layout in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/IntegrationList.tsx
git commit -m "feat(brand): restyle IntegrationList for dark sidebar"
```

---

### Task 5: Restyle SessionHistory for Dark Sidebar

**Files:**
- Modify: `frontend/src/components/SessionHistory.tsx:1-47`

- [ ] **Step 1: Update SessionHistory styling**

Replace the entire component with:

```tsx
import { useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { getSessionsApi, getSessionApi } from '../api/chat'

interface Props {
  collapsed: boolean
}

export default function SessionHistory({ collapsed }: Props) {
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

  if (collapsed) {
    return null // No room to show session titles in collapsed sidebar
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[1.2px] text-white/[0.35] px-3 pt-3 pb-1">
        Recent Sessions
      </div>
      {sessions.map((s) => (
        <div
          key={s.id}
          onClick={() => viewSession(s.id)}
          className="px-3 py-1 mx-1 rounded text-[11px] text-white/45 cursor-pointer hover:text-white/65 transition-colors truncate"
        >
          {s.title.slice(0, 40)}{s.title.length > 40 ? '...' : ''}
        </div>
      ))}
    </div>
  )
}
```

Key changes: accepts `collapsed` prop (returns null when collapsed), dark text colors, no border/padding wrapper, truncated text.

- [ ] **Step 2: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SessionHistory.tsx
git commit -m "feat(brand): restyle SessionHistory for dark sidebar"
```

---

### Task 6: Move Integrations + Sessions into Layout Sidebar & Simplify ChatPage

**Files:**
- Modify: `frontend/src/components/Layout.tsx` (import + render IntegrationList/SessionHistory in scrollable middle)
- Modify: `frontend/src/pages/ChatPage.tsx:1-16` (remove left panel)

- [ ] **Step 1: Add IntegrationList and SessionHistory imports to Layout.tsx**

Add imports after the existing imports (line 4):

```tsx
import IntegrationList from './IntegrationList'
import SessionHistory from './SessionHistory'
```

- [ ] **Step 2: Replace the scrollable middle placeholder with actual components**

Find the placeholder div from Task 3:
```tsx
        {/* Scrollable middle — will host IntegrationList + SessionHistory in Task 6 */}
        <div className="flex-1 overflow-y-auto" />
```

Replace with:
```tsx
        {/* Scrollable middle — integrations + recent sessions */}
        <div className="flex-1 overflow-y-auto">
          <IntegrationList collapsed={isCollapsed} />
          <SessionHistory collapsed={isCollapsed} />
        </div>
```

- [ ] **Step 3: Simplify ChatPage to just ChatWindow**

Replace all of `frontend/src/pages/ChatPage.tsx` with:

```tsx
import ChatWindow from '../components/ChatWindow'

export default function ChatPage() {
  return <ChatWindow />
}
```

- [ ] **Step 4: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds. IntegrationList and SessionHistory now render in the sidebar on all pages. ChatPage no longer has the w-56 left panel.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Layout.tsx frontend/src/pages/ChatPage.tsx
git commit -m "feat(layout): move integrations and sessions into sidebar, simplify ChatPage"
```

---

### Task 7: Restyle ChatWindow — Floating Input + Greeting Card

**Files:**
- Modify: `frontend/src/components/ChatWindow.tsx:1-165`

This is the second-largest change. The greeting renders as a single elevated card, the input becomes a floating bar, and the "no integration" state updates.

- [ ] **Step 1: Replace ChatWindow with restyled version**

Replace the entire file with:

```tsx
import { useState, useRef, useEffect, useMemo } from 'react'
import Markdown from 'react-markdown'
import { useChatStore } from '../store/chatStore'
import { usePinStore } from '../store/pinStore'
import { sendMessageStreamApi, getSessionsApi } from '../api/chat'
import MessageBubble from './MessageBubble'
import PinnedBanner from './PinnedBanner'
import PinSelector from './PinSelector'
import { Send } from 'lucide-react'

export default function ChatWindow() {
  const { activeIntegration, currentMessages, addMessage, clearMessages, setSessions, isStreaming, setStreaming, updateLastMessage } = useChatStore()
  const { selectedPins, removeSelectedPin, clearSelectedPins } = usePinStore()
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showPinSelector, setShowPinSelector] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const greetingNode = useMemo(
    () => activeIntegration?.opening_greeting
      ? <Markdown>{activeIntegration.opening_greeting}</Markdown>
      : null,
    [activeIntegration?.opening_greeting]
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages])

  if (!activeIntegration) {
    return (
      <div className="flex-1 flex items-center justify-center text-amcs-grey-300 text-sm bg-[#f8fafc]">
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
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
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
    <div className="flex-1 min-w-0 flex flex-col bg-[#f8fafc] relative">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        <PinnedBanner pins={selectedPins} onRemove={removeSelectedPin} />

        {/* Agent header card */}
        {currentMessages.length === 0 && (
          <div className="flex items-center gap-3 mb-5 p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="w-10 h-10 bg-amcs-primary rounded-[10px] flex items-center justify-center text-lg">
              {activeIntegration.icon || '\uD83D\uDCAC'}
            </div>
            <div>
              <div className="font-bold text-[15px] text-[#1e293b]">{activeIntegration.name}</div>
              <div className="text-xs text-[#94a3b8]">Online</div>
            </div>
          </div>
        )}

        {/* Greeting card */}
        {currentMessages.length === 0 && activeIntegration.opening_greeting && (
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 markdown-body text-sm leading-relaxed text-amcs-black">
            {greetingNode}
          </div>
        )}

        {currentMessages.map((m) => (
          <MessageBubble key={m.id} message={m} onPin={m.role === 'assistant' ? handlePin : undefined} />
        ))}
        {isStreaming && <div className="text-amcs-grey-300 text-sm animate-pulse">Thinking...</div>}
        {error && <div className="text-amcs-negative text-sm">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Pin selector — opens above floating input */}
      {showPinSelector && (
        <div className="absolute bottom-20 left-6 right-6 z-20">
          <PinSelector onClose={() => setShowPinSelector(false)} />
        </div>
      )}

      {/* Floating input bar */}
      <div className="absolute bottom-4 left-6 right-6 z-10 max-md:left-3 max-md:right-3">
        <div className="bg-white rounded-[14px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#e2e8f0] flex items-end gap-3 pl-5 pr-2 py-2">
          <button
            onClick={() => setShowPinSelector(!showPinSelector)}
            title="Attach pinned responses"
            className="text-amcs-grey-300 hover:text-amcs-primary text-sm cursor-pointer transition-colors shrink-0 pb-1.5"
          >
            Pin
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Ask ${activeIntegration.name} something...`}
            className="flex-1 text-sm text-[#1e293b] placeholder:text-[#94a3b8] bg-transparent border-none outline-none resize-none py-1.5"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming}
            className="w-10 h-10 bg-we-accent rounded-[10px] flex items-center justify-center text-white shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:brightness-110"
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

Key changes:
- Removed `inputCls`/`btnPrimaryCls` imports (input is now unstyled, send is a custom green button)
- Added `Send` icon import from lucide-react
- Greeting renders as single elevated white card with `markdown-body` class
- Agent header card with teal icon, name, "Online" label
- Floating input bar with `position: absolute; bottom: 4`, shadow, green send button
- Pin selector opens above the floating input via absolute positioning
- Content area has `pb-24` to avoid content behind floating input
- Background set to `#f8fafc`

- [ ] **Step 2: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatWindow.tsx
git commit -m "feat(chat): floating input bar, greeting card, agent header"
```

---

### Task 8: Restyle MessageBubble

**Files:**
- Modify: `frontend/src/components/MessageBubble.tsx:1-59`

- [ ] **Step 1: Update MessageBubble styling**

Replace the entire file with:

```tsx
import { useMemo } from 'react'
import Markdown from 'react-markdown'
import { MessageData } from '../api/chat'

interface Props {
  message: MessageData
  onPin?: (messageId: string) => void
}

export default function MessageBubble({ message, onPin }: Props) {
  const isUser = message.role === 'user'
  const refs = useMemo(() => message.references ? JSON.parse(message.references) : null, [message.references])

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`px-4 py-3 max-w-[70%] text-sm leading-relaxed
          ${isUser
            ? 'bg-[#004457] text-white rounded-[14px_14px_4px_14px]'
            : 'bg-white border border-[#e2e8f0] text-[#1e293b] rounded-[14px_14px_14px_4px] shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
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
          <div className="mt-2 pt-2 border-t border-[#e2e8f0] flex gap-2">
            {onPin && !message.pinned && (
              <button
                onClick={() => onPin(message.id)}
                className="text-xs px-2 py-1 rounded bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] hover:bg-[#dcfce7] transition-colors cursor-pointer"
              >
                Pin
              </button>
            )}
            {message.pinned && (
              <span className="text-xs text-we-accent">Pinned</span>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(message.content)}
              className="text-xs px-2 py-1 rounded bg-[#f0f9ff] text-[#0c4a6e] border border-[#bae6fd] hover:bg-[#e0f2fe] transition-colors cursor-pointer"
            >
              Copy
            </button>
          </div>
        )}
        {refs && refs.length > 0 && (
          <div className="mt-2 text-[10px] text-amcs-grey-300">
            References: {refs.map((r: { document_name: string }) => r.document_name).join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
```

Key changes:
- User bubble: teal `#004457` background, white text, flat bottom-right
- Assistant bubble: white with subtle border/shadow, flat bottom-left
- Pin button: green tint instead of pink
- Copy button: blue tint instead of pink
- "Pinned" text uses `text-we-accent` (green)

- [ ] **Step 2: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MessageBubble.tsx
git commit -m "feat(chat): restyle message bubbles with WasteEdge colors"
```

---

### Task 9: Update PinSelector to Open Upward

**Files:**
- Modify: `frontend/src/components/PinSelector.tsx:1-49`

- [ ] **Step 1: Update PinSelector styling**

Replace the container div (line 19) styling. The positioning is now handled by the parent (ChatWindow) using absolute positioning, so PinSelector just needs to remove `mt-2` and update colors:

```tsx
    <div className="bg-white border border-[#e2e8f0] rounded-lg p-3 max-h-[200px] overflow-y-auto shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
```

Replace line 19: `<div className="mt-2 bg-amcs-white border border-amcs-grey-100 rounded-lg p-3 max-h-[200px] overflow-y-auto shadow-sm">` with the above.

No other changes needed — the amber selection colors and text colors use AMCS tokens that have already been updated.

- [ ] **Step 2: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PinSelector.tsx
git commit -m "feat(chat): update PinSelector for floating input positioning"
```

---

### Task 10: Restyle LoginPage

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx:1-87`

- [ ] **Step 1: Update LoginPage**

Replace lines 6 (glassInputCls) and 50-83 (form section):

Change line 6:
```tsx
const glassInputCls = 'w-full px-3 py-2.5 rounded-[10px] text-sm bg-white/10 border border-white/20 text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-we-accent/40'
```

Replace the form (lines 50-83) with:
```tsx
      <form onSubmit={handleSubmit} className="relative bg-white/12 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-8 w-[400px] border border-white/20">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-we-accent rounded-lg flex items-center justify-center font-extrabold text-sm text-white">E</div>
            <span className="text-[22px] font-bold text-white">EdgeAI</span>
          </div>
          <div className="text-[11px] text-white/50 mt-1 tracking-[0.5px]">Enterprise</div>
        </div>
        {error && <div className="text-amcs-negative/70 text-sm mb-4">{error}</div>}
        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-white/70 mb-1">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className={glassInputCls}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-1">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={glassInputCls}
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-we-accent text-white font-bold text-sm shadow-[0_4px_12px_rgba(79,175,48,0.3)] hover:brightness-110 transition cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </form>
```

Also remove the unused `btnPrimaryCls` import on line 4.

- [ ] **Step 2: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx
git commit -m "feat(brand): restyle login page with WasteEdge green button and E badge"
```

---

### Task 11: Update Admin, Manager, Settings, Help Pages

**Files:**
- Modify: `frontend/src/pages/AdminPage.tsx` — no changes needed (uses SectionCard + token classes that auto-update)
- Modify: `frontend/src/pages/ManagerPage.tsx` — no changes needed (same reason)
- Modify: `frontend/src/pages/SettingsPage.tsx` — no changes needed (uses `inputCls`, `btnPrimaryCls`, `labelCls` from styles.ts)
- Modify: `frontend/src/pages/HelpPage.tsx` — no changes needed (uses `text-amcs-black`, `text-amcs-grey-*` which are unchanged)
- Modify: `frontend/src/components/AdminPanel.tsx` — no changes needed (uses shared style constants)
- Modify: `frontend/src/components/ManagerPanel.tsx` — no changes needed (delegates to UserTable)
- Modify: `frontend/src/components/UserTable.tsx` — no changes needed (uses shared style constants)
- Modify: `frontend/src/components/UserAccessEditor.tsx:70` — update checkbox accent color
- Modify: `frontend/src/components/SectionCard.tsx` — no changes needed (uses amcs-grey tokens which are unchanged)

- [ ] **Step 1: Update checkbox accent in UserAccessEditor**

In `frontend/src/components/UserAccessEditor.tsx`, line 70, change:
```tsx
// From:
className="rounded border-amcs-grey-200 text-amcs-primary focus:ring-amcs-primary/20"
// To:
className="rounded border-amcs-grey-200 text-amcs-primary focus:ring-we-blue/20"
```

- [ ] **Step 2: Build and verify full application**

Run: `cd frontend && npm run build`
Expected: Build succeeds with zero errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/UserAccessEditor.tsx
git commit -m "feat(brand): update checkbox accent color in UserAccessEditor"
```

---

### Task 12: Final Visual Verification

- [ ] **Step 1: Start dev server and verify all pages**

Run: `cd frontend && npm run dev`

Verify in browser:
1. **Login page** — green "E" badge, "Enterprise" subtitle, green Sign In button, video background
2. **Sidebar** — dark teal, green active state, integrations list, recent sessions (when integration selected)
3. **Chat page** — agent header card, greeting card, floating input with green send button
4. **Message bubbles** — teal user messages, white assistant messages, green pin button, blue copy button
5. **Pin selector** — opens above floating input
6. **Admin page** — teal/green buttons, updated table styles
7. **Manager page** — same as admin
8. **Settings page** — teal "Update Password" button
9. **Help page** — content renders with updated token colors
10. **Collapsed sidebar** — "E" badge, dot indicators, avatar circle

- [ ] **Step 2: Verify responsive behavior**

Resize browser below 768px:
- Sidebar auto-collapses
- Floating input has tighter margins (`max-md:left-3 max-md:right-3`)

- [ ] **Step 3: Run lint**

Run: `cd frontend && npm run lint`
Expected: No new lint errors.

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
# Only if there were fixups during verification
git add -A && git commit -m "fix(brand): visual polish from manual verification"
```
