import { useEffect, useState } from 'react'
import { listIntegrationsApi, Integration } from '../api/integrations'
import { useChatStore } from '../store/chatStore'

export default function IntegrationList() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const { activeIntegration, setActiveIntegration } = useChatStore()

  useEffect(() => {
    listIntegrationsApi().then(({ data }) => setIntegrations(data))
  }, [])

  return (
    <div style={{ width: 220, background: '#0d1117', borderRight: '1px solid #30363d', padding: 12, overflowY: 'auto' }}>
      <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Integrations</div>
      {integrations.map((i) => (
        <div
          key={i.id}
          onClick={() => setActiveIntegration(i)}
          style={{
            padding: 10,
            background: activeIntegration?.id === i.id ? '#1a2332' : '#161b22',
            border: `1px solid ${activeIntegration?.id === i.id ? '#64ffda' : '#30363d'}`,
            borderRadius: 6,
            marginBottom: 6,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 13, color: activeIntegration?.id === i.id ? '#fff' : '#c9d1d9' }}>
            {i.icon || '\uD83D\uDCAC'} {i.name}
          </div>
          <div style={{ fontSize: 10, color: activeIntegration?.id === i.id ? '#64ffda' : '#8b949e' }}>
            {i.provider_type === 'ragflow' ? 'ragflow' : 'openai'}
          </div>
        </div>
      ))}
    </div>
  )
}
