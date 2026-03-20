import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { listIntegrationsApi, Integration } from '../api/integrations'
import { useChatStore } from '../store/chatStore'
import { sidebarSectionLabelCls } from '../styles'

interface Props {
  collapsed: boolean
}

export default function IntegrationList({ collapsed }: Props) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const { activeIntegration, setActiveIntegration } = useChatStore()
  const navigate = useNavigate()
  const location = useLocation()

  const selectIntegration = (i: Integration) => {
    setActiveIntegration(i)
    if (location.pathname !== '/chat') {
      navigate('/chat')
    }
  }

  useEffect(() => {
    listIntegrationsApi().then(({ data }) => setIntegrations(data))
  }, [])

  return (
    <div>
      {!collapsed && (
        <div className={sidebarSectionLabelCls}>Integrations</div>
      )}
      {integrations.map((i) => {
        const isActive = activeIntegration?.id === i.id
        const avatar = (
          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${isActive ? 'bg-we-accent/20 text-we-accent' : 'bg-white/10 text-white/60'}`}>
            {i.name.charAt(0).toUpperCase()}
          </span>
        )
        if (collapsed) {
          return (
            <div
              key={i.id}
              onClick={() => selectIntegration(i)}
              className="flex justify-center py-1.5 cursor-pointer"
              title={i.name}
            >
              {avatar}
            </div>
          )
        }
        return (
          <div
            key={i.id}
            onClick={() => selectIntegration(i)}
            className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded-lg cursor-pointer text-xs transition-colors
              ${isActive
                ? 'bg-we-accent/12 text-we-accent'
                : 'text-white/55 hover:text-white/75'
              }`}
          >
            {avatar}
            {i.name}
          </div>
        )
      })}
    </div>
  )
}
