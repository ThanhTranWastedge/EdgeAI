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
    <div className="p-3 overflow-y-auto">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 px-2">
        Integrations
      </div>
      {integrations.map((i) => {
        const isActive = activeIntegration?.id === i.id
        return (
          <div
            key={i.id}
            onClick={() => setActiveIntegration(i)}
            className={`px-3 py-2 rounded-lg mb-1 cursor-pointer text-sm transition-colors
              ${isActive
                ? 'bg-sky-50 text-sky-600 font-medium'
                : 'text-slate-700 hover:bg-slate-50'
              }`}
          >
            {i.icon || '\uD83D\uDCAC'} {i.name}
          </div>
        )
      })}
    </div>
  )
}
