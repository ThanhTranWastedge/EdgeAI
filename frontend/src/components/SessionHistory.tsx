import { useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { getSessionsApi, getSessionApi } from '../api/chat'

interface Props {
  collapsed: boolean
}

export default function SessionHistory({ collapsed }: Props) {
  const { activeIntegration, sessions, setSessions, setCurrentMessages } = useChatStore()

  useEffect(() => {
    if (activeIntegration) {
      getSessionsApi(activeIntegration.id).then(({ data }) => setSessions(data))
    }
  }, [activeIntegration])

  const viewSession = async (sessionId: string) => {
    if (!activeIntegration) return
    const { data } = await getSessionApi(activeIntegration.id, sessionId)
    setCurrentMessages(data.messages)
  }

  if (!activeIntegration) return null

  if (collapsed) {
    return null // No room to show session titles in collapsed sidebar
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[1.2px] text-white/[0.35] px-3 pt-3 pb-1">
        Recent Sessions
      </div>
      {sessions.map((s) => (
        <div
          key={s.id}
          onClick={() => viewSession(s.id)}
          className="px-3 py-1 mx-1 rounded text-[11px] text-white/45 cursor-pointer hover:text-white/65 transition-colors truncate"
        >
          {s.title.slice(0, 40)}{s.title.length > 40 ? '...' : ''}
        </div>
      ))}
    </div>
  )
}
