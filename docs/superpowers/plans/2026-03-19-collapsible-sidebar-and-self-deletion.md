# Collapsible Sidebar & Self-Deletion Prevention — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the primary sidebar collapsible (icons-only) with responsive auto-collapse, and prevent users from deleting their own account.

**Architecture:** Feature 1 adds collapse state to Layout.tsx with localStorage persistence and a resize listener for responsive behavior. Feature 2 adds a server-side guard to the admin delete endpoint and disables the delete button in the frontend for the current user's row.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, lucide-react, Zustand, FastAPI, SQLAlchemy async, pytest

**Spec:** `docs/superpowers/specs/2026-03-19-collapsible-sidebar-and-self-deletion-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/components/Layout.tsx` | Sidebar collapse state, responsive logic, NavItem icon-only mode |
| Modify | `backend/app/admin/router.py` | Self-deletion guard on delete endpoint |
| Modify | `frontend/src/components/UserTable.tsx` | Accept `currentUserId`, disable delete button for self |
| Modify | `frontend/src/components/UserManagement.tsx` | Read current user ID from auth store, pass to UserTable |
| Modify | `frontend/src/components/ManagerPanel.tsx` | Read current user ID from auth store, pass to UserTable |
| Modify | `backend/tests/test_admin.py` | Test for self-deletion 403 |

---

### Task 1: Backend — Add self-deletion guard to admin endpoint

**Files:**
- Modify: `backend/app/admin/router.py:72-87`
- Test: `backend/tests/test_admin.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_admin.py`:

```python
@pytest.mark.asyncio
async def test_admin_cannot_delete_self(client):
    token = await admin_login(client)
    # Get admin's own user ID
    users = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    admin_user = [u for u in users.json() if u["username"] == "admin"][0]
    response = await client.delete(
        f"/api/admin/users/{admin_user['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Cannot delete own account"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/thanh-tran/EdgeAI/backend && SECRET_KEY=test python -m pytest tests/test_admin.py::test_admin_cannot_delete_self -v`
Expected: FAIL — currently returns 204 (user gets deleted)

- [ ] **Step 3: Add self-deletion guard**

In `backend/app/admin/router.py`, add after line 77 (after `admin: User = Depends(require_admin),`) and before the DB lookup:

```python
    if user_id == admin.id:
        raise HTTPException(status_code=403, detail="Cannot delete own account")
```

The full `delete_user` function becomes:

```python
@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=403, detail="Cannot delete own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.execute(
        delete(UserIntegrationAccess).where(UserIntegrationAccess.user_id == user_id)
    )
    await db.delete(user)
    await db.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/thanh-tran/EdgeAI/backend && SECRET_KEY=test python -m pytest tests/test_admin.py -v`
Expected: ALL PASS including `test_admin_cannot_delete_self`

- [ ] **Step 5: Commit**

```bash
git add backend/app/admin/router.py backend/tests/test_admin.py
git commit -m "feat: prevent admin from deleting own account"
```

---

### Task 2: Frontend — Disable delete button for current user

**Files:**
- Modify: `frontend/src/components/UserTable.tsx:1-69`
- Modify: `frontend/src/components/UserManagement.tsx:1-23`
- Modify: `frontend/src/components/ManagerPanel.tsx:1-22`

- [ ] **Step 1: Add `currentUserId` prop to UserTable**

In `frontend/src/components/UserTable.tsx`, update the `Props` interface and component signature:

```typescript
interface Props {
  users: User[]
  availableRoles: string[]
  currentUserId: string | undefined
  onCreateUser: (data: { username: string; password: string; role: string; fullname?: string }) => Promise<void>
  onToggleRole: (userId: string, currentRole: string) => Promise<void>
  onDeleteUser: (userId: string) => Promise<void>
}

export default function UserTable({ users, availableRoles, currentUserId, onCreateUser, onToggleRole, onDeleteUser }: Props) {
```

- [ ] **Step 2: Disable delete button for current user's row**

In `frontend/src/components/UserTable.tsx`, replace the Delete button (line 59) with:

```tsx
{u.id === currentUserId ? (
  <button
    disabled
    title="You cannot delete your own account"
    className={`${btnDangerCls} opacity-50 cursor-not-allowed`}
  >
    Delete
  </button>
) : (
  <button onClick={async () => { if (confirm('Delete user?')) await onDeleteUser(u.id) }} className={btnDangerCls}>
    Delete
  </button>
)}
```

- [ ] **Step 3: Pass `currentUserId` from UserManagement**

In `frontend/src/components/UserManagement.tsx`, add auth store import and pass the prop:

```typescript
import { useEffect, useState } from 'react'
import { User } from '../api/auth'
import { listUsersApi, createUserApi, updateUserApi, deleteUserApi } from '../api/admin'
import { useAuthStore } from '../store/authStore'
import UserTable from './UserTable'

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const currentUserId = useAuthStore((s) => s.user?.id)

  const loadUsers = () => listUsersApi().then(({ data }) => setUsers(data))
  useEffect(() => { loadUsers() }, [])

  const roleCycle: Record<string, string> = { user: 'manager', manager: 'admin', admin: 'user' }

  return (
    <UserTable
      users={users}
      availableRoles={['user', 'manager', 'admin']}
      currentUserId={currentUserId}
      onCreateUser={async (data) => { await createUserApi(data); loadUsers() }}
      onToggleRole={async (id, role) => { await updateUserApi(id, { role: roleCycle[role] || 'user' }); loadUsers() }}
      onDeleteUser={async (id) => { await deleteUserApi(id); loadUsers() }}
    />
  )
}
```

- [ ] **Step 4: Pass `currentUserId` from ManagerPanel**

In `frontend/src/components/ManagerPanel.tsx`, add auth store import and pass the prop:

```typescript
import { User } from '../api/auth'
import { createManagerUserApi, updateManagerUserApi, deleteManagerUserApi } from '../api/manager'
import { useAuthStore } from '../store/authStore'
import UserTable from './UserTable'

interface Props {
  users: User[]
  onUsersChange: () => void
}

export default function ManagerPanel({ users, onUsersChange }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id)
  const nextRole = (role: string) => role === 'user' ? 'manager' : 'user'

  return (
    <UserTable
      users={users}
      availableRoles={['user', 'manager']}
      currentUserId={currentUserId}
      onCreateUser={async (data) => { await createManagerUserApi(data); onUsersChange() }}
      onToggleRole={async (id, role) => { await updateManagerUserApi(id, { role: nextRole(role) }); onUsersChange() }}
      onDeleteUser={async (id) => { await deleteManagerUserApi(id); onUsersChange() }}
    />
  )
}
```

- [ ] **Step 5: Verify build**

Run: `cd /home/thanh-tran/EdgeAI/frontend && npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/UserTable.tsx frontend/src/components/UserManagement.tsx frontend/src/components/ManagerPanel.tsx
git commit -m "feat: disable delete button for current user's own row"
```

---

### Task 3: Frontend — Collapsible sidebar state and toggle

**Files:**
- Modify: `frontend/src/components/Layout.tsx:1-129`

- [ ] **Step 1: Add collapse state and toggle logic**

In `frontend/src/components/Layout.tsx`, add imports and state. Replace the entire file with:

```typescript
import { useEffect, useState, useRef, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { MessageSquare, Users, Shield, HelpCircle, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'

const SIDEBAR_KEY = 'sidebar-collapsed'
const BREAKPOINT = 768

interface NavItemProps {
  icon: React.ReactNode
  label: string
  active: boolean
  collapsed: boolean
  onClick: () => void
}

function NavItem({ icon, label, active, collapsed, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
        ${active
          ? 'bg-sky-50 text-sky-600 font-semibold'
          : 'text-slate-600 hover:bg-slate-100'
        }`}
    >
      {icon}
      {!collapsed && label}
    </button>
  )
}

function getInitials(fullname: string | undefined, username: string | undefined): string {
  const name = fullname || username || ''
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function Layout() {
  const { user, logout, checkAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === 'true')
  const isManualCollapseRef = useRef(localStorage.getItem(SIDEBAR_KEY) === 'true')

  const toggleSidebar = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_KEY, String(next))
      isManualCollapseRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < BREAKPOINT) {
        setIsCollapsed(true)
      } else if (!isManualCollapseRef.current) {
        setIsCollapsed(false)
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize() // check on mount
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    checkAuth()
  }, [])

  const isActive = (path: string) => location.pathname === path
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'
  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`${isCollapsed ? 'w-16' : 'w-60'} flex flex-col bg-slate-50 border-r border-slate-200 transition-all duration-300`}>
        {/* Logo + toggle */}
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

        {/* Main nav */}
        <nav className={`flex-1 ${isCollapsed ? 'px-1' : 'px-3'} space-y-1`}>
          <NavItem
            icon={<MessageSquare className="w-5 h-5" />}
            label="Chat"
            active={isActive('/chat')}
            collapsed={isCollapsed}
            onClick={() => navigate('/chat')}
          />

          {/* Role-gated items */}
          {isManagerOrAdmin && (
            <div className="border-t border-slate-200 my-2 pt-2">
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
            </div>
          )}
        </nav>

        {/* Bottom section */}
        <div className={`${isCollapsed ? 'px-1' : 'px-3'} pb-4 space-y-1`}>
          <div className="border-t border-slate-200 pt-3 mb-1" />
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
            <div className="border-t border-slate-200 mt-3 pt-3 flex flex-col items-center gap-2">
              <div
                className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600"
                title={user?.fullname || user?.username}
              >
                {getInitials(user?.fullname, user?.username)}
              </div>
              <button
                onClick={logout}
                className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
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
          )}
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

- [ ] **Step 2: Verify build**

Run: `cd /home/thanh-tran/EdgeAI/frontend && npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Manual smoke test**

Run: `cd /home/thanh-tran/EdgeAI/frontend && npm run dev`

Verify:
1. Sidebar shows expanded with "EdgeAI" logo and chevron-left icon
2. Click chevron → sidebar collapses to icon-only (64px), chevron changes to right
3. All nav items show only icons with native tooltips on hover
4. User info becomes initials avatar, role badge hidden
5. Click chevron-right → sidebar expands back
6. Refresh page → collapse state persists
7. Resize window below 768px → auto-collapses
8. Resize above 768px → auto-expands (if not manually collapsed)
9. Manually collapse, resize above 768px → stays collapsed
10. Manually expand, resize below/above → responsive behavior resumes

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: collapsible sidebar with responsive auto-collapse"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run all backend tests**

Run: `cd /home/thanh-tran/EdgeAI/backend && SECRET_KEY=test python -m pytest tests/ -v`
Expected: ALL PASS

- [ ] **Step 2: Run frontend build**

Run: `cd /home/thanh-tran/EdgeAI/frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run frontend lint**

Run: `cd /home/thanh-tran/EdgeAI/frontend && npm run lint`
Expected: No errors
