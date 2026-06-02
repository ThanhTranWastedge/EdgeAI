import { create } from 'zustand'
import { Integration } from '../api/integrations'
import { MessageData, SessionData } from '../api/chat'

export const resolvePreferredIntegration = (
  integrations: Integration[],
  preferredIntegrationId?: string | null,
) => {
  if (preferredIntegrationId) {
    const preferred = integrations.find((integration) => integration.id === preferredIntegrationId)
    if (preferred) return preferred
  }

  return integrations[0] ?? null
}

interface ChatState {
  integrations: Integration[]
  integrationsLoaded: boolean
  activeIntegration: Integration | null
  activeSessionId: string | null
  sessions: SessionData[]
  currentMessages: MessageData[]
  isStreaming: boolean
  setIntegrations: (integrations: Integration[]) => void
  setIntegrationsLoaded: (loaded: boolean) => void
  setActiveIntegration: (integration: Integration | null) => void
  setActiveSessionId: (sessionId: string | null) => void
  setSessions: (sessions: SessionData[]) => void
  setCurrentMessages: (messages: MessageData[], sessionId?: string | null) => void
  addMessage: (message: MessageData) => void
  removeMessages: (messageIds: string[]) => void
  updateMessageContent: (messageId: string, updater: (prevContent: string) => string) => void
  setStreaming: (streaming: boolean) => void
  startNewChat: (integration?: Integration | null) => void
}

export const useChatStore = create<ChatState>((set) => ({
  integrations: [],
  integrationsLoaded: false,
  activeIntegration: null,
  activeSessionId: null,
  sessions: [],
  currentMessages: [],
  isStreaming: false,

  setIntegrations: (integrations) => set({ integrations }),
  setIntegrationsLoaded: (loaded) => set({ integrationsLoaded: loaded }),
  setActiveIntegration: (integration) => set({
    activeIntegration: integration,
  }),
  setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentMessages: (messages, sessionId = null) => set({
    currentMessages: messages,
    activeSessionId: sessionId,
  }),
  addMessage: (message) => set((state) => ({ currentMessages: [...state.currentMessages, message] })),
  removeMessages: (messageIds) => set((state) => ({
    currentMessages: state.currentMessages.filter((message) => !messageIds.includes(message.id)),
  })),
  updateMessageContent: (messageId, updater) => set((state) => {
    const messageIndex = state.currentMessages.findIndex((message) => message.id === messageId)
    if (messageIndex === -1) return state

    const currentMessages = [...state.currentMessages]
    const message = currentMessages[messageIndex]
    currentMessages[messageIndex] = { ...message, content: updater(message.content) }
    return { currentMessages }
  }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  startNewChat: (integration = null) => set({
    activeIntegration: integration,
    currentMessages: [],
    activeSessionId: null,
  }),
}))
