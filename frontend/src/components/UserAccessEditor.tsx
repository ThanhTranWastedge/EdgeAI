import { useEffect, useState } from 'react'
import { User } from '../api/auth'
import { Integration, listIntegrationsApi } from '../api/integrations'
import { getUserAccessApi, setUserAccessApi } from '../api/manager'
import { selectCls, btnPrimaryCls } from '../styles'

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
      <select
        value={selectedUserId}
        onChange={(e) => setSelectedUserId(e.target.value)}
        className={`${selectCls} mb-4 min-w-[200px]`}
      >
        <option value="">Select a user...</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
        ))}
      </select>

      {selectedUserId && (
        <>
          <div className="mb-3 space-y-1">
            {integrations.length === 0 && <div className="text-sm text-slate-400">No integrations available</div>}
            {integrations.map((i) => (
              <label key={i.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={grantedIds.has(i.id)}
                  onChange={() => toggleIntegration(i.id)}
                  className="rounded border-slate-300 text-sky-500 focus:ring-sky-500/20"
                />
                <span className="text-slate-900">{i.name}</span>
                <span className="text-xs text-slate-400">({i.provider_type})</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${btnPrimaryCls} disabled:opacity-50`}
          >
            {saving ? 'Saving...' : 'Save Access'}
          </button>
        </>
      )}
    </div>
  )
}
