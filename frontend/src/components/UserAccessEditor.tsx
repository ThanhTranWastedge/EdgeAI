import { useEffect, useState } from 'react'
import { User } from '../api/auth'
import { Integration, listIntegrationsApi } from '../api/integrations'
import { getUserAccessApi, setUserAccessApi } from '../api/manager'

interface Props {
  users: User[]
}

export default function UserAccessEditor({ users }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [grantedIds, setGrantedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listIntegrationsApi().then(({ data }) => setIntegrations(data))
  }, [])

  useEffect(() => {
    if (!selectedUserId) {
      setGrantedIds(new Set())
      return
    }
    getUserAccessApi(selectedUserId).then(({ data }) => {
      setGrantedIds(new Set(data.map((a) => a.integration_id)))
    })
  }, [selectedUserId])

  const toggleIntegration = (id: string) => {
    setGrantedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    if (!selectedUserId) return
    setSaving(true)
    await setUserAccessApi(selectedUserId, Array.from(grantedIds))
    setSaving(false)
  }

  return (
    <div>
      <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>Integration Access</h3>
      <select
        value={selectedUserId}
        onChange={(e) => setSelectedUserId(e.target.value)}
        style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0', marginBottom: 16, minWidth: 200 }}
      >
        <option value="">Select a user...</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
        ))}
      </select>

      {selectedUserId && (
        <>
          <div style={{ marginBottom: 12 }}>
            {integrations.length === 0 && <div style={{ color: '#8b949e' }}>No integrations available</div>}
            {integrations.map((i) => (
              <label key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={grantedIds.has(i.id)}
                  onChange={() => toggleIntegration(i.id)}
                />
                <span>{i.name}</span>
                <span style={{ color: '#8b949e', fontSize: 11 }}>({i.provider_type})</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 16px', background: '#64ffda', color: '#0d1117', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            {saving ? 'Saving...' : 'Save Access'}
          </button>
        </>
      )}
    </div>
  )
}
