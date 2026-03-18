import client, { TOKEN_KEY } from './client'

export interface MessageData {
  id: string
  role: string
  content: string
  references: string | null
  pinned: boolean
  sequence: number
}

export interface SessionData {
  id: string
  integration_id: string
  title: string
  created_at: string
}

export interface SessionDetail {
  id: string
  integration_id: string
  title: string
  messages: MessageData[]
}

export interface SendResponse {
  session_id: string
  assistant_message: MessageData
}

export const sendMessageApi = (integrationId: string, message: string, pinnedIds?: string[]) =>
  client.post<SendResponse>(`/chat/${integrationId}/send`, { message, pinned_ids: pinnedIds, stream: false })

export const sendMessageStreamApi = async (
  integrationId: string,
  message: string,
  pinnedIds: string[] | undefined,
  onChunk: (text: string) => void,
  onDone: (refs: unknown, sessionId: string | null) => void,
  onError: (error: string) => void,
) => {
  const token = localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`/api/chat/${integrationId}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message, pinned_ids: pinnedIds, stream: true }),
  })

  if (!response.ok) {
    onError('Failed to connect to chat provider')
    return
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  if (!reader) return

  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        onChunk(line.slice(6))
      } else if (line.startsWith('event: done')) {
        // Next data line has metadata
      } else if (line.startsWith('event: error')) {
        // Next data line has error
      }
      // Parse "data:" after "event: done"
      if (line.startsWith('data: {')) {
        try {
          const meta = JSON.parse(line.slice(6))
          if (meta.references !== undefined) {
            onDone(meta.references, meta.provider_session_id)
          }
          if (meta.detail) {
            onError(meta.detail)
          }
        } catch {
          // plain text chunk, already handled
        }
      }
    }
  }
}

export const getSessionsApi = (integrationId: string) =>
  client.get<SessionData[]>(`/chat/${integrationId}/sessions`)

export const getSessionApi = (integrationId: string, sessionId: string) =>
  client.get<SessionDetail>(`/chat/${integrationId}/sessions/${sessionId}`)
