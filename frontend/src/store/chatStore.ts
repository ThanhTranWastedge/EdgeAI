import { create } from 'zustand'
import { Integration } from '../api/integrations'
import { MessageData, SessionData } from '../api/chat'

interface ChatState {
  activeIntegration: Integration | null
  activeSessionId: string | null
  sessions: SessionData[]
  currentMessages: MessageData[]
  isStreaming: boolean
  setActiveIntegration: (integration: Integration) => void
  setActiveSessionId: (sessionId: string | null) => void
  setSessions: (sessions: SessionData[]) => void
  setCurrentMessages: (messages: MessageData[], sessionId?: string | null) => void
  addMessage: (message: MessageData) => void
  updateMessageContent: (messageId: string, updater: (prevContent: string) => string) => void
  setStreaming: (streaming: boolean) => void
  startNewChat: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeIntegration: null,
  activeSessionId: null,
  sessions: [],
  currentMessages: [],
  isStreaming: false,

  setActiveIntegration: (integration) => set({
    activeIntegration: integration,
    activeSessionId: null,
    currentMessages: [],
  }),
  setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentMessages: (messages, sessionId = null) => set({
    currentMessages: messages,
    activeSessionId: sessionId,
  }),
  addMessage: (message) => set((state) => ({ currentMessages: [...state.currentMessages, message] })),
  updateMessageContent: (messageId, updater) => set((state) => {
    const messageIndex = state.currentMessages.findIndex((message) => message.id === messageId)
    if (messageIndex === -1) return state

    const currentMessages = [...state.currentMessages]
    const message = currentMessages[messageIndex]
    currentMessages[messageIndex] = { ...message, content: updater(message.content) }
    return { currentMessages }
  }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  startNewChat: () => set({ currentMessages: [], activeSessionId: null }),
}))
