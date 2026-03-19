import { useEffect, useState } from 'react'
import { Integration, listIntegrationsApi, createIntegrationApi, updateIntegrationApi, deleteIntegrationApi } from '../api/integrations'
import { inputCls, selectCls, btnPrimaryCls, btnDangerCls, btnSecondaryCls } from '../styles'

export default function AdminPanel() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState('ragflow')
  const [configJson, setConfigJson] = useState('{}')
  const [greeting, setGreeting] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editConfigJson, setEditConfigJson] = useState('')
  const [editGreeting, setEditGreeting] = useState('')

  const load = () => listIntegrationsApi().then(({ data }) => setIntegrations(data))
  useEffect(() => { load() }, [])

  const startEdit = (i: Integration) => {
    setEditingId(i.id)
    setEditName(i.name)
    setEditConfigJson('')
    setEditGreeting(i.opening_greeting || '')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete integration?')) return
    await deleteIntegrationApi(id)
    setEditingId(null)
    load()
  }

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
    payload.opening_greeting = editGreeting || null
    try {
      await updateIntegrationApi(editingId, payload)
      setEditingId(null)
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update integration'
      alert(msg)
    }
  }

  const handleCreate = async () => {
    let config: Record<string, unknown>
    try {
      config = JSON.parse(configJson)
    } catch {
      alert('Invalid JSON config')
      return
    }
    try {
      await createIntegrationApi({ name, provider_type: providerType, provider_config: config, opening_greeting: greeting || undefined })
      setName('')
      setConfigJson('{}')
      setGreeting('')
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create integration'
      alert(msg)
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        <select value={providerType} onChange={(e) => setProviderType(e.target.value)} className={selectCls}>
          <option value="ragflow">RAGFlow</option>
          <option value="openai_compatible">OpenAI Compatible</option>
        </select>
        <textarea placeholder='{"base_url":"...","api_key":"..."}' value={configJson} onChange={(e) => setConfigJson(e.target.value)} rows={2} className={`${inputCls} font-mono flex-1 min-w-[300px]`} />
        <textarea placeholder="Opening Greeting (optional, supports Markdown)" value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={3} className={`${inputCls} flex-1 min-w-[200px]`} />
        <button onClick={handleCreate} className={btnPrimaryCls}>Add</button>
      </div>
      <div className="space-y-2">
        {integrations.map((i) => editingId === i.id ? (
          <div key={i.id} className="p-3 bg-amcs-grey-50 rounded-lg border border-amcs-primary/30">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-medium text-amcs-black">{i.name}</span>
                <span className="text-xs text-amcs-grey-300 ml-2">{i.provider_type}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingId(null)} className={btnSecondaryCls}>Cancel</button>
                <button onClick={() => handleDelete(i.id)} className={btnDangerCls}>Delete</button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" className={inputCls} />
              <textarea value={editConfigJson} onChange={(e) => setEditConfigJson(e.target.value)} placeholder="Leave empty to keep current config" rows={2} className={`${inputCls} font-mono`} />
              <textarea value={editGreeting} onChange={(e) => setEditGreeting(e.target.value)} placeholder="Opening Greeting (optional, supports Markdown)" rows={3} className={inputCls} />
              <button onClick={handleUpdate} className={`${btnPrimaryCls} self-end`}>Save Changes</button>
            </div>
          </div>
        ) : (
          <div key={i.id} className="flex items-center justify-between p-3 bg-amcs-grey-50 rounded-lg border border-amcs-grey-100">
            <div>
              <span className="text-sm text-amcs-black">{i.name}</span>
              <span className="text-xs text-amcs-grey-300 ml-2">{i.provider_type}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(i)} className={btnSecondaryCls}>Edit</button>
              <button onClick={() => handleDelete(i.id)} className={btnDangerCls}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
