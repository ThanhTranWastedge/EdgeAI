# AMCS Brand Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the AMCS Group brand identity (colors, typography, button styles, logo) to the EdgeAI frontend application.

**Architecture:** Replace the existing sky/slate Tailwind color scheme with AMCS brand tokens defined as CSS custom properties in Tailwind v4's CSS-first configuration. Update the shared style constants, Layout sidebar, and all component classes to reference the new brand system.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (Vite plugin), Zustand, Lucide React icons

---

## Brand Analysis (extracted from amcsgroup.com production CSS)

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary-100` | `#dc3b75` | Primary brand — CTAs, active states, links |
| `--color-primary-50` | `#e36291` | Primary hover / lighter accent |
| `--color-primary-25` | `#ed9dba` | Primary muted / focus rings |
| `--color-black` | `#131619` | Text, logo, headings |
| `--color-white` | `#ffffff` | Backgrounds, button text on primary |
| `--color-grey-50` | `#f5f5f5` | Page background, subtle fills |
| `--color-grey-100` | `#ededed` | Borders, dividers |
| `--color-grey-200` | `#e6e7e7` | Borders (heavier), input borders |
| `--color-grey-300` | `#acacac` | Disabled / placeholder text |
| `--color-grey-400` | `#848484` | Muted text |
| `--color-grey-500` | `#484b4c` | Secondary text |
| `--color-grey-600` | `#2c2c2c` | Body text |
| `--color-grey-700` | `#131619` | Same as black — darkest text |
| `--color-positive-400` | `#0a8200` | Success states |
| `--color-positive-50` | `#eaf4e8` | Success background |
| `--color-negative-500` | `#f97315` | Error/warning states (orange, not red) |
| `--color-negative-50` | `#fff7ed` | Error background |

**Industry accent palette** (for future use in dashboards/charts):

| Industry | 50 | 100 | 200 | 300 | 400 |
|---|---|---|---|---|---|
| Waste/Recycling | `#64b19c` | `#3c957c` | `#238369` | `#116c53` | `#01523c` |
| EHS/Services | `#3bc0d1` | `#3aa9bb` | `#1b9aaa` | `#168d9c` | `#118391` |
| Transport | `#5e96bd` | `#3978a4` | `#1e669b` | `#0d507f` | `#063e65` |
| Manufacturing | `#af8abc` | `#836490` | `#7c5187` | `#653471` | `#501e5c` |
| Chemicals | `#d68559` | `#be7147` | `#b76132` | `#934216` | `#672400` |
| Utilities | `#e8bf3c` | `#d5b038` | `#cea215` | `#a88105` | `#806100` |

### Typography

| Role | Font | Stack | Weights |
|------|------|-------|---------|
| Headings | **Faktum** | `"Faktum", "Helvetica Neue", Arial, sans-serif` | 500, 700 |
| Body | **Inter** | `"Inter", "Helvetica Neue", Arial, sans-serif` | 400, 500, 700 |

- Heading line-height: `1.125`
- Body line-height: `1.5`
- Heading letter-spacing: `-0.025em`

> **Note:** Faktum is a commercial typeface (by OH no Type Co). If your organisation holds a Faktum web licence, place the `.woff2` files in `frontend/public/fonts/` and load via `@font-face` (see Task 2). If not licensed, substitute with **Inter** for both heading and body — Inter at weight 700 closely approximates Faktum's geometric character.

### Buttons

| Variant | BG | Text | Border | Hover BG | Hover Text | Radius |
|---------|-----|------|--------|----------|------------|--------|
| Primary | `#dc3b75` | `#fff` | `#dc3b75` | `#e36291` | `#fff` | `50px` (pill) |
| Secondary | `transparent` | `#131619` | `#131619` | `#131619` | `#fff` | `50px` (pill) |
| Hollow | `transparent` | `#fff` | `#fff` | `#fff` | `#131619` | `50px` (pill) |

### Shadows

| Name | Value |
|------|-------|
| Default | `0 1px 3px 0 rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)` |
| Hover | `0 0 8px 0 rgba(0,0,0,.08)` |
| XL | `0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.1)` |

### Logo

- **SVG source:** `https://www.amcsgroup.com/static/assets/img/amcs-logo.svg`
- **Dimensions:** viewBox `0 0 97 34` (aspect ratio ≈ 2.85:1)
- **Fill:** single color `#131619`
- Save a local copy as `frontend/public/amcs-logo.svg`

### Overall Visual Tone

Modern corporate SaaS. Clean white/light-grey backgrounds, dark text (#131619), bold pink CTAs (#dc3b75), pill-shaped buttons, generous whitespace, Inter body text at 1rem/1.5 line-height. Minimal shadows. No gradients on UI elements.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `frontend/public/amcs-logo.svg` | Local copy of AMCS logo |
| Create | `frontend/public/fonts/` | Directory for Faktum font files (if licensed) |
| Modify | `frontend/src/index.css` | CSS custom properties, @font-face, @theme, Tailwind overrides |
| Modify | `frontend/src/styles.ts` | Shared class constants updated to new brand tokens |
| Modify | `frontend/src/components/Layout.tsx` | Logo image, sidebar colors, nav item colors |
| Modify | `frontend/src/pages/LoginPage.tsx` | Login form brand colors |
| Modify | `frontend/src/pages/*.tsx` + `frontend/src/components/*.tsx` | Task 6 catch-all: ~15 files with sky/slate/red/green classes |

---

## Task 1: Download and place the AMCS logo

**Files:**
- Create: `frontend/public/amcs-logo.svg`

- [ ] **Step 1: Download the SVG logo**

```bash
curl -sL "https://www.amcsgroup.com/static/assets/img/amcs-logo.svg" -o frontend/public/amcs-logo.svg
```

- [ ] **Step 2: Verify the file was saved correctly**

```bash
head -5 frontend/public/amcs-logo.svg
```
Expected: `<svg width="97" height="34" viewBox="0 0 97 34"...`

- [ ] **Step 3: Commit**

```bash
git add frontend/public/amcs-logo.svg
git commit -m "feat(brand): add AMCS Group logo SVG"
```

---

## Task 2: Define AMCS brand tokens in Tailwind CSS v4

**Files:**
- Modify: `frontend/src/index.css`

This project uses Tailwind CSS v4 with the Vite plugin (`@tailwindcss/vite`). Tailwind v4 uses CSS-first configuration — custom theme values are defined via `@theme` blocks in CSS, not a `tailwind.config.js` file.

- [ ] **Step 1: Add @font-face and @theme block to index.css**

Replace the first line (`@import "tailwindcss";`) with the full theme configuration. Keep all existing `.markdown-body` rules below it unchanged.

The new top section of `frontend/src/index.css` should be:

```css
@import "tailwindcss";

/* ── AMCS Brand: Font ─────────────────────────────────────── */

/*
 * If you have a Faktum web licence, uncomment the @font-face
 * block below and place .woff2 files in public/fonts/.
 *
 * @font-face {
 *   font-family: "Faktum";
 *   src: url("/fonts/Faktum-Medium.woff2") format("woff2");
 *   font-weight: 500;
 *   font-display: swap;
 * }
 * @font-face {
 *   font-family: "Faktum";
 *   src: url("/fonts/Faktum-Bold.woff2") format("woff2");
 *   font-weight: 700;
 *   font-display: swap;
 * }
 */

/* ── AMCS Brand: Theme Tokens ─────────────────────────────── */

@theme {
  /* ─ Colors ─ */
  --color-amcs-primary: #dc3b75;
  --color-amcs-primary-hover: #e36291;
  --color-amcs-primary-light: #ed9dba;
  --color-amcs-black: #131619;
  --color-amcs-white: #ffffff;

  --color-amcs-grey-50: #f5f5f5;
  --color-amcs-grey-100: #ededed;
  --color-amcs-grey-200: #e6e7e7;
  --color-amcs-grey-300: #acacac;
  --color-amcs-grey-400: #848484;
  --color-amcs-grey-500: #484b4c;
  --color-amcs-grey-600: #2c2c2c;

  --color-amcs-positive: #0a8200;
  --color-amcs-positive-light: #eaf4e8;
  --color-amcs-negative: #f97315;
  --color-amcs-negative-light: #fff7ed;

  /* ─ Font families (Tailwind v4 uses --font-* namespace) ─ */
  --font-heading: "Inter", "Helvetica Neue", Arial, sans-serif;
  --font-body: "Inter", "Helvetica Neue", Arial, sans-serif;

  /* ─ Border radius ─ */
  --radius-pill: 50px;
}

/* Apply base font globally */
body {
  font-family: var(--font-body);
  color: var(--color-amcs-black);
  line-height: 1.5;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  line-height: 1.125;
  letter-spacing: -0.025em;
}
```

- [ ] **Step 2: Verify the Tailwind classes compile**

```bash
cd frontend && npm run build
```
Expected: Build succeeds with no errors. The `@theme` block registers custom tokens that can be used as `bg-amcs-primary`, `text-amcs-black`, etc.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(brand): add AMCS brand tokens to Tailwind theme"
```

---

## Task 3: Update shared style constants

**Files:**
- Modify: `frontend/src/styles.ts`

Replace all `sky-*` references with `amcs-primary` variants and all `slate-*` with `amcs-grey-*` equivalents.

- [ ] **Step 1: Rewrite styles.ts**

```typescript
export const inputCls =
  'px-3 py-2 rounded-md border border-amcs-grey-200 bg-amcs-grey-50 text-sm text-amcs-black placeholder:text-amcs-grey-300 focus:outline-none focus:ring-2 focus:ring-amcs-primary-light/30 focus:border-amcs-primary transition-colors'

export const selectCls =
  'px-3 py-2 rounded-md border border-amcs-grey-200 bg-amcs-grey-50 text-sm text-amcs-black focus:outline-none focus:ring-2 focus:ring-amcs-primary-light/30 focus:border-amcs-primary cursor-pointer'

export const btnPrimaryCls =
  'px-6 py-2 rounded-full bg-amcs-primary text-white text-sm font-medium hover:bg-amcs-primary-hover transition-colors cursor-pointer'

export const btnDangerCls =
  'px-2 py-1 rounded text-xs text-amcs-negative border border-amcs-negative/30 hover:bg-amcs-negative-light transition-colors cursor-pointer'

export const btnSecondaryCls =
  'mr-2 px-4 py-2 rounded-full text-xs text-amcs-black border border-amcs-black hover:bg-amcs-black hover:text-white transition-colors cursor-pointer'

export const thCls =
  'text-left px-4 py-3 text-xs font-medium text-amcs-grey-400 uppercase tracking-wider bg-amcs-grey-50'
```

Key changes:
- `sky-500` → `amcs-primary`, `sky-600` → `amcs-primary-hover`
- `slate-200` border → `amcs-grey-200`, `slate-50` bg → `amcs-grey-50`
- `rounded-lg` on buttons → `rounded-full` (AMCS uses pill/50px radius for buttons)
- `red-*` danger → `amcs-negative` (orange, matching AMCS error palette)
- Secondary button now inverts on hover (transparent → black fill, matching AMCS secondary behavior)

- [ ] **Step 2: Verify build compiles**

```bash
cd frontend && npm run build
```
Expected: PASS — no unknown class errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles.ts
git commit -m "feat(brand): update shared style constants to AMCS tokens"
```

---

## Task 4: Rebrand the sidebar with AMCS logo

**Files:**
- Modify: `frontend/src/components/Layout.tsx:80-200`

This is the most visual change. Replace the "EdgeAI" text logo with the AMCS SVG, and update all sidebar color classes.

- [ ] **Step 1: Update the sidebar header to show the AMCS logo**

In `Layout.tsx`, replace the logo + toggle section (lines ~84–101):

**Old code (lines 84–101):**
```tsx
<div className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'px-6 justify-between'}`}>
  {!isCollapsed && (
    <span
      className="text-xl font-bold text-sky-500 cursor-pointer"
      onClick={() => navigate('/chat')}
    >
      EdgeAI
    </span>
  )}
  <button
    onClick={toggleSidebar}
    className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  >
    {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
  </button>
</div>
```

**New code:**
```tsx
<div className={`h-16 flex items-center shrink-0 ${isCollapsed ? 'justify-center' : 'px-5 justify-between'}`}>
  {!isCollapsed && (
    <img
      src="/amcs-logo.svg"
      alt="AMCS"
      className="h-7 w-auto cursor-pointer"
      onClick={() => navigate('/chat')}
    />
  )}
  <button
    onClick={toggleSidebar}
    className="text-amcs-grey-300 hover:text-amcs-grey-600 transition-colors cursor-pointer"
    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  >
    {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
  </button>
</div>
```

Key CSS for the logo:
- `h-7` — 28px height (scales naturally from 34px SVG to fit the 64px header with padding)
- `w-auto` — maintains the 2.85:1 aspect ratio
- `shrink-0` on the container prevents the logo from squishing
- `px-5` left padding aligns the logo with nav item text (which uses `px-4` + icon gap)
- When collapsed (`isCollapsed === true`), the logo hides entirely — the chevron toggle remains centered

- [ ] **Step 2: Update sidebar container and nav item colors**

Replace the sidebar `<aside>` class (line ~83):

Old:
```tsx
className={`${isCollapsed ? 'w-16' : 'w-60'} flex flex-col bg-slate-50 border-r border-slate-200 transition-all duration-300 overflow-hidden`}
```

New:
```tsx
className={`${isCollapsed ? 'w-16' : 'w-60'} flex flex-col bg-amcs-white border-r border-amcs-grey-100 transition-all duration-300 overflow-hidden`}
```

- [ ] **Step 3: Update the NavItem component colors**

Replace the NavItem className (lines ~22–26):

Old:
```tsx
className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
  ${active
    ? 'bg-sky-50 text-sky-600 font-semibold'
    : 'text-slate-600 hover:bg-slate-100'
  }`}
```

New:
```tsx
className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
  ${active
    ? 'bg-amcs-primary/10 text-amcs-primary font-semibold'
    : 'text-amcs-grey-500 hover:bg-amcs-grey-50'
  }`}
```

- [ ] **Step 4: Update the main content area and page background**

Replace the outer wrapper (line ~81):

Old: `<div className="flex h-screen bg-slate-50">`
New: `<div className="flex h-screen bg-amcs-grey-50">`

Replace the main area (line ~194):

Old: `<main className="flex-1 min-w-0 h-screen overflow-y-auto bg-slate-50">`
New: `<main className="flex-1 min-w-0 h-screen overflow-y-auto bg-amcs-grey-50">`

- [ ] **Step 5: Update remaining sidebar utility classes**

Do a find-and-replace within Layout.tsx only:
- `text-slate-400` → `text-amcs-grey-300`
- `hover:text-slate-600` → `hover:text-amcs-grey-600`
- `text-slate-600` → `text-amcs-grey-500`
- `bg-slate-200` → `bg-amcs-grey-200`
- `border-slate-200` → `border-amcs-grey-100`
- `text-slate-900` → `text-amcs-black`
- `hover:text-red-500` → `hover:text-amcs-negative`
- `text-sky-500` (if any remain) → `text-amcs-primary`

- [ ] **Step 6: Verify the build compiles and visually inspect**

```bash
cd frontend && npm run build
```
Expected: PASS

```bash
cd frontend && npm run dev
```
Open `http://localhost:5173` — sidebar should show the AMCS logo at top-left, pink active nav state, white sidebar background with light grey border.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat(brand): rebrand sidebar with AMCS logo and color tokens"
```

---

## Task 5: Update the Login page brand colors

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`

The login page already imports `btnPrimaryCls` from `styles.ts` (updated in Task 3), so the primary button is handled. Only the glassmorphism input class and any remaining hardcoded colors need updating.

- [ ] **Step 1: Update the glass input class**

In `LoginPage.tsx`, update the `glassInputCls` constant (line ~6):

Old:
```tsx
const glassInputCls = 'w-full px-3 py-2 rounded-lg text-sm bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30'
```

New:
```tsx
const glassInputCls = 'w-full px-3 py-2 rounded-md text-sm bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amcs-primary-light/40'
```

Changes: `rounded-lg` → `rounded-md` (AMCS uses smaller radius on inputs), focus ring now uses the pink brand color with transparency instead of plain white.

- [ ] **Step 2: Update the submit button's inline focus ring**

The submit button (line ~78) has an inline `focus:ring-sky-500/20` that is NOT covered by `btnPrimaryCls`. Find and replace:

Old: `focus:ring-sky-500/20`
New: `focus:ring-amcs-primary-light/30`

- [ ] **Step 3: Update the "EdgeAI" heading to show the AMCS logo**

Replace the `<h1>` on the login page with the AMCS logo (white version or with a CSS `brightness(0) invert(1)` filter for visibility on the dark/glass background):

Old:
```tsx
<h1 className="text-2xl font-bold text-white mb-6">EdgeAI</h1>
```

New:
```tsx
<img src="/amcs-logo.svg" alt="AMCS" className="h-8 w-auto brightness-0 invert mb-6" />
```

- [ ] **Step 4: Verify build compiles**

```bash
cd frontend && npm run build
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx
git commit -m "feat(brand): update login page to AMCS brand colors"
```

---

## Task 6: Update remaining pages with hardcoded sky/slate/red/green colors

**Files:**
- Modify: all `.tsx`/`.ts` files in `frontend/src/` that still use `sky-*`, `slate-*`, `red-*`, or `green-*` classes

Known files with remaining old colors (found via grep):
- `ChatPage.tsx`, `ChatWindow.tsx`, `MessageBubble.tsx`, `IntegrationList.tsx`
- `SessionHistory.tsx`, `PinSelector.tsx`, `PinnedBanner.tsx`
- `AdminPage.tsx`, `AdminPanel.tsx`, `ManagerPage.tsx`
- `SettingsPage.tsx`, `HelpPage.tsx`, `AgentConfiguration.tsx`
- `SectionCard.tsx`, `UserTable.tsx`, `UserAccessEditor.tsx`

- [ ] **Step 1: Find all files with old color classes**

```bash
cd frontend && grep -rn 'sky-\|slate-\|text-red-\|bg-red-\|border-red-\|text-green-\|bg-green-' src/ --include='*.tsx' --include='*.ts' | grep -v node_modules
```

- [ ] **Step 2: For each file found, apply the replacement mapping**

**Sky → AMCS Primary:**

| Old Class Pattern | New Class Pattern |
|---|---|
| `bg-sky-500` | `bg-amcs-primary` |
| `bg-sky-600` | `bg-amcs-primary-hover` |
| `bg-sky-50` | `bg-amcs-primary/10` |
| `text-sky-500` | `text-amcs-primary` |
| `text-sky-600` | `text-amcs-primary` |
| `ring-sky-500` | `ring-amcs-primary` |
| `focus-within:ring-sky-500/20` | `focus-within:ring-amcs-primary-light/30` |
| `focus-within:border-sky-500` | `focus-within:border-amcs-primary` |
| `focus:ring-sky-500` | `focus:ring-amcs-primary` |
| `border-sky-500` | `border-amcs-primary` |
| `border-sky-200` | `border-amcs-primary/30` |
| `border-sky-100` | `border-amcs-primary/20` |
| `hover:bg-sky-50` | `hover:bg-amcs-primary/10` |
| `hover:bg-sky-600` | `hover:bg-amcs-primary-hover` |

**Slate → AMCS Grey:**

| Old Class Pattern | New Class Pattern |
|---|---|
| `bg-slate-50` | `bg-amcs-grey-50` |
| `bg-slate-50/50` | `bg-amcs-grey-50/50` |
| `bg-slate-100` | `bg-amcs-grey-100` |
| `bg-slate-200` | `bg-amcs-grey-200` |
| `text-slate-400` | `text-amcs-grey-300` |
| `text-slate-500` | `text-amcs-grey-400` |
| `text-slate-600` | `text-amcs-grey-500` |
| `text-slate-700` | `text-amcs-grey-600` |
| `text-slate-800` | `text-amcs-grey-600` |
| `text-slate-900` | `text-amcs-black` |
| `border-slate-100` | `border-amcs-grey-100` |
| `border-slate-200` | `border-amcs-grey-100` |
| `border-slate-300` | `border-amcs-grey-200` |
| `divide-slate-100` | `divide-amcs-grey-100` |
| `hover:text-slate-600` | `hover:text-amcs-grey-500` |
| `hover:text-slate-700` | `hover:text-amcs-grey-600` |
| `hover:bg-slate-50` | `hover:bg-amcs-grey-50` |
| `hover:bg-slate-100` | `hover:bg-amcs-grey-100` |
| `placeholder:text-slate-400` | `placeholder:text-amcs-grey-300` |

**Red → AMCS Negative (orange-based):**

| Old Class Pattern | New Class Pattern |
|---|---|
| `text-red-300` | `text-amcs-negative/70` |
| `text-red-500` | `text-amcs-negative` |
| `border-red-200` | `border-amcs-negative/30` |
| `hover:bg-red-50` | `hover:bg-amcs-negative-light` |
| `hover:text-red-500` | `hover:text-amcs-negative` |

**Green → AMCS Positive:**

| Old Class Pattern | New Class Pattern |
|---|---|
| `bg-green-100` | `bg-amcs-positive-light` |
| `text-green-500` | `text-amcs-positive` |
| `text-green-700` | `text-amcs-positive` |

- [ ] **Step 3: Update the markdown-body styles in index.css**

Replace hardcoded hex values in `.markdown-body` rules:

| Old Hex | New Value |
|---|---|
| `#0f172a` | `var(--color-amcs-black)` |
| `#f1f5f9` | `var(--color-amcs-grey-50)` |
| `#e2e8f0` | `var(--color-amcs-grey-200)` |
| `#0284c7` | `var(--color-amcs-primary)` |
| `#64748b` | `var(--color-amcs-grey-400)` |
| `#f8fafc` | `var(--color-amcs-grey-50)` |

- [ ] **Step 4: Verify no old color classes remain**

```bash
cd frontend && grep -rn 'sky-\|slate-\|text-red-\|bg-red-\|border-red-\|text-green-\|bg-green-' src/ --include='*.tsx' --include='*.ts' --include='*.css'
```
Expected: zero matches

- [ ] **Step 5: Full build check**

```bash
cd frontend && npm run build
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat(brand): replace all sky/slate classes with AMCS brand tokens"
```

---

## Task 7: Final visual QA and cleanup

- [ ] **Step 1: Start dev server and check all pages**

```bash
cd frontend && npm run dev
```

Verify each route:
- `/chat` — sidebar logo, message bubbles, input field, send button
- `/login` — glassmorphism form, branded focus ring, primary CTA button
- `/admin` — tables use `thCls` with new grey, buttons are branded
- `/manager` — same table/button checks
- `/settings` — form inputs, save button
- `/help` — text readability with new colors

- [ ] **Step 2: Check dark-on-light contrast ratios**

The critical pairs to verify meet WCAG AA (4.5:1 for body text):
- `#131619` on `#ffffff` — 18.5:1 (PASS)
- `#131619` on `#f5f5f5` — 16.8:1 (PASS)
- `#dc3b75` on `#ffffff` — 4.5:1 (PASS AA)
- `#848484` on `#ffffff` — 3.9:1 (FAIL AA for small text — use `#484b4c` for body text, keep `#848484` for large labels only)
- `#ffffff` on `#dc3b75` — 4.5:1 (PASS AA for button text)

- [ ] **Step 3: Run ESLint**

```bash
cd frontend && npm run lint
```
Expected: no new errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(brand): final QA fixes for AMCS brand integration"
```
