import { useEffect, useState } from 'react'
import { Integration, listIntegrationsApi } from '../api/integrations'
import { createIntegrationApi, deleteIntegrationApi } from '../api/admin'

export default function AdminPanel() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState('ragflow')
  const [configJson, setConfigJson] = useState('{}')

  const load = () => listIntegrationsApi().then(({ data }) => setIntegrations(data))
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      const config = JSON.parse(configJson)
      await createIntegrationApi({ name, provider_type: providerType, provider_config: config })
      setName('')
      setConfigJson('{}')
      load()
    } catch {
      alert('Invalid JSON config')
    }
  }

  return (
    <div>
      <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>Integrations</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0' }} />
        <select value={providerType} onChange={(e) => setProviderType(e.target.value)} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0' }}>
          <option value="ragflow">RAGFlow</option>
          <option value="openai_compatible">OpenAI Compatible</option>
        </select>
        <textarea placeholder='{"base_url":"...","api_key":"..."}' value={configJson} onChange={(e) => setConfigJson(e.target.value)} rows={2} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0', flex: 1, minWidth: 300, fontFamily: 'monospace', fontSize: 12 }} />
        <button onClick={handleCreate} style={{ padding: '8px 16px', background: '#64ffda', color: '#0d1117', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add</button>
      </div>
      {integrations.map((i) => (
        <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#161b22', border: '1px solid #30363d', borderRadius: 6, marginBottom: 8 }}>
          <div>
            <span style={{ color: '#e0e0e0' }}>{i.name}</span>
            <span style={{ fontSize: 10, color: '#8b949e', marginLeft: 8 }}>{i.provider_type}</span>
          </div>
          <button onClick={async () => { if (confirm('Delete integration?')) { await deleteIntegrationApi(i.id); load() } }} style={{ padding: '4px 8px', background: '#21262d', border: '1px solid #cf6679', borderRadius: 4, color: '#cf6679', cursor: 'pointer', fontSize: 11 }}>Delete</button>
        </div>
      ))}
    </div>
  )
}
