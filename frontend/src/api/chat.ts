import client, { TOKEN_KEY } from './client'

export interface MessageData {
  id: string
  role: string
  content: string
  references: string | null
  pinned: boolean
  sequence: number
  integration_id: string | null
  integration_name: string | null
}

export interface SessionData {
  id: string
  integration_id: string
  integration_name: string | null
  last_integration_id: string | null
  last_integration_name: string | null
  title: string
  created_at: string
}

export interface SessionDetail {
  id: string
  integration_id: string
  integration_name: string | null
  last_integration_id: string | null
  last_integration_name: string | null
  title: string
  messages: MessageData[]
}

export interface SendResponse {
  session_id: string
  assistant_message: MessageData
}

const formatErrorDetail = (detail: unknown): string | null => {
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    try {
      return JSON.stringify(detail)
    } catch {
      return null
    }
  }

  return null
}

const getResponseErrorMessage = async (response: Response) => {
  try {
    const text = await response.text()
    if (!text) return `Chat request failed (${response.status})`

    try {
      const body: unknown = JSON.parse(text)
      if (body && typeof body === 'object' && 'detail' in body) {
        const detail = formatErrorDetail((body as { detail?: unknown }).detail)
        if (detail) return detail
      }
    } catch {
      return text
    }

    return text
  } catch {
    // fall through to status-based message
  }

  return `Chat request failed (${response.status})`
}

export const sendMessageApi = (
  integrationId: string,
  message: string,
  pinnedIds?: string[],
  sessionId?: string | null,
) => {
  const url = sessionId ? `/chat/sessions/${sessionId}/send` : '/chat/send'
  return client.post<SendResponse>(url, {
    integration_id: integrationId,
    message,
    pinned_ids: pinnedIds,
    stream: false,
  })
}

export const sendMessageStreamApi = async (
  integrationId: string,
  message: string,
  pinnedIds: string[] | undefined,
  sessionId: string | null | undefined,
  onChunk: (text: string) => void,
  onDone: (refs: unknown, sessionId: string | null) => void | Promise<void>,
  onError: (error: string, sessionId: string | null) => void | Promise<void>,
) => {
  const token = localStorage.getItem(TOKEN_KEY)
  const url = sessionId ? `/api/chat/sessions/${sessionId}/send` : '/api/chat/send'
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      integration_id: integrationId,
      message,
      pinned_ids: pinnedIds,
      stream: true,
    }),
  })

  if (!response.ok) {
    await onError(await getResponseErrorMessage(response), null)
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
      let meta: { references?: unknown; session_id?: string; detail?: string }
      try {
        meta = JSON.parse(data)
      } catch {
        // ignore malformed metadata
        currentEvent = ''
        return
      }

      if (currentEvent === 'done') {
        await onDone(meta.references, meta.session_id || null)
      }
      if (currentEvent === 'error' && meta.detail) {
        await onError(meta.detail, meta.session_id || null)
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

export const getSessionsApi = () =>
  client.get<SessionData[]>('/chat/sessions')

export const getSessionApi = (sessionId: string) =>
  client.get<SessionDetail>(`/chat/sessions/${sessionId}`)

export const getIntegrationSessionsApi = (integrationId: string) =>
  client.get<SessionData[]>(`/chat/${integrationId}/sessions`)

export const getIntegrationSessionApi = (integrationId: string, sessionId: string) =>
  client.get<SessionDetail>(`/chat/${integrationId}/sessions/${sessionId}`)
