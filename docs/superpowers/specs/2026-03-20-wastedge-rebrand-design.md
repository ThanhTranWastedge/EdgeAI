# EdgeAI WasteEdge Rebrand — Design Spec

## Overview

Redesign the EdgeAI frontend to align with the WasteEdge corporate identity. Replace the current AMCS magenta/pink brand tokens with WasteEdge's teal/green/blue palette, restructure the sidebar to include integrations and recent sessions, convert the chat input to a floating bar, and restyle all pages consistently.

## Decisions

| Decision | Choice |
|---|---|
| Color palette | WasteEdge actual: Teal `#004457`, Blue `#1488CA`, Green `#4faf30` |
| Scope | All pages — full rebrand |
| Chat greeting | Single elevated card with opening greeting content |
| Chat input | Floating bar at bottom with green send icon, no `+` button |
| Login page | Keep video background, restyle card with WasteEdge colors |
| Sidebar | Move integrations + recent sessions into main sidebar, remove ChatPage left panel |
| Page header | No "EdgeAI Enterprise Dashboard" header bar on chat page |
| Sidebar scroll | `overflow-y: auto` on middle section (only scrollbar when content overflows) |
| Implementation | Token swap + incremental restyle (Approach A) |

## 1. Brand Token System

Replace AMCS tokens in the `index.css` `@theme` block. Keep `amcs-` prefix for backward compatibility and add `we-` tokens for sidebar-specific styling.

### Token Mapping

| Token | Current Value | New Value |
|---|---|---|
| `--color-amcs-primary` | `#dc3b75` (magenta) | `#004457` (deep teal) |
| `--color-amcs-primary-hover` | `#e36291` | `#005a73` |
| `--color-amcs-primary-light` | `#ed9dba` | `#1488CA` (bright blue) |
| `--color-amcs-positive` | `#0a8200` | `#4faf30` (WE green) |
| `--color-amcs-positive-light` | `#eaf4e8` | `#f0fdf4` |
| `--color-amcs-negative` | `#f97315` | `#f97315` (unchanged) |
| `--color-amcs-negative-light` | `#fff7ed` | `#fff7ed` (unchanged) |
| `--color-amcs-black` | `#131619` | `#131619` (unchanged) |
| `--color-amcs-white` | `#ffffff` | `#ffffff` (unchanged) |
| `--color-amcs-grey-*` | (unchanged) | (unchanged) |

### New Tokens

| Token | Value | Purpose |
|---|---|---|
| `--color-we-sidebar` | `#004457` | Sidebar background |
| `--color-we-accent` | `#4faf30` | Primary CTA / active states |
| `--color-we-blue` | `#1488CA` | Links, secondary accent, avatars |
| `--color-we-sidebar-hover` | `#005a73` | Sidebar item hover |

## 2. Sidebar Redesign

### Structure

Convert the sidebar from white background to deep teal (`#004457`). Move `IntegrationList` and `SessionHistory` components from the ChatPage left panel into the Layout sidebar.

```
┌─────────────────┐
│ Logo (fixed)     │  flex-shrink: 0
│ Chat/Mgr/Admin   │
├─────────────────┤
│ INTEGRATIONS     │
│  · Agent 1       │  flex: 1
│  · Agent 2       │  overflow-y: auto
│  · ...           │  (scrollbar only on overflow)
│ RECENT SESSIONS  │
│  · Session 1     │  CSS mask-image fade
│  · Session 2     │  at top/bottom edges
├─────────────────┤
│ Help / Settings  │  flex-shrink: 0
│ User avatar      │
└─────────────────┘
```

### Styling Details

- **Background:** `bg-we-sidebar` (`#004457`)
- **Text:** `rgba(255,255,255,0.6)` for inactive items, white for active
- **Active nav item:** `bg-[rgba(79,175,48,0.15)]` background, `text-we-accent` (`#4faf30`)
- **Section labels:** uppercase, `letter-spacing: 1.2px`, `rgba(255,255,255,0.35)`
- **Integration indicators:** 6px green dot for active, 6px `rgba(255,255,255,0.25)` dot for inactive
- **Recent sessions:** `font-size: 11px`, `text-ellipsis`, `rgba(255,255,255,0.45)`
- **Dividers:** `1px solid rgba(255,255,255,0.08)`
- **User avatar:** `bg-we-blue` (`#1488CA`) circle with initials
- **Collapsed state:** Icon-only nav, dot indicators for integrations, avatar circle at bottom

### Component Changes

- **Layout.tsx:** Sidebar background changes from `bg-amcs-white` to `bg-we-sidebar`. All text/icon colors update to light-on-dark. IntegrationList and SessionHistory render inside sidebar's scrollable middle section.
- **ChatPage.tsx:** Remove the `w-56` left panel. ChatPage becomes just the ChatWindow component at full width.
- **IntegrationList.tsx:** Restyle for dark background. Active state uses green highlight instead of pink.
- **SessionHistory.tsx:** Restyle for dark background. Compact text with ellipsis overflow.

## 3. Chat Page

### Layout

No page header bar. Content area starts directly with the chat content on `#f8fafc` background.

### Greeting State

When an integration with an `opening_greeting` is selected and no messages have been sent:

1. **Agent header card** — white card with agent icon (teal rounded square), agent name, "Online" status
2. **Single greeting card** — white elevated card (`border-radius: 12px`, `box-shadow: 0 1px 3px rgba(0,0,0,0.04)`) containing the full markdown-rendered greeting content

The greeting card renders the `opening_greeting` markdown as-is inside a single card — headings, paragraphs, lists all flow naturally within it.

### Message Thread State

After the user sends a message, the greeting card scrolls up and standard message bubbles appear below:

- **User messages:** `bg-[#004457]` teal background, white text, `border-radius: 14px 14px 4px 14px` (flat bottom-right)
- **Assistant messages:** white background, `border: 1px solid #e2e8f0`, subtle shadow, `border-radius: 14px 14px 14px 4px` (flat bottom-left). Pin action button below the message.
- **Pinned context banner:** amber background (`#fffbeb`), amber border, pin icon — unchanged styling

### Floating Input Bar

Replace the current `border-t` attached input with a floating bar:

- **Position:** `position: absolute; bottom: 16px; left: 24px; right: 24px`
- **Container:** white background, `border-radius: 14px`, `box-shadow: 0 4px 20px rgba(0,0,0,0.08)`, `border: 1px solid #e2e8f0`
- **Inner layout:** `padding: 8px 8px 8px 20px`, flex row
- **Input:** unstyled, `font-size: 14px`, placeholder "Ask [Agent Name] something..."
- **Send button:** `40x40px`, `bg-we-accent` (`#4faf30`), `border-radius: 10px`, white send icon (paper plane SVG)
- **Content area padding-bottom:** `80px` to avoid content hiding behind floating input
- **Textarea behavior:** auto-grows with content up to a max height, same as current

### Pin Selector

The Pin selector currently opens below the input. With the floating input, it should open as a dropdown above the input bar (popping upward).

## 4. Login Page

### Keep

- Full-screen AMCS hero video background
- Semi-transparent dark overlay
- Glass-morphism card (backdrop-filter blur)

### Change

- **Logo:** Add green "E" badge (`32x32px`, `bg-we-accent`, `border-radius: 8px`) next to "EdgeAI" text
- **Subtitle:** Add "Enterprise" text below logo, `font-size: 11px`, `rgba(255,255,255,0.5)`
- **Sign In button:** Change from `bg-amcs-primary` (pink) to `bg-we-accent` (`#4faf30`) with `box-shadow: 0 4px 12px rgba(79,175,48,0.3)`
- **Input fields:** Slightly larger border-radius (`10px` vs current)
- **Card border-radius:** `16px`, refined border/shadow

## 5. Admin & Manager Pages

### Layout

Same sidebar shell. Content on `#f8fafc` background with white card containers.

### Tables

- White card container with `border-radius: 10px`, subtle shadow
- Header row: `bg-[#f8fafc]`, `font-weight: 600`, `color: #475569`
- Body rows: `border-bottom: 1px solid #f1f5f9`
- Role badges: Admin = teal `#004457`, Manager = blue `#1488CA`, User = gray `#94a3b8`

### Tabs

- Active tab: `color: #004457`, `border-bottom: 2px solid #004457`
- Inactive tab: `color: #94a3b8`

### Buttons

- Primary CTA (Add User): `bg-we-accent` (`#4faf30`), white text, subtle green shadow
- Edit links: `color: #1488CA`
- Delete links: `color: #ef4444` (red, unchanged)

## 6. Settings Page

- White card on `#f8fafc` background
- Form inputs: `bg-[#f8fafc]`, `border: 1px solid #e2e8f0`, `border-radius: 8px`
- Submit button: `bg-[#004457]` teal (secondary style for non-CTA actions)

## 7. Help Page

- White card on `#f8fafc` background
- Info cards with semantic coloring:
  - Getting Started: green background/border
  - Using Pins: blue background/border
  - Session History: amber background/border

## 8. Shared Style Constants (`styles.ts`)

Update the shared className constants:

- `btnPrimaryCls`: Change pink references to teal `#004457`
- `inputCls`: Update focus ring from `amcs-primary-light` to `we-blue`
- `btnDangerCls`: Keep as-is (orange/red)
- `btnSecondaryCls`: Update to use teal/blue palette

## 9. Responsive Behavior

- **< 768px:** Sidebar auto-collapses to icon-only mode (existing behavior, restyled)
- **Greeting card:** Full width on mobile (no multi-column, already single card)
- **Floating input:** `left: 12px; right: 12px` on mobile (tighter margins)
- **Admin tables:** Horizontal scroll on small screens (existing behavior)

## 10. Files to Modify

| File | Changes |
|---|---|
| `frontend/src/index.css` | Replace `@theme` token values, add `we-*` tokens |
| `frontend/src/styles.ts` | Update shared className color references |
| `frontend/src/components/Layout.tsx` | Dark sidebar, move IntegrationList/SessionHistory in, update all colors |
| `frontend/src/components/IntegrationList.tsx` | Restyle for dark sidebar background |
| `frontend/src/components/SessionHistory.tsx` | Restyle for dark sidebar background |
| `frontend/src/components/ChatWindow.tsx` | Floating input bar, greeting card rendering, updated message bubble colors |
| `frontend/src/components/MessageBubble.tsx` | Teal user bubbles, refined assistant bubbles |
| `frontend/src/components/PinSelector.tsx` | Open upward above floating input |
| `frontend/src/components/PinnedBanner.tsx` | No changes needed (already amber) |
| `frontend/src/pages/ChatPage.tsx` | Remove left panel (IntegrationList/SessionHistory moved to sidebar) |
| `frontend/src/pages/LoginPage.tsx` | Green button, "E" badge, "Enterprise" subtitle |
| `frontend/src/pages/AdminPage.tsx` | Inherit new token colors |
| `frontend/src/pages/ManagerPage.tsx` | Inherit new token colors |
| `frontend/src/pages/SettingsPage.tsx` | Inherit new token colors |
| `frontend/src/pages/HelpPage.tsx` | Inherit new token colors |
| `frontend/src/components/AdminPanel.tsx` | Role badge colors, button colors |
| `frontend/src/components/ManagerPanel.tsx` | Role badge colors, button colors |
| `frontend/src/components/SectionCard.tsx` | Updated card styling if needed |
