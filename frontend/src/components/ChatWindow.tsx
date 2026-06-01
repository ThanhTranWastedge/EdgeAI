import { useState, useRef, useEffect, useMemo } from 'react'
import Markdown from 'react-markdown'
import { useChatStore } from '../store/chatStore'
import { usePinStore } from '../store/pinStore'
import { sendMessageStreamApi, getSessionsApi, getSessionApi } from '../api/chat'
import MessageBubble from './MessageBubble'
import PinnedBanner from './PinnedBanner'
import PinSelector from './PinSelector'
import { Send } from 'lucide-react'

export default function ChatWindow() {
  const {
    activeIntegration,
    activeSessionId,
    currentMessages,
    addMessage,
    startNewChat,
    setActiveSessionId,
    setSessions,
    setCurrentMessages,
    isStreaming,
    setStreaming,
    updateMessageContent,
  } = useChatStore()
  const { selectedPins, removeSelectedPin, clearSelectedPins } = usePinStore()
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showPinSelector, setShowPinSelector] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userQuestionCount = currentMessages.filter((m) => m.role === 'user').length
  const questionLimitReached = userQuestionCount >= 20

  const greetingNode = useMemo(
    () => activeIntegration?.opening_greeting
      ? <Markdown>{activeIntegration.opening_greeting}</Markdown>
      : null,
    [activeIntegration?.opening_greeting]
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages])

  if (!activeIntegration) {
    return (
      <div className="flex-1 flex items-center justify-center text-amcs-grey-300 text-sm bg-we-canvas">
        Select an integration to start chatting
      </div>
    )
  }

  const handleNewChat = () => {
    if (isStreaming) return
    startNewChat()
    clearSelectedPins()
    setError('')
    setInput('')
    setShowPinSelector(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleSend = async () => {
    if (!input.trim() || isStreaming || questionLimitReached) return
    setError('')

    const nextSequence = currentMessages.reduce((max, message) => Math.max(max, message.sequence), 0) + 1
    const timestamp = Date.now()
    const assistantTempId = `temp-assistant-${timestamp}`
    const integrationId = activeIntegration.id
    const userMsg = {
      id: `temp-user-${timestamp}`,
      role: 'user',
      content: input,
      references: null,
      pinned: false,
      sequence: nextSequence,
    }
    addMessage(userMsg)

    const assistantMsg = {
      id: assistantTempId,
      role: 'assistant',
      content: '',
      references: null,
      pinned: false,
      sequence: nextSequence + 1,
    }
    addMessage(assistantMsg)

    const pinnedIds = selectedPins.map((p) => p.id)
    const message = input
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setStreaming(true)

    const tempAssistantStillVisible = () =>
      useChatStore
        .getState()
        .currentMessages.some((m) => m.id === assistantTempId)

    const reloadPersistedSession = async (returnedSessionId: string) => {
      setActiveSessionId(returnedSessionId)
      const { data } = await getSessionApi(integrationId, returnedSessionId)
      if (!tempAssistantStillVisible()) return false

      setCurrentMessages(data.messages, data.id)
      return true
    }

    try {
      await sendMessageStreamApi(
        integrationId,
        message,
        pinnedIds.length > 0 ? pinnedIds : undefined,
        activeSessionId,
        (chunk) => {
          updateMessageContent(assistantTempId, (prev) => prev + chunk)
        },
        async (_refs, returnedSessionId) => {
          if (!tempAssistantStillVisible()) return

          if (returnedSessionId) {
            const reloaded = await reloadPersistedSession(returnedSessionId)
            if (!reloaded) return
          }
          clearSelectedPins()
          const sessionsRes = await getSessionsApi(integrationId)
          if (useChatStore.getState().activeIntegration?.id === integrationId) {
            setSessions(sessionsRes.data)
          }
        },
        async (errorMsg, returnedSessionId) => {
          if (!tempAssistantStillVisible()) return

          if (returnedSessionId) {
            const reloaded = await reloadPersistedSession(returnedSessionId)
            if (!reloaded) return
            const sessionsRes = await getSessionsApi(integrationId)
            if (useChatStore.getState().activeIntegration?.id === integrationId) {
              setSessions(sessionsRes.data)
            }
          }
          setError(errorMsg)
        },
      )
    } catch {
      if (tempAssistantStillVisible()) {
        setError('Failed to get response. Please try again.')
      }
    } finally {
      setStreaming(false)
    }
  }

  const handlePin = async (messageId: string) => {
    const label = prompt('Enter a label for this pin:')
    if (!label) return
    const { createPinApi } = await import('../api/pins')
    try {
      await createPinApi(messageId, label)
      useChatStore.setState((state) => ({
        currentMessages: state.currentMessages.map((m) =>
          m.id === messageId ? { ...m, pinned: true } : m
        ),
      }))
    } catch {
      alert('Failed to pin message')
    }
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-we-canvas">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-xs text-we-muted">
            {userQuestionCount}/20
          </div>
          <button
            onClick={handleNewChat}
            disabled={isStreaming}
            className="text-xs font-medium text-amcs-primary hover:text-amcs-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            New Chat
          </button>
        </div>
        <PinnedBanner pins={selectedPins} onRemove={removeSelectedPin} />

        {/* Agent header card */}
        {currentMessages.length === 0 && (
          <div className="flex items-center gap-3 mb-5 p-4 bg-white rounded-xl border border-we-border shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="w-10 h-10 bg-amcs-primary rounded-[10px] flex items-center justify-center text-lg">
              {activeIntegration.icon || '\uD83D\uDCAC'}
            </div>
            <div>
              <div className="font-bold text-[15px] text-we-text">{activeIntegration.name}</div>
              <div className="text-xs text-we-muted">Online</div>
            </div>
          </div>
        )}

        {/* Greeting card */}
        {currentMessages.length === 0 && activeIntegration.opening_greeting && (
          <div className="bg-white rounded-xl border border-we-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 markdown-body text-sm leading-relaxed text-amcs-black">
            {greetingNode}
          </div>
        )}

        {currentMessages.map((m) => (
          <MessageBubble key={m.id} message={m} onPin={m.role === 'assistant' ? handlePin : undefined} />
        ))}
        {isStreaming && <div className="text-amcs-grey-300 text-sm animate-pulse">Thinking...</div>}
        {error && <div className="text-amcs-negative text-sm">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Pin selector */}
      {showPinSelector && (
        <div className="px-6 max-md:px-3">
          <PinSelector onClose={() => setShowPinSelector(false)} />
        </div>
      )}

      {questionLimitReached && (
        <div className="px-6 pb-2 max-md:px-3 text-xs text-amcs-negative">
          20-question limit reached. Start a new chat to continue.
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 px-6 pb-4 pt-2 max-md:px-3">
        <div className="bg-white rounded-[14px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-we-border flex items-end gap-3 pl-5 pr-2 py-2">
          <button
            onClick={() => setShowPinSelector(!showPinSelector)}
            title="Attach pinned responses"
            className="text-amcs-grey-300 hover:text-amcs-primary text-sm cursor-pointer transition-colors shrink-0 pb-1.5"
          >
            Pin
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            disabled={questionLimitReached}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              questionLimitReached
                ? 'Start a new chat to continue...'
                : `Ask ${activeIntegration.name} something...`
            }
            className="flex-1 text-sm text-we-text placeholder:text-we-muted bg-transparent border-none outline-none resize-none py-1.5"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || questionLimitReached}
            className="w-10 h-10 bg-we-accent rounded-[10px] flex items-center justify-center text-white shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:brightness-110"
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </div>
  )
}
