import { create } from 'zustand'
import { Integration } from '../api/integrations'
import { MessageData, SessionData } from '../api/chat'

interface ChatState {
  activeIntegration: Integration | null
  sessions: SessionData[]
  currentMessages: MessageData[]
  isStreaming: boolean
  setActiveIntegration: (integration: Integration) => void
  setSessions: (sessions: SessionData[]) => void
  setCurrentMessages: (messages: MessageData[]) => void
  addMessage: (message: MessageData) => void
  updateLastMessage: (updater: (prevContent: string) => string) => void
  setStreaming: (streaming: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeIntegration: null,
  sessions: [],
  currentMessages: [],
  isStreaming: false,

  setActiveIntegration: (integration) => set({ activeIntegration: integration, currentMessages: [] }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentMessages: (messages) => set({ currentMessages: messages }),
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
  clearMessages: () => set({ currentMessages: [] }),
}))
