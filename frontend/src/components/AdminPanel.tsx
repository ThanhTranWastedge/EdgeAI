import { useEffect, useState } from 'react'
import { Integration, listIntegrationsApi, createIntegrationApi, deleteIntegrationApi } from '../api/integrations'

export default function AdminPanel() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState('ragflow')
  const [configJson, setConfigJson] = useState('{}')
  const [greeting, setGreeting] = useState('')

  const load = () => listIntegrationsApi().then(({ data }) => setIntegrations(data))
  useEffect(() => { load() }, [])

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
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
        <select value={providerType} onChange={(e) => setProviderType(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer">
          <option value="ragflow">RAGFlow</option>
          <option value="openai_compatible">OpenAI Compatible</option>
        </select>
        <textarea placeholder='{"base_url":"...","api_key":"..."}' value={configJson} onChange={(e) => setConfigJson(e.target.value)} rows={2} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-mono flex-1 min-w-[300px] transition-colors" />
        <input placeholder="Opening Greeting (optional)" value={greeting} onChange={(e) => setGreeting(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 flex-1 min-w-[200px] transition-colors" />
        <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors cursor-pointer">Add</button>
      </div>
      <div className="space-y-2">
        {integrations.map((i) => (
          <div key={i.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <span className="text-sm text-slate-900">{i.name}</span>
              <span className="text-xs text-slate-400 ml-2">{i.provider_type}</span>
            </div>
            <button onClick={async () => { if (confirm('Delete integration?')) { await deleteIntegrationApi(i.id); load() } }} className="px-3 py-1 rounded-lg text-xs text-red-500 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
