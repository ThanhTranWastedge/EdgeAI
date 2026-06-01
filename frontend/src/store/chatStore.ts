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
  updateLastMessage: (updater: (prevContent: string) => string) => void
  setStreaming: (streaming: boolean) => void
  clearMessages: () => void
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
  updateLastMessage: (updater) => set((state) => {
    const msgs = [...state.currentMessages]
    if (msgs.length > 0) {
      const last = { ...msgs[msgs.length - 1] }
      last.content = updater(last.content)
      msgs[msgs.length - 1] = last
    }
    return { currentMessages: msgs }
  }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  clearMessages: () => set({ currentMessages: [], activeSessionId: null }),
  startNewChat: () => set({ currentMessages: [], activeSessionId: null }),
}))
