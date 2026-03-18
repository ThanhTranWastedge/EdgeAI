# Manager Role & Integration Access Control — Design Spec

## Goal

Add a `manager` role to EdgeAI with user management capabilities, and implement per-user integration access control with deny-by-default for the `user` role.

## Role Hierarchy

Three roles: `admin` > `manager` > `user`.

| Capability | user | manager | admin |
|---|---|---|---|
| Chat with granted integrations | Yes | Yes (all) | Yes (all) |
| Pin responses | Yes | Yes | Yes |
| Create/update/delete users | No | Yes (user + manager only) | Yes (all) |
| Reset user passwords | No | Yes (user + manager only) | Yes (all) |
| Manage integration access for users | No | Yes | Yes |
| Create/update/delete integrations | No | No | Yes |
| Access manager page | No | Yes | Yes |
| Access admin page | No | No | Yes |

### Manager Guard Rails (enforced server-side)

- Cannot create accounts with `admin` role
- Cannot edit or delete `admin` accounts
- Cannot promote anyone to `admin`
- Cannot change their own role
- Cannot delete their own account

## Data Model

### New Constant

```python
ROLE_MANAGER = "manager"
```

Added to `app/constants.py` alongside existing `ROLE_ADMIN` and `ROLE_USER`.

### New Table — `user_integration_access`

| Column | Type | Constraints |
|---|---|---|
| id | String (UUID) | PK |
| user_id | String | FK → users.id, NOT NULL |
| integration_id | String | FK → integrations.id, NOT NULL |
| granted_by | String | FK → users.id, NOT NULL |
| created_at | DateTime | UTC default |
| | | UNIQUE(user_id, integration_id) |

### No Changes to Existing Tables

`User.role` column already accepts any string value.

### Access Logic

- **`user` role:** Only see integrations where a matching `user_integration_access` row exists
- **`manager` and `admin` roles:** See all integrations, no filtering

Applies to:
- `GET /api/integrations` — filter returned list
- `POST /api/chat/{integration_id}/send` — verify access before sending

## API Changes

### New Dependency

`require_manager_or_admin` — accepts `manager` or `admin` role, returns 403 otherwise.

### New Manager Endpoints (`/api/manager/*`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/manager/users` | GET | manager_or_admin | List non-admin users |
| `/api/manager/users` | POST | manager_or_admin | Create user/manager (not admin) |
| `/api/manager/users/{id}` | PUT | manager_or_admin | Update user/manager role or password |
| `/api/manager/users/{id}` | DELETE | manager_or_admin | Delete user/manager |
| `/api/manager/users/{id}/access` | GET | manager_or_admin | List user's integration access |
| `/api/manager/users/{id}/access` | PUT | manager_or_admin | Replace user's integration access. Body: `{integration_ids: [str]}` |

**Request/Response Schemas:**

```
GET /api/manager/users
  Response: [{ id: str, username: str, role: str }]
  // Returns users with role "user" or "manager" only (excludes admins)

POST /api/manager/users
  Request: { username: str, password: str, role: str }  // role must be "user" or "manager"
  Response: { id, username, role }
  Errors: 403 if role="admin", 409 if username exists

PUT /api/manager/users/{id}
  Request: { role?: str, password?: str }  // role must be "user" or "manager"
  Response: { id, username, role }
  Errors: 403 if target is admin, setting role to admin, or targeting self for role change
          404 if user not found

DELETE /api/manager/users/{id}
  Response: 204
  Errors: 403 if target is admin or targeting self
          404 if user not found

GET /api/manager/users/{id}/access
  Response: [{ id, integration_id, integration_name }]
  // Requires a join to integrations table for integration_name

PUT /api/manager/users/{id}/access
  Request: { integration_ids: [str] }
  Response: [{ id, integration_id, integration_name }]
  // Replaces all access rows for this user
  // granted_by is set to the calling manager/admin's user ID
  Errors: 422 if any integration_id does not exist (lists invalid IDs)
          404 if user not found
```

### Modified Existing Endpoints

| Endpoint | Change |
|---|---|
| `GET /api/integrations` | Filter by `user_integration_access` for user role |
| `POST /api/chat/{integration_id}/send` | Check access for user role, 403 if denied |

### Unchanged Endpoints

- `POST/PUT/DELETE /api/admin/users` — remain admin-only, can manage all roles
- `POST/PUT/DELETE /api/integrations` — remain admin-only

### Cascade Behavior

Implemented via **explicit pre-delete queries** (not FK ON DELETE CASCADE), since the codebase does not enable `PRAGMA foreign_keys=ON` for SQLite.

- **Deleting an integration** (`integrations/router.py`): execute `DELETE FROM user_integration_access WHERE integration_id = ?` before deleting the integration row
- **Deleting a user** (`admin/router.py`, `manager/router.py`): execute `DELETE FROM user_integration_access WHERE user_id = ?` before deleting the user row

## Frontend Changes

### New Page — `ManagerPage.tsx`

Accessible by `manager` and `admin` roles. Two sections:

1. **User Management** — CRUD table for user/manager accounts (role dropdown limited to user/manager)
2. **Integration Access** — select a user, checkbox list of all integrations, save button

Client-side role guard: if `user.role` is `"user"`, redirect to `/chat` (same pattern as `AdminPage.tsx`).

### New Components

| Component | Responsibility |
|---|---|
| `ManagerPanel.tsx` | User CRUD table (create user/manager, toggle role, reset password, delete) |
| `UserAccessEditor.tsx` | Checkbox list of integrations per user, save to `/api/manager/users/{id}/access` |

### New API Module — `api/manager.ts`

- User CRUD: `listManagerUsersApi`, `createManagerUserApi`, `updateManagerUserApi`, `deleteManagerUserApi`
- Access: `getUserAccessApi`, `setUserAccessApi`

### Layout Changes

| Component | Change |
|---|---|
| `Layout.tsx` | Show "Manager" button for manager role; show both "Manager" and "Admin" for admin |
| `App.tsx` | Add `/manager` route, guarded by auth + client-side role redirect |

### Modified Existing Components

| Component | Change |
|---|---|
| `UserManagement.tsx` | Update "Toggle Role" to cycle through user → manager → admin (three-way) instead of binary toggle |

### No Change Needed

- `IntegrationList.tsx` — already calls `GET /api/integrations`, backend handles filtering
- `ChatWindow.tsx` — backend returns 403 if no access, frontend shows error

## Edge Cases

- **New users with `user` role:** See zero integrations until manager/admin grants access (deny-by-default)
- **Manager targets themselves:** Cannot change own role or delete themselves (server rejects with 403)
- **Manager targets admin:** 403 on any write operation
- **Access set to empty list:** User sees no integrations (valid state)
- **Invalid integration IDs in access update:** 422 with list of invalid IDs
- **Admin bootstrap:** Unchanged — first-run admin created from env vars
