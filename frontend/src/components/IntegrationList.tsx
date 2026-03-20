import { useEffect, useState } from 'react'
import { listIntegrationsApi, Integration } from '../api/integrations'
import { useChatStore } from '../store/chatStore'

interface Props {
  collapsed: boolean
}

export default function IntegrationList({ collapsed }: Props) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const { activeIntegration, setActiveIntegration } = useChatStore()

  useEffect(() => {
    listIntegrationsApi().then(({ data }) => setIntegrations(data))
  }, [])

  return (
    <div>
      {!collapsed && (
        <div className="text-[10px] uppercase tracking-[1.2px] text-white/[0.35] px-3 pt-3 pb-1">
          Integrations
        </div>
      )}
      {integrations.map((i) => {
        const isActive = activeIntegration?.id === i.id
        if (collapsed) {
          return (
            <div
              key={i.id}
              onClick={() => setActiveIntegration(i)}
              className="flex justify-center py-1.5 cursor-pointer"
              title={i.name}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-we-accent' : 'bg-white/25'}`} />
            </div>
          )
        }
        return (
          <div
            key={i.id}
            onClick={() => setActiveIntegration(i)}
            className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded-lg cursor-pointer text-xs transition-colors
              ${isActive
                ? 'bg-[rgba(79,175,48,0.12)] text-we-accent'
                : 'text-white/55 hover:text-white/75'
              }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-we-accent' : 'bg-white/25'}`} />
            {i.name}
          </div>
        )
      })}
    </div>
  )
}
