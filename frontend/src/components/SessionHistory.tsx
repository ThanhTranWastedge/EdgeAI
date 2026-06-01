import { useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { getSessionsApi, getSessionApi } from '../api/chat'
import { sidebarSectionLabelCls } from '../styles'

interface Props {
  collapsed: boolean
}

export default function SessionHistory({ collapsed }: Props) {
  const { activeIntegration, sessions, setSessions, setCurrentMessages, isStreaming } = useChatStore()

  useEffect(() => {
    if (activeIntegration) {
      getSessionsApi(activeIntegration.id).then(({ data }) => setSessions(data))
    }
  }, [activeIntegration, setSessions])

  const viewSession = async (sessionId: string) => {
    if (!activeIntegration || isStreaming) return
    const integrationId = activeIntegration.id
    const { data } = await getSessionApi(integrationId, sessionId)
    if (useChatStore.getState().activeIntegration?.id !== integrationId) return
    setCurrentMessages(data.messages, data.id)
  }

  if (!activeIntegration) return null

  if (collapsed) {
    return null // No room to show session titles in collapsed sidebar
  }

  return (
    <div>
      <div className={sidebarSectionLabelCls}>Recent Sessions</div>
      {sessions.map((s) => (
        <div
          key={s.id}
          onClick={() => viewSession(s.id)}
          className={`px-3 py-1 mx-1 rounded text-[11px] text-white transition-colors truncate ${
            isStreaming
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer hover:text-white/80'
          }`}
        >
          {s.title}
        </div>
      ))}
    </div>
  )
}
