import { useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { getSessionsApi, getSessionApi } from '../api/chat'

export default function SessionHistory() {
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

  return (
    <div style={{ padding: 12, borderTop: '1px solid #30363d', overflowY: 'auto', flex: 1 }}>
      <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Recent Sessions</div>
      {sessions.length === 0 && <div style={{ fontSize: 12, color: '#484f58' }}>No sessions yet</div>}
      {sessions.map((s) => (
        <div
          key={s.id}
          onClick={() => viewSession(s.id)}
          style={{ padding: 8, borderRadius: 4, marginBottom: 4, cursor: 'pointer', color: '#8b949e', fontSize: 12 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#161b22')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {s.title.slice(0, 40)}{s.title.length > 40 ? '...' : ''}
          <span style={{ color: '#484f58', fontSize: 10, marginLeft: 4 }}>
            {new Date(s.created_at).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  )
}
