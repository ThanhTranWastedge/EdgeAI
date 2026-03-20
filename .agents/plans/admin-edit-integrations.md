# Feature: Admin Edit Existing Integrations

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Allow admins to modify existing integrations from the Admin page. Currently, integration cards only show a Delete button. This adds an inline Edit form that expands when clicked, letting the admin update name, provider_config, and opening_greeting — then save changes via the existing `PUT /api/integrations/{id}` endpoint.

## User Story

As an admin
I want to edit existing integrations (name, config, greeting)
So that I can update API keys, endpoints, or settings without deleting and recreating integrations

## Problem Statement

Admins can create and delete integrations, but cannot modify them. Changing an API key or greeting requires deleting the integration (losing user access grants) and recreating it.

## Solution Statement

Add an inline edit form to each integration card in AdminPanel. Clicking "Edit" expands the card to show editable fields pre-filled with current values. The backend PUT endpoint and frontend API client already exist — this is a **frontend-only** change to `AdminPanel.tsx`.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Low
**Primary Systems Affected**: `frontend/src/components/AdminPanel.tsx` (sole file to modify)
**Dependencies**: None — backend endpoint and frontend API client already exist

---

## CONTEXT REFERENCES

### Relevant Codebase Files — YOU MUST READ THESE BEFORE IMPLEMENTING

- `frontend/src/components/AdminPanel.tsx` (lines 1-62) - **THE file to modify.** Contains the integration list with create form and delete button. Each integration card is rendered at lines 48-58.
- `frontend/src/api/integrations.ts` (lines 18-19) - `updateIntegrationApi(id, data)` already exists. Import it.
- `frontend/src/styles.ts` (lines 1-20) - Shared style constants: `inputCls`, `selectCls`, `btnPrimaryCls`, `btnDangerCls`, `btnSecondaryCls`. Use `btnSecondaryCls` for the Edit button.
- `backend/app/integrations/schemas.py` (lines 14-19) - `IntegrationUpdate` schema: all fields optional (`name`, `provider_config`, `description`, `icon`, `opening_greeting`). Only non-None fields are updated.
- `backend/app/integrations/router.py` (lines 53-79) - PUT endpoint. Confirms partial update behavior.
- `backend/tests/test_integrations.py` (lines 83-97, 126-142) - Existing update tests confirm the API works.

### New Files to Create

None. This is a single-file frontend change.

### Patterns to Follow

**Integration card pattern** (current, `AdminPanel.tsx:48-58`):
```tsx
<div key={i.id} className="flex items-center justify-between p-3 bg-amcs-grey-50 rounded-lg border border-amcs-grey-100">
  <div>
    <span className="text-sm text-amcs-black">{i.name}</span>
    <span className="text-xs text-amcs-grey-300 ml-2">{i.provider_type}</span>
  </div>
  <button onClick={...} className={btnDangerCls}>Delete</button>
</div>
```

**Button style constants** (`styles.ts`):
- `btnPrimaryCls` — green, rounded-full, for primary actions (Save)
- `btnDangerCls` — red outline, small, for destructive actions (Delete)
- `btnSecondaryCls` — black outline, small, for secondary actions (Edit, Cancel)

**API call pattern** (matches create handler at `AdminPanel.tsx:15-33`):
- Parse JSON config with try/catch, alert on invalid JSON
- Call API, reload list on success, alert on error

### Critical Design Decision: provider_config Security

`IntegrationResponse` does NOT include `provider_config` (API keys are secrets). When editing:
- Pre-fill `name` and `opening_greeting` from existing integration data
- Show config field **empty** with placeholder: `"Leave empty to keep current config"`
- Only include `provider_config` in the update payload if the admin actually typed something
- This works because the backend's `IntegrationUpdate` only updates non-None fields

---

## IMPLEMENTATION PLAN

### Phase 1: Core Implementation

Add edit state and inline edit form to `AdminPanel.tsx`. Single file, single phase.

### Phase 2: Testing & Validation

Run existing backend tests (already cover PUT endpoint) + manual UI testing + frontend build check.

---

## STEP-BY-STEP TASKS

### UPDATE `frontend/src/components/AdminPanel.tsx`

**Step 1: Add import for `updateIntegrationApi`**

- **IMPLEMENT**: Add `updateIntegrationApi` to the import from `../api/integrations` (line 2)
- **VALIDATE**: `npm run build` in frontend dir (no import errors)

**Step 2: Add edit state**

- **IMPLEMENT**: Add state for tracking which integration is being edited and its form values:
  ```tsx
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editConfigJson, setEditConfigJson] = useState('')
  const [editGreeting, setEditGreeting] = useState('')
  ```
- **PATTERN**: Follows existing state pattern at lines 6-10 (same naming convention: `[fieldName, setFieldName]`)

**Step 3: Add `startEdit` helper**

- **IMPLEMENT**: When admin clicks Edit, populate form state from the integration's current values:
  ```tsx
  const startEdit = (i: Integration) => {
    setEditingId(i.id)
    setEditName(i.name)
    setEditConfigJson('')  // empty — secrets not returned by API
    setEditGreeting(i.opening_greeting || '')
  }
  ```

**Step 4: Add `handleUpdate` handler**

- **IMPLEMENT**: Save handler that calls `updateIntegrationApi` with only changed fields:
  ```tsx
  const handleUpdate = async () => {
    if (!editingId) return
    const payload: Record<string, unknown> = { name: editName }
    if (editConfigJson.trim()) {
      try {
        payload.provider_config = JSON.parse(editConfigJson)
      } catch {
        alert('Invalid JSON config')
        return
      }
    }
    if (editGreeting !== undefined) payload.opening_greeting = editGreeting || null
    try {
      await updateIntegrationApi(editingId, payload)
      setEditingId(null)
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update integration'
      alert(msg)
    }
  }
  ```
- **PATTERN**: Mirrors `handleCreate` at lines 15-33 (same JSON parse + try/catch + alert pattern)

**Step 5: Update integration card rendering**

- **IMPLEMENT**: Replace the static card with a conditional: if `editingId === i.id`, render an inline edit form; otherwise render the current read-only card with an added Edit button.

**Collapsed (read-only) state — add Edit button next to Delete:**
```tsx
<div className="flex gap-2">
  <button onClick={() => startEdit(i)} className={btnSecondaryCls}>Edit</button>
  <button onClick={async () => { if (confirm('Delete integration?')) { await deleteIntegrationApi(i.id); load() } }} className={btnDangerCls}>Delete</button>
</div>
```
- **IMPORTS**: Add `btnSecondaryCls` to the import from `../styles` (line 3)

**Expanded (editing) state — inline form below the card header:**
```tsx
<div key={i.id} className="p-3 bg-amcs-grey-50 rounded-lg border border-amcs-primary/30">
  <div className="flex items-center justify-between mb-3">
    <div>
      <span className="text-sm font-medium text-amcs-black">{i.name}</span>
      <span className="text-xs text-amcs-grey-300 ml-2">{i.provider_type}</span>
    </div>
    <div className="flex gap-2">
      <button onClick={() => setEditingId(null)} className={btnSecondaryCls}>Cancel</button>
      <button onClick={async () => { if (confirm('Delete integration?')) { await deleteIntegrationApi(i.id); setEditingId(null); load() } }} className={btnDangerCls}>Delete</button>
    </div>
  </div>
  <div className="flex flex-col gap-2">
    <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" className={inputCls} />
    <textarea value={editConfigJson} onChange={(e) => setEditConfigJson(e.target.value)} placeholder="Leave empty to keep current config" rows={2} className={`${inputCls} font-mono`} />
    <textarea value={editGreeting} onChange={(e) => setEditGreeting(e.target.value)} placeholder="Opening Greeting (optional, supports Markdown)" rows={3} className={inputCls} />
    <button onClick={handleUpdate} className={`${btnPrimaryCls} self-end`}>Save Changes</button>
  </div>
</div>
```
- **GOTCHA**: The expanded card should use `border-amcs-primary/30` to visually distinguish it from collapsed cards (which use `border-amcs-grey-100`).
- **VALIDATE**: `npm run build` (no TS errors), then manual test in browser

---

## TESTING STRATEGY

### Backend Tests (already exist)

The PUT endpoint is already tested:
- `test_update_integration` (line 83) — update name
- `test_update_integration_greeting` (line 126) — update greeting

Run to confirm no regressions:
```bash
cd backend && SECRET_KEY=test python -m pytest tests/test_integrations.py -v
```

### Manual Frontend Testing

1. Log in as admin
2. Verify existing integrations show both Edit and Delete buttons
3. Click Edit — verify card expands with pre-filled name and greeting, empty config
4. Modify name, click Save — verify name updates in the list
5. Click Edit, enter new config JSON, click Save — verify no error (config updated)
6. Click Edit, enter invalid JSON in config, click Save — verify alert shows
7. Click Cancel — verify form collapses without changes
8. Click Delete while editing — verify deletion still works
9. Verify only one integration can be edited at a time (clicking Edit on another auto-switches)

---

## VALIDATION COMMANDS

### Level 1: Build Check

```bash
cd /home/thanh-tran/EdgeAI/frontend && npm run build
```

### Level 2: Lint

```bash
cd /home/thanh-tran/EdgeAI/frontend && npm run lint
```

### Level 3: Backend Tests (regression)

```bash
cd /home/thanh-tran/EdgeAI/backend && SECRET_KEY=test python -m pytest tests/test_integrations.py -v
```

### Level 4: Manual UI Validation

Start dev servers and test in browser:
```bash
cd /home/thanh-tran/EdgeAI/backend && SECRET_KEY=test uvicorn app.main:app --reload &
cd /home/thanh-tran/EdgeAI/frontend && npm run dev
```

---

## ACCEPTANCE CRITERIA

- [ ] Each integration card shows an "Edit" button alongside the existing "Delete" button
- [ ] Clicking Edit expands the card into an inline form with name, config, and greeting fields
- [ ] Name and greeting are pre-filled from current values; config is empty (secrets not exposed)
- [ ] Saving with valid data calls PUT endpoint and updates the list
- [ ] Saving with invalid JSON config shows an error alert
- [ ] Cancel collapses the form without changes
- [ ] Delete still works both in collapsed and expanded states
- [ ] `npm run build` passes with no errors
- [ ] `npm run lint` passes with no errors
- [ ] Existing backend integration tests still pass

---

## COMPLETION CHECKLIST

- [ ] AdminPanel.tsx updated with edit functionality
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Backend tests pass (no regression)
- [ ] Manual browser testing confirms all acceptance criteria

---

## NOTES

- **Frontend-only change**: Backend PUT endpoint and frontend API client already exist. Only `AdminPanel.tsx` needs modification.
- **Security**: `provider_config` is intentionally not returned by the API. The edit form shows an empty config field — admins only send new config if they type something. This preserves the existing security model.
- **provider_type is not editable**: Changing provider type would break existing sessions. It's shown as read-only text in the expanded form.
- **No new dependencies**: Uses existing style constants, API functions, and React patterns.
