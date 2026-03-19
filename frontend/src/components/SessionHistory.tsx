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
    <div className="p-3 border-t border-slate-200 overflow-y-auto flex-1">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 px-2">
        Recent Sessions
      </div>
      {sessions.length === 0 && (
        <div className="text-xs text-slate-400 px-2">No sessions yet</div>
      )}
      {sessions.map((s) => (
        <div
          key={s.id}
          onClick={() => viewSession(s.id)}
          className="px-2 py-1.5 rounded text-xs text-slate-500 cursor-pointer hover:bg-slate-50 mb-0.5 transition-colors"
        >
          <span className="text-slate-700">
            {s.title.slice(0, 40)}{s.title.length > 40 ? '...' : ''}
          </span>
          <span className="text-slate-400 text-[10px] ml-1">
            {new Date(s.created_at).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  )
}
