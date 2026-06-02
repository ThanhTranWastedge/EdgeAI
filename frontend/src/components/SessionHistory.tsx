import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useChatStore, resolvePreferredIntegration } from '../store/chatStore'
import { getSessionsApi, getSessionApi } from '../api/chat'
import { sidebarSectionLabelCls } from '../styles'

interface Props {
  collapsed: boolean
}

export default function SessionHistory({ collapsed }: Props) {
  const location = useLocation()
  const { user } = useAuthStore()
  const {
    integrations,
    integrationsLoaded,
    sessions,
    setSessions,
    setCurrentMessages,
    setActiveIntegration,
    isStreaming,
  } = useChatStore()
  const isChatRoute = location.pathname === '/chat'

  useEffect(() => {
    if (isChatRoute) {
      getSessionsApi().then(({ data }) => setSessions(data))
    }
  }, [isChatRoute, setSessions])

  const viewSession = async (sessionId: string) => {
    if (isStreaming || !integrationsLoaded) return

    const { data } = await getSessionApi(sessionId)
    const restoredTarget = data.last_integration_id
      ? integrations.find((integration) => integration.id === data.last_integration_id) ??
        resolvePreferredIntegration(integrations, user?.default_integration_id)
      : resolvePreferredIntegration(integrations, user?.default_integration_id)

    setActiveIntegration(restoredTarget)
    setCurrentMessages(data.messages, data.id)
  }

  if (!isChatRoute || collapsed) {
    return null // No room to show session titles in collapsed sidebar
  }

  return (
    <div>
      <div className={sidebarSectionLabelCls}>Recent Sessions</div>
      {sessions.map((s) => (
        <button
          type="button"
          key={s.id}
          onClick={() => viewSession(s.id)}
          className={`block w-[calc(100%-0.5rem)] px-3 py-1.5 mx-1 rounded text-left transition-colors ${
            isStreaming || !integrationsLoaded
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer hover:text-white/80'
          }`}
        >
          <span className="block truncate text-[11px] text-white">{s.title}</span>
          {s.last_integration_name && (
            <span className="block truncate text-[10px] text-white/35">
              {s.last_integration_name}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
