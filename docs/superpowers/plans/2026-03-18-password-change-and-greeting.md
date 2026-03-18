# Password Change & Integration Greeting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user self-service password change and admin-configurable opening greeting per integration.

**Architecture:** Two independent features sharing one commit workflow. Feature 1 adds a new auth endpoint + settings page. Feature 2 adds a column to Integration + renders greeting in ChatWindow.

**Tech Stack:** FastAPI, SQLAlchemy async, React 18, TypeScript, Zustand

**Spec:** `docs/superpowers/specs/2026-03-18-password-change-and-greeting-design.md`

---

### Task 1: Backend — Change Password Endpoint

**Files:**
- Modify: `backend/app/auth/schemas.py` — add `ChangePasswordRequest`
- Modify: `backend/app/auth/router.py` — add `/change-password` endpoint
- Create: `backend/tests/test_change_password.py`

- [ ] **Step 1: Add schema**

In `backend/app/auth/schemas.py`, add at the end:

```python
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
```

- [ ] **Step 2: Add endpoint**

In `backend/app/auth/router.py`, add these imports to the existing import line:

```python
from app.auth.utils import verify_password, hash_password, create_access_token, create_refresh_token, decode_token
from app.auth.schemas import LoginRequest, TokenResponse, RefreshRequest, UserResponse, ChangePasswordRequest
```

Then add the endpoint at the end of the file:

```python
@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password updated"}
```

- [ ] **Step 3: Write tests**

Create `backend/tests/test_change_password.py`:

```python
import pytest
import uuid
from app.auth.utils import hash_password


async def _create_user_and_login(client, username="cpuser", password="oldpass"):
    from tests.conftest import TestingSessionLocal
    from app.models import User
    async with TestingSessionLocal() as db:
        user = User(id=str(uuid.uuid4()), username=username, password_hash=hash_password(password), role="user")
        db.add(user)
        await db.commit()
    login = await client.post("/api/auth/login", json={"username": username, "password": password})
    return login.json()["access_token"]


@pytest.mark.asyncio
async def test_change_password_success(client):
    token = await _create_user_and_login(client)
    response = await client.post(
        "/api/auth/change-password",
        json={"current_password": "oldpass", "new_password": "newpass"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Password updated"

    # Verify login works with new password
    login = await client.post("/api/auth/login", json={"username": "cpuser", "password": "newpass"})
    assert login.status_code == 200


@pytest.mark.asyncio
async def test_change_password_wrong_current(client):
    token = await _create_user_and_login(client, username="cpuser2", password="correct")
    response = await client.post(
        "/api/auth/change-password",
        json={"current_password": "wrong", "new_password": "newpass"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert "incorrect" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_change_password_unauthenticated(client):
    response = await client.post(
        "/api/auth/change-password",
        json={"current_password": "x", "new_password": "y"},
    )
    assert response.status_code == 403
```

- [ ] **Step 4: Run tests**

Run: `cd backend && source .venv/bin/activate && SECRET_KEY=test python -m pytest tests/test_change_password.py -v`
Expected: 3 passed

- [ ] **Step 5: Run full test suite**

Run: `SECRET_KEY=test python -m pytest tests/ -q`
Expected: 59 passed (56 existing + 3 new)

---

### Task 2: Frontend — Settings Page with Password Change

**Files:**
- Create: `frontend/src/api/settings.ts`
- Create: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/components/Layout.tsx` — add Settings button
- Modify: `frontend/src/App.tsx` — add `/settings` route

- [ ] **Step 1: Create API module**

Create `frontend/src/api/settings.ts`:

```typescript
import client from './client'

export const changePasswordApi = (data: { current_password: string; new_password: string }) =>
  client.post('/auth/change-password', data)
```

- [ ] **Step 2: Create SettingsPage**

Create `frontend/src/pages/SettingsPage.tsx`:

```tsx
import { useState } from 'react'
import Layout from '../components/Layout'
import { changePasswordApi } from '../api/settings'

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
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to change password')
    }
  }

  const inputStyle = { padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0', width: '100%' }

  return (
    <Layout>
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <h2 style={{ color: '#64ffda', marginBottom: 24 }}>Settings</h2>
        <div style={{ maxWidth: 400 }}>
          <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>Change Password</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
            <button onClick={handleSubmit} style={{ padding: '8px 16px', background: '#64ffda', color: '#0d1117', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Update Password</button>
          </div>
          {message && <div style={{ marginTop: 12, color: '#64ffda', fontSize: 13 }}>{message}</div>}
          {error && <div style={{ marginTop: 12, color: '#cf6679', fontSize: 13 }}>{error}</div>}
        </div>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 3: Add Settings button to Layout**

In `frontend/src/components/Layout.tsx`, add between the Help and Logout buttons:

```tsx
<button onClick={() => navigate('/settings')} style={{ padding: '4px 10px', background: '#21262d', border: '1px solid #30363d', borderRadius: 4, color: '#8b949e', cursor: 'pointer', fontSize: 11 }}>Settings</button>
```

- [ ] **Step 4: Add route to App.tsx**

In `frontend/src/App.tsx`:

Add import:
```tsx
import SettingsPage from './pages/SettingsPage'
```

Add route (before the `/admin` route):
```tsx
<Route path="/settings" element={
  accessToken ? <SettingsPage /> : <Navigate to="/login" />
} />
```

- [ ] **Step 5: Verify frontend builds**

Run: `cd frontend && npm run build`
Expected: Build succeeds

---

### Task 3: Backend — Integration Opening Greeting

**Files:**
- Modify: `backend/app/models.py` — add `opening_greeting` column to `Integration`
- Modify: `backend/app/integrations/schemas.py` — add field to all schemas
- Modify: `backend/app/integrations/router.py` — handle field in create/update

- [ ] **Step 1: Add column to model**

In `backend/app/models.py`, in the `Integration` class, add after the `icon` column:

```python
opening_greeting = Column(Text, nullable=True)
```

- [ ] **Step 2: Add to schemas**

In `backend/app/integrations/schemas.py`:

Add to `IntegrationCreate` after `icon`:
```python
opening_greeting: str | None = None
```

Add to `IntegrationUpdate` after `icon`:
```python
opening_greeting: str | None = None
```

Add to `IntegrationResponse` after `icon`:
```python
opening_greeting: str | None = None
```

- [ ] **Step 3: Handle in router**

In `backend/app/integrations/router.py`:

In `create_integration`, add to the `Integration(...)` constructor after `icon=body.icon,`:
```python
opening_greeting=body.opening_greeting,
```

In `update_integration`, add after the `if body.icon is not None:` block:
```python
if body.opening_greeting is not None:
    integration.opening_greeting = body.opening_greeting
```

- [ ] **Step 4: Write tests**

Add to `backend/tests/test_integrations.py`, at the end:

```python
@pytest.mark.asyncio
async def test_create_integration_with_greeting(client):
    token = await create_admin_and_login(client)
    response = await client.post(
        "/api/integrations",
        json={"name": "Greeter", "provider_type": "ragflow", "provider_config": {"base_url": "x", "api_key": "k", "chat_id": "c", "type": "chat"}, "opening_greeting": "Hello! How can I help?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["opening_greeting"] == "Hello! How can I help?"


@pytest.mark.asyncio
async def test_update_integration_greeting(client):
    token = await create_admin_and_login(client)
    create = await client.post(
        "/api/integrations",
        json={"name": "G2", "provider_type": "ragflow", "provider_config": {"base_url": "x", "api_key": "k", "chat_id": "c", "type": "chat"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    iid = create.json()["id"]
    assert create.json()["opening_greeting"] is None

    response = await client.put(
        f"/api/integrations/{iid}",
        json={"opening_greeting": "Welcome!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["opening_greeting"] == "Welcome!"
```

- [ ] **Step 5: Run tests**

Run: `cd backend && source .venv/bin/activate && SECRET_KEY=test python -m pytest tests/ -q`
Expected: 61 passed (59 + 2 new)

---

### Task 4: Frontend — Display Opening Greeting in Chat

**Files:**
- Modify: `frontend/src/api/integrations.ts` — add `opening_greeting` to interface
- Modify: `frontend/src/components/ChatWindow.tsx` — render greeting bubble
- Modify: `frontend/src/components/AdminPanel.tsx` — add greeting textarea

- [ ] **Step 1: Update Integration interface**

In `frontend/src/api/integrations.ts`, add to the `Integration` interface after `icon`:

```typescript
opening_greeting: string | null
```

- [ ] **Step 2: Render greeting in ChatWindow**

In `frontend/src/components/ChatWindow.tsx`, in the messages area (inside the `<div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>` div), add after `<PinnedBanner ... />` and before the `{currentMessages.map(...)` block:

```tsx
{currentMessages.length === 0 && activeIntegration.opening_greeting && (
  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: '12px 12px 12px 2px',
      padding: '12px 16px',
      maxWidth: '70%',
    }}>
      <div style={{ color: '#e0e0e0', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {activeIntegration.opening_greeting}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Add greeting input to AdminPanel**

In `frontend/src/components/AdminPanel.tsx`:

Add state:
```tsx
const [greeting, setGreeting] = useState('')
```

Add textarea after the config JSON textarea (before the Add button):
```tsx
<input placeholder="Opening Greeting (optional)" value={greeting} onChange={(e) => setGreeting(e.target.value)} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0', flex: 1, minWidth: 200 }} />
```

Update `handleCreate` to include greeting:
```tsx
await createIntegrationApi({ name, provider_type: providerType, provider_config: config, opening_greeting: greeting || undefined })
```

Add `setGreeting('')` to the reset block after `setConfigJson('{}')`.

- [ ] **Step 4: Verify frontend builds**

Run: `cd frontend && npm run build`
Expected: Build succeeds

---

### Task 5: Verify, Commit, and Update Docs

**Files:**
- Modify: `CLAUDE.md` — no changes needed (already documents auth and integration patterns)
- Modify: `docs/user-guide.md` — add settings/password change section
- Modify: `docs/developer-guide.md` — add change-password endpoint, opening_greeting to schema

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && source .venv/bin/activate && SECRET_KEY=test python -m pytest tests/ -v`
Expected: 61 passed

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Update user guide**

In `docs/user-guide.md`, add a "Settings" section before the "Manager Features" section:

```markdown
## Settings

Click the **Settings** button in the top navigation bar to access your account settings.

### Changing Your Password

1. Go to **Settings**
2. Enter your current password
3. Enter your new password and confirm it
4. Click **Update Password**
```

- [ ] **Step 4: Update developer guide**

In `docs/developer-guide.md`:

Add to the Authentication API table:
```
| `/api/auth/change-password` | POST | User | Change own password `{current_password, new_password}` |
```

Add `opening_greeting` to the integrations database schema section:
```
integrations
  id, name, provider_type, provider_config (JSON), description, icon,
  opening_greeting, created_at, updated_by → users.id
```

- [ ] **Step 5: Commit all changes**

Commit in two logical groups:
1. `feat: add user self-service password change` — auth schema/router, settings API/page, layout, app route, tests
2. `feat: add integration opening greeting` — model, schemas, router, ChatWindow, AdminPanel, tests

- [ ] **Step 6: Database migration reminder**

For existing deployments, run inside the backend container:
```python
import sqlite3
conn = sqlite3.connect('/app/data/edgeai.db')
cols = [r[1] for r in conn.execute('PRAGMA table_info(integrations)').fetchall()]
if 'opening_greeting' not in cols:
    conn.execute('ALTER TABLE integrations ADD COLUMN opening_greeting TEXT')
    conn.commit()
    print('Added opening_greeting column')
conn.close()
```
