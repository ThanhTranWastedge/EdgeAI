# Chat Input Height Increase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase the chat input field height by 3 Tailwind units (py-2 → py-5).

**Architecture:** Override the shared `inputCls` padding on the chat input element only, preserving other inputs.

**Tech Stack:** React, Tailwind CSS

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/components/ChatWindow.tsx:129` | Add `py-5` override to chat input className |

---

### Task 1: Increase chat input height

**Files:**
- Modify: `frontend/src/components/ChatWindow.tsx:129`

- [ ] **Step 1: Add py-5 override to chat input**

In `frontend/src/components/ChatWindow.tsx` line 129, change:

```tsx
className={`flex-1 ${inputCls}`}
```

to:

```tsx
className={`flex-1 ${inputCls} py-5`}
```

This overrides the `py-2` from `inputCls` with `py-5` (1.25rem / 20px padding top+bottom), making the input ~3 Tailwind units taller. Only affects the chat input, not other inputs using `inputCls`.

- [ ] **Step 2: Verify build**

Run: `cd /home/thanh-tran/EdgeAI/frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatWindow.tsx
git commit -m "feat: increase chat input field height"
```
