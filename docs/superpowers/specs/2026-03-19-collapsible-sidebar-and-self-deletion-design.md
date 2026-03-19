# Collapsible Sidebar & Self-Deletion Prevention

**Date:** 2026-03-19
**Status:** Approved

## Overview

Two features for EdgeAI:
1. Make the primary sidebar collapsible, showing only icons in collapsed state
2. Prevent users from deleting their own account

## Feature 1: Collapsible Primary Sidebar

### Scope

- Primary sidebar only (Layout.tsx, 240px → 64px)
- Secondary sidebar (ChatPage integration list + session history) unchanged

### State Management

- `isCollapsed` boolean in Layout component
- Persisted in `localStorage` key `sidebar-collapsed`
- Initialized from localStorage on mount
- `isManualCollapse` ref tracks whether the current collapsed state was user-initiated

### Responsive Behavior

- `useEffect` with `resize` event listener
- Auto-collapse when `window.innerWidth < 768`
- Auto-expand when `window.innerWidth >= 768`, only if `isManualCollapse` is false
- Manual collapse sets `isManualCollapse = true`
- Manual expand sets `isManualCollapse = false` (clears the override, re-enables responsive behavior)

### UI Changes (Layout.tsx)

**Sidebar container:**
- Width: `w-60` (expanded) ↔ `w-16` (collapsed)
- Transition: `transition-all duration-300`

**Header (h-16):**
- Expanded: "EdgeAI" logo left, chevron-left (`ChevronLeft` from lucide-react) right
- Collapsed: chevron-right (`ChevronRight`) centered, logo hidden

**NavItem component:**
- Expanded: icon + label, current layout preserved
- Collapsed: icon centered, label hidden, `title` attribute as native tooltip
- Active state styling unchanged

**Divider:**
- Stays as horizontal line in both states

**Bottom section:**
- Expanded: fullname, role badge, logout button with text (current layout)
- Collapsed: initials avatar (2-letter, circular), logout icon only, role badge hidden
- All elements get `title` tooltips when collapsed

### New Imports

- Add `ChevronLeft`, `ChevronRight` to lucide-react imports in Layout.tsx

### Files Modified

- `frontend/src/components/Layout.tsx` — sidebar state, responsive logic, NavItem changes

## Feature 2: Prevent Self-Deletion

### Problem

The admin delete endpoint (`DELETE /api/admin/users/{user_id}`) has no self-deletion check. The manager endpoint already blocks this.

### Backend Fix

**File:** `backend/app/admin/router.py`

Add before user lookup in `delete_user` (note: the dependency parameter is named `admin` in this router):
```python
if user_id == admin.id:
    raise HTTPException(status_code=403, detail="Cannot delete own account")
```

### Frontend Fix

**File:** `frontend/src/components/UserTable.tsx`

- New prop: `currentUserId: string | undefined`
- For the row where `u.id === currentUserId`: disable Delete button
- Disabled button: `opacity-50 cursor-not-allowed`, no click handler
- Tooltip via `title="You cannot delete your own account"`

**File:** `frontend/src/components/UserManagement.tsx`

- Read current user ID via Zustand hook: `const currentUserId = useAuthStore((s) => s.user?.id)`
- Pass `currentUserId` to UserTable

**File:** `frontend/src/components/ManagerPanel.tsx`

- Read current user ID via Zustand hook: `const currentUserId = useAuthStore((s) => s.user?.id)`
- Pass `currentUserId` to UserTable (consistent UX, server already blocks it)

### Files Modified

- `backend/app/admin/router.py` — add self-deletion guard
- `frontend/src/components/UserTable.tsx` — accept `currentUserId`, disable button
- `frontend/src/components/UserManagement.tsx` — pass `currentUserId`
- `frontend/src/components/ManagerPanel.tsx` — pass `currentUserId`

## Testing

### Feature 1
- Toggle collapse/expand, verify icon-only state
- Refresh page, verify state persists
- Resize below 768px, verify auto-collapse
- Resize above 768px after auto-collapse (no manual toggle), verify auto-expand
- Resize above 768px after manual collapse, verify stays collapsed
- Manual expand after manual collapse, then resize below/above 768px, verify responsive behavior resumes
- Verify tooltips on all items when collapsed

### Feature 2
- Admin attempts to delete self via API → 403
- Admin delete button disabled for own row in UI
- Manager delete button disabled for own row in UI
- Admin can still delete other users normally
