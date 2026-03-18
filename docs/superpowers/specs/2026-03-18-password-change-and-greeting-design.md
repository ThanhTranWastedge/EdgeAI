# Password Change & Integration Greeting — Design Spec

## Feature 1: User Self-Service Password Change

### Goal

Allow any authenticated user to change their own password without admin intervention.

### API

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/change-password` | POST | User | Change own password |

**Request/Response:**

```
POST /api/auth/change-password
  Request: { current_password: str, new_password: str }
  Response: { message: "Password updated" }
  Errors: 400 if current_password is wrong
```

Server-side logic:
1. Get current user via `get_current_user` dependency
2. Verify `current_password` against `user.password_hash` using `verify_password()`
3. Hash `new_password` with `hash_password()`, update `user.password_hash`
4. Commit and return success

### Frontend

**New page — `SettingsPage.tsx`:**
- Accessible by all roles via `/settings` route
- Layout wrapper (same as other pages)
- Password change form with three fields: current password, new password, confirm new password
- Client-side validation: new password and confirm must match, all fields required
- On success: show success message, clear form
- On 400: show "Current password is incorrect"

**New API module — `api/settings.ts`:**
- `changePasswordApi(data: { current_password: string; new_password: string })`

**Layout changes:**
- Add "Settings" button in header for all roles (between Help and Logout)

**App.tsx:**
- Add `/settings` route guarded by auth

### No Changes To

- Admin/manager password reset — unchanged, still works via their respective endpoints
- Auth tokens — no invalidation needed (password change doesn't affect existing sessions)

---

## Feature 2: Opening Greeting Per Integration

### Goal

Allow admins to configure a welcome message per integration that appears as an assistant message bubble when a user first selects the integration (before sending any message).

### Data Model

Add to `Integration` model:

| Column | Type | Constraints |
|---|---|---|
| opening_greeting | Text | nullable |

### API Changes

**Modified schemas:**

- `IntegrationCreate`: add `opening_greeting: str | None = None`
- `IntegrationUpdate`: add `opening_greeting: str | None = None`
- `IntegrationResponse`: add `opening_greeting: str | None = None`

**Modified endpoint:**

- `POST /api/integrations` — accepts `opening_greeting`
- `PUT /api/integrations/{id}` — accepts `opening_greeting`

No changes to `GET /api/integrations` logic — the field is returned automatically via `IntegrationResponse`.

### Frontend

**Integration interface** (`api/integrations.ts`):
- Add `opening_greeting: string | null`

**ChatWindow.tsx:**
- When `activeIntegration` is set and `currentMessages` is empty:
  - If `activeIntegration.opening_greeting` exists, render it as a styled assistant message bubble (same visual treatment as real assistant messages)
  - This is purely UI — not persisted to the database, not a real message
- When user sends a message and gets a response, the greeting naturally disappears (replaced by actual messages)

**AdminPanel.tsx:**
- Add a textarea input for `opening_greeting` when creating an integration (optional field)

### Edge Cases

- **No greeting set:** Empty chat area shows as before (no greeting bubble)
- **Greeting updated:** Next time a user selects the integration, they see the new greeting
- **Existing database:** Requires `ALTER TABLE integrations ADD COLUMN opening_greeting TEXT` migration for existing deployments
