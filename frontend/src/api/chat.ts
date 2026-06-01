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

export const sendMessageApi = (
  integrationId: string,
  message: string,
  pinnedIds?: string[],
  sessionId?: string | null,
) =>
  client.post<SendResponse>(`/chat/${integrationId}/send`, {
    message,
    pinned_ids: pinnedIds,
    stream: false,
    session_id: sessionId || undefined,
  })

export const sendMessageStreamApi = async (
  integrationId: string,
  message: string,
  pinnedIds: string[] | undefined,
  sessionId: string | null | undefined,
  onChunk: (text: string) => void,
  onDone: (refs: unknown, sessionId: string | null) => void | Promise<void>,
  onError: (error: string) => void,
) => {
  const token = localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`/api/chat/${integrationId}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      pinned_ids: pinnedIds,
      stream: true,
      session_id: sessionId || undefined,
    }),
  })

  if (!response.ok) {
    onError('Failed to connect to chat provider')
    return
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  if (!reader) return

  let buffer = ''
  let currentEvent = ''
  let dataLines: string[] = []

  const flushEvent = async () => {
    if (dataLines.length === 0) return
    const data = dataLines.join('\n')
    dataLines = []

    if (currentEvent === 'done' || currentEvent === 'error') {
      try {
        const meta = JSON.parse(data)
        if (currentEvent === 'done') {
          await onDone(meta.references, meta.session_id || null)
        }
        if (currentEvent === 'error' && meta.detail) {
          onError(meta.detail)
        }
      } catch {
        // ignore malformed metadata
      }
    } else {
      onChunk(data)
    }
    currentEvent = ''
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      await flushEvent()
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const rawLine of lines) {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
      if (line.startsWith('event: ')) {
        await flushEvent()
        currentEvent = line.slice(7)
      } else if (line.startsWith('data: ')) {
        dataLines.push(line.slice(6))
      } else if (line === '') {
        await flushEvent()
      }
    }
  }
}

export const getSessionsApi = (integrationId: string) =>
  client.get<SessionData[]>(`/chat/${integrationId}/sessions`)

export const getSessionApi = (integrationId: string, sessionId: string) =>
  client.get<SessionDetail>(`/chat/${integrationId}/sessions/${sessionId}`)
