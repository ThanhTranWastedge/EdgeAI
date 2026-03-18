# EdgeAI UI Redesign — Design Spec

## Overview

Full visual redesign of the EdgeAI frontend from a dark-theme inline-styles codebase to a modern, light-theme enterprise SaaS application using Tailwind CSS. All 7 pages are restyled while preserving existing functionality. The global navigation moves from a top header bar to a full-height left sidebar.

## Goals

- Modern, premium enterprise SaaS look (light theme, white cards, subtle shadows)
- Tailwind CSS migration (replace all inline `style={{...}}` with utility classes)
- Sidebar-based navigation that accommodates future sections (file upload, etc.)
- Consistent design language across all pages
- No functional changes — same API calls, same state management, same routing logic

## Non-Goals

- No new features or backend changes
- No component library (shadcn/ui, Radix, etc.) — just Tailwind utilities
- No dark mode toggle (light theme only)
- No responsive/mobile breakpoints in first pass (desktop-first, can add later)

---

## Design System

### Color Palette

| Token | Tailwind Class | Hex | Usage |
|-------|---------------|-----|-------|
| Background | `bg-slate-50` | `#f8fafc` | Page canvas behind cards |
| Surface | `bg-white` | `#ffffff` | Cards, panels, inputs |
| Sidebar bg | `bg-slate-50` | `#f8fafc` | Sidebar background |
| Border | `border-slate-200` | `#e2e8f0` | Card borders, dividers |
| Border strong | `border-slate-300` | `#cbd5e1` | Focused input borders |
| Text primary | `text-slate-900` | `#0f172a` | Headings, body text |
| Text secondary | `text-slate-600` | `#475569` | Labels, descriptions |
| Text muted | `text-slate-400` | `#94a3b8` | Placeholders, hints |
| Primary | `bg-sky-500` | `#0ea5e9` | Buttons, active nav, links |
| Primary hover | `bg-sky-600` | `#0284c7` | Button hover states |
| Primary subtle | `bg-sky-50` | `#f0f9ff` | Active nav background, user message bubbles |
| Primary text | `text-sky-600` | `#0284c7` | Active nav text, links |
| Error | `text-red-500` | `#ef4444` | Error messages, destructive buttons |
| Error bg | `bg-red-50` | `#fef2f2` | Error message backgrounds |
| Success | `text-green-500` | `#22c55e` | Success messages |

### Typography

- Font: System stack via Tailwind defaults (`font-sans`)
- Body: `text-sm` (14px) — matches current app density
- Headings: `text-lg font-semibold` for page titles, `text-base font-semibold` for card section headings
- Labels: `text-sm font-medium text-slate-700`
- Helper text: `text-xs text-slate-400`

### Spacing & Layout

- Sidebar width: `w-60` (240px)
- Content padding: `p-8` (32px)
- Card padding: `p-6` (24px)
- Card style: `bg-white rounded-xl border border-slate-200 shadow-sm`
- Section gaps: `space-y-6` between cards
- Form field gaps: `space-y-4` between fields within cards

### Common Patterns

**Input fields:**
```
className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50
           text-sm text-slate-900 placeholder:text-slate-400
           focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500
           transition-colors"
```

**Primary button:**
```
className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium
           hover:bg-sky-600 transition-colors focus:outline-none focus:ring-2
           focus:ring-sky-500/20"
```

**Destructive button:**
```
className="px-4 py-2 rounded-lg bg-white text-red-500 text-sm font-medium
           border border-slate-200 hover:bg-red-50 transition-colors"
```

**Card section:**
```
className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
```
With header: `className="px-6 py-4 border-b border-slate-100 bg-slate-50/50"`
With body: `className="p-6 space-y-4"`

---

## Infrastructure Changes

### Tailwind Installation

Tailwind CSS v4 is used. There is no `tailwind.config.js` in v4 — configuration is CSS-first via `@theme` directives. Since we only use standard Tailwind classes (no custom tokens), no `@theme` config is needed.

1. Install dependencies: `npm install -D tailwindcss @tailwindcss/vite`
2. Add Tailwind plugin to `vite.config.ts`:
```ts
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```
3. Replace `index.css` contents with `@import "tailwindcss";` plus the `.markdown-body` styles (used by react-markdown, preserved but updated for light theme). Custom scrollbar styles and `::selection` from the old CSS are intentionally dropped — the browser default scrollbar is fine for a light theme.

### Icon Library

Install `lucide-react` for sidebar and page icons: `npm install lucide-react`

This provides tree-shakeable SVG icons. Using a library is cleaner than hand-writing inline SVGs for 7+ icons. Icons used: `MessageSquare`, `Bot`, `Users`, `Shield`, `HelpCircle`, `Settings`, `LogOut`.

### Routing Change

Currently each page imports and renders `<Layout>` individually. The new design wraps protected routes in Layout at the App.tsx level:

```tsx
// App.tsx — new structure
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
```

Layout.tsx uses `<Outlet />` to render child routes. This ensures the sidebar is rendered once and pages don't each import Layout.

---

## Sidebar Layout (Layout.tsx)

### Structure

```
┌──────────────┬─────────────────────────────────────┐
│  EdgeAI      │                                     │
│──────────────│                                     │
│  Chat        │                                     │
│  Agents      │         <Outlet />                  │
│              │         (page content)              │
│  Manager *   │                                     │
│  Admin *     │                                     │
│──────────────│                                     │
│  Help        │                                     │
│  Settings    │                                     │
│──────────────│                                     │
│  User info   │                                     │
│  Logout      │                                     │
└──────────────┴─────────────────────────────────────┘
```

*Manager/Admin items are role-gated (same logic as current header buttons).

### Sidebar Specs

- Container: `w-60 h-screen flex flex-col bg-slate-50 border-r border-slate-200`
- Logo area: `h-16 px-6 flex items-center` — "EdgeAI" in `text-xl font-bold text-sky-500`
- Nav items: `flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors`
- Active item: `bg-sky-50 text-sky-600 font-semibold` with a `border-l-2 border-sky-500` indicator (or the rounded-lg background is sufficient)
- Nav groups: Top group (Chat, Agents) separated from role-gated items (Manager, Admin) by a subtle `border-t border-slate-200 my-2` divider when role items are present
- Bottom section: `mt-auto` pushes Help, Settings, user info, and Logout to the bottom
- User info: Display `user.fullname || user.username` and role as a small badge (`text-xs bg-slate-200 rounded-full px-2 py-0.5`)
- Logout: Small text button `text-slate-400 hover:text-red-500`
- Icons: `lucide-react` icons — `MessageSquare` (Chat), `Bot` (Agents), `Users` (Manager), `Shield` (Admin), `HelpCircle` (Help), `Settings` (Settings), `LogOut` (Logout). Size `w-5 h-5`.

### Content Area

- `flex-1 h-screen overflow-y-auto bg-slate-50`
- Renders `<Outlet />` — each page fills this space

### Auth & Role Guards

Layout.tsx calls `checkAuth()` once on mount (replaces the duplicate `useEffect(() => { checkAuth() }, [])` calls in ChatPage, AdminPage, and ManagerPage). Per-page role guards remain in each page — e.g., AdminPage still redirects non-admins to `/chat`, ManagerPage still redirects plain users.

---

## Page Designs

### LoginPage

Standalone page (no sidebar). Full-viewport centered form.

- Background: `min-h-screen bg-slate-100 flex items-center justify-center`
- Card: `bg-white rounded-xl shadow-lg p-8 w-[400px]`
- "EdgeAI" heading: `text-2xl font-bold text-sky-500 mb-6`
- Form fields: Each has a `<label>` above (not placeholder-only). Uses the standard input pattern from Design System.
- Submit button: Full-width primary button, `w-full`
- Error: `text-red-500 text-sm` shown between heading and fields

No changes to state management or `handleSubmit` logic.

### ChatPage

Three-column layout: sidebar (handled by Layout) + integration/session panel + chat window.

**Integration/Session Panel (left, within content area):**
- Width: `w-56` (224px), `border-r border-slate-200 bg-white flex flex-col`
- IntegrationList at top: Each integration as a row with name. Active gets `bg-sky-50 text-sky-600`. Hover gets `bg-slate-50`.
- SessionHistory below: Separated by `border-t`. Each session row shows a truncated preview. Click loads the session in chat window.
- Same components (IntegrationList, SessionHistory), just restyled with Tailwind classes

**Chat Window (right, fills remaining space):**
- Header strip: `h-14 px-6 flex items-center justify-between border-b border-slate-200 bg-white` — shows integration name + "New session each message" hint
- Messages area: `flex-1 overflow-y-auto p-6 bg-slate-50` — messages display as bubbles
  - User messages: `bg-sky-50 rounded-xl p-4 max-w-[70%] ml-auto` (right-aligned)
  - Assistant messages: `bg-white border border-slate-200 rounded-xl p-4 max-w-[70%]` (left-aligned)
  - Markdown rendering: `.markdown-body` styles preserved but adapted for light theme
- Input bar: `px-6 py-3 border-t border-slate-200 bg-white flex gap-2 items-center`
  - Pin button: subtle icon button
  - Text input: standard input, `flex-1`
  - Send button: `bg-sky-500 text-white rounded-lg px-4 py-2`
- Opening greeting: When no messages exist and the integration has an `opening_greeting`, display it as an assistant-style bubble. Uses the same `bg-white border` styling as assistant messages.
- Integration icon: Preserve the existing `integration.icon` display (with `💬` fallback). Shown in the header strip next to the integration name.
- Streaming indicator: "Thinking..." in `text-slate-400 text-sm` with a subtle pulse animation
- Error: `text-red-500 text-sm`
- PinSelector and PinnedBanner: Restyled to match light theme but same functionality

**ChatPage root element** must be `className="flex h-full"` to fill the Layout content area, since it is no longer a direct child of the Layout flex container (it renders via `<Outlet />`).

### AgentConfiguration

**Note:** An earlier version of this file exists in the codebase using Tailwind + lucide-react + an embedded dark sidebar with emerald accent colors. If it still exists at implementation time, it should be fully rewritten — remove the embedded sidebar (Layout handles that now), replace the emerald palette with sky, and align with the design system below. If it was deleted, build from scratch.

Card-based form layout.

**Header:** `flex items-center justify-between mb-8`
- Title: "Agent Configuration" in `text-lg font-semibold text-slate-900`
- Status badge: `bg-green-100 text-green-700 text-xs font-medium rounded-full px-2.5 py-1`
- Action buttons: "Discard" (secondary/outline) + "Save Configuration" (primary)

**Tabs:** Pill-style segmented control
- Container: `inline-flex gap-1 p-1 bg-slate-100 rounded-xl`
- Tab button: `px-6 py-2 rounded-lg text-sm font-medium transition-all`
- Active: `bg-white text-slate-900 shadow-sm`
- Inactive: `text-slate-500 hover:text-slate-700`

**Configuration tab content:**

Card 1 — General Settings:
- Standard card with header ("General Settings" + description) and body
- Fields: Agent Name (text input), Empty Response Message (text input with helper text)

Card 2 — Retrieval & Model:
- Connected Datasets: Multi-select with pill tags. Each pill: `inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm border border-slate-200`. X button to remove. Text input within the container for adding.
- Language Model: Select dropdown with chevron icon

Prompt/Advanced tabs: Placeholder with `border-dashed` empty state message.

### AdminPage

Content renders directly in the sidebar layout's `<Outlet />`.

- Heading: "Admin Panel" in `text-lg font-semibold text-slate-900 mb-6`
- **Integration Management card:** Card with header "Integrations". Contains the AdminPanel component — form row for creating integrations + list of existing ones.
  - AdminPanel currently uses div-based rows (not `<table>`). Keep the div layout — restyle each integration row as: `flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 mb-2`
  - Create form: horizontal flex layout with inputs + Add button, matching the standard input/button patterns
  - Delete button: small destructive style (`text-red-500 border-red-200 hover:bg-red-50`)
- **User Management card:** Card with header "Users". Contains UserManagement component. This one uses actual `<table>` elements — restyle with:
  - Table: `w-full divide-y divide-slate-200`
  - Table header: `bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider`
  - Table cells: `px-4 py-3 text-sm`
  - Action buttons: Small, inline — Toggle Role (sky), Delete (red)

All existing AdminPanel and UserManagement logic stays the same. Only the inline styles are replaced with Tailwind classes.

### ManagerPage

Same pattern as AdminPage.

- Heading: "Manager Panel"
- **User Management card:** ManagerPanel component restyled
- **Integration Access card:** UserAccessEditor component restyled — user dropdown + checkbox grid

### SettingsPage

Simple centered form.

- Content: `max-w-lg` container within the content area
- Heading: "Settings" in `text-lg font-semibold text-slate-900 mb-6`
- Card: "Change Password" section heading in card header
- Three password fields with proper `<label>` elements: "Current Password", "New Password", "Confirm New Password"
- Update button: Primary style
- Success/error messages below the form, `text-sm`

### HelpPage

Prose content page.

- Content: `max-w-2xl` container
- Heading: "Help" in `text-lg font-semibold text-slate-900 mb-6`
- Section headings: `text-base font-semibold text-slate-900`
- Body text: `text-slate-600 leading-relaxed text-sm`
- Ordered lists: `list-decimal list-inside text-slate-600 text-sm leading-loose`
- Inline code: `bg-slate-100 text-slate-800 rounded px-1.5 py-0.5 text-xs font-mono`
- Manager Guide section: Conditional render (same logic), separated by `border-t border-slate-200 pt-6 mt-8`

---

## Markdown Styles (index.css)

The `.markdown-body` class styles used by react-markdown in ChatWindow need to be updated for the light theme. These remain in `index.css` since react-markdown applies className, not inline styles:

- Headings: `color: #0f172a` (slate-900)
- Body text: inherited from parent
- Code blocks: `background: #f1f5f9; border: 1px solid #e2e8f0`
- Inline code: `background: #f1f5f9`
- Links: `color: #0284c7` (sky-600)
- Blockquotes: `border-left-color: #e2e8f0; color: #64748b`
- Tables: `border-color: #e2e8f0`, header bg `#f8fafc`

---

## Migration Strategy

### Phase Order

Each phase is a self-contained, buildable unit.

**Phase 1: Infrastructure + Sidebar Layout**
- Install `tailwindcss`, `@tailwindcss/vite`, and `lucide-react`
- Add Tailwind plugin to `vite.config.ts`
- Replace `index.css` (Tailwind import + light-theme markdown styles)
- Rewrite `Layout.tsx` as sidebar + Outlet (with `checkAuth()` on mount)
- Update `App.tsx` to nest protected routes inside Layout using `<Outlet />`
- If `AgentConfiguration.tsx` exists and fails to compile (missing lucide-react or broken Tailwind), stub it temporarily as a placeholder page so the build passes. It gets properly built in Phase 4.
- All existing pages will render inside the new sidebar layout. They'll still have inline styles (dark colors) which will look wrong against the light sidebar — this is expected and temporary.

**Phase 2: LoginPage**
- Restyle LoginPage with Tailwind (standalone, no sidebar)
- Add proper `<label>` elements
- Remove all inline `style` props

**Phase 3: ChatPage + Chat Components**
- Restyle ChatPage, ChatWindow, MessageBubble, IntegrationList, SessionHistory, PinSelector, PinnedBanner
- Update markdown-body styles in index.css
- This is the largest phase — most components to touch

**Phase 4: AgentConfiguration**
- Rewrite AgentConfiguration page with Tailwind — remove any embedded sidebar, align to sky palette
- Tab system, card layout, form fields
- If the old file exists, refactor it; if not, build from scratch

**Phase 5: AdminPage + Components**
- Restyle AdminPage, AdminPanel, UserManagement
- Table styling

**Phase 6: ManagerPage + Components**
- Restyle ManagerPage, ManagerPanel, UserAccessEditor

**Phase 7: SettingsPage + HelpPage**
- Restyle both (simplest pages, batch together)
- Final cleanup: remove any remaining inline styles, verify consistency

### What Changes Per File

| File | Change |
|------|--------|
| `package.json` | Add tailwindcss, @tailwindcss/vite, lucide-react |
| `vite.config.ts` | Add tailwindcss plugin |
| `index.css` | Replace with Tailwind import + markdown styles |
| `App.tsx` | Nested route layout with `<Layout>` wrapper |
| `Layout.tsx` | Full rewrite — sidebar + Outlet |
| `LoginPage.tsx` | Restyle with Tailwind |
| `ChatPage.tsx` | Restyle, remove Layout import |
| `ChatWindow.tsx` | Restyle with Tailwind |
| `MessageBubble.tsx` | Restyle with Tailwind |
| `IntegrationList.tsx` | Restyle with Tailwind |
| `SessionHistory.tsx` | Restyle with Tailwind |
| `PinSelector.tsx` | Restyle with Tailwind |
| `PinnedBanner.tsx` | Restyle with Tailwind |
| `AgentConfiguration.tsx` | Rewrite — remove embedded sidebar, align to sky palette |
| `AdminPage.tsx` | Restyle, remove Layout import |
| `AdminPanel.tsx` | Restyle with Tailwind |
| `UserManagement.tsx` | Restyle with Tailwind |
| `ManagerPage.tsx` | Restyle, remove Layout import |
| `ManagerPanel.tsx` | Restyle with Tailwind |
| `UserAccessEditor.tsx` | Restyle with Tailwind |
| `SettingsPage.tsx` | Restyle, remove Layout import |
| `HelpPage.tsx` | Restyle, remove Layout import |

---

## What Stays The Same

- All Zustand stores (authStore, chatStore, pinStore) — no changes
- All API client code (api/*.ts) — no changes
- All business logic within components (form handlers, data fetching, role checks)
- SSE streaming implementation
- React Router route paths
- Backend — zero changes
