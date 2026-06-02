import { useState, useRef, useEffect, useMemo } from 'react'
import Markdown from 'react-markdown'
import { useAuthStore } from '../store/authStore'
import { useChatStore, resolvePreferredIntegration } from '../store/chatStore'
import { usePinStore } from '../store/pinStore'
import { sendMessageStreamApi, getSessionsApi, getSessionApi } from '../api/chat'
import { listIntegrationsApi, type Integration } from '../api/integrations'
import MessageBubble from './MessageBubble'
import PinnedBanner from './PinnedBanner'
import PinSelector from './PinSelector'
import ChatSelector from './ChatSelector'
import { Pin, Plus, Send } from 'lucide-react'

export default function ChatWindow() {
  const { user, setDefaultIntegration } = useAuthStore()
  const {
    integrations,
    activeIntegration,
    activeSessionId,
    currentMessages,
    integrationsLoaded,
    setIntegrations,
    setIntegrationsLoaded,
    addMessage,
    removeMessages,
    startNewChat,
    setActiveIntegration,
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
  const questionLimitReached = userQuestionCount >= 10
  const hasIntegrations = integrations.length > 0
  const composerDisabled = !activeIntegration || isStreaming || questionLimitReached

  const greetingNode = useMemo(
    () => activeIntegration?.opening_greeting
      ? <Markdown>{activeIntegration.opening_greeting}</Markdown>
      : null,
    [activeIntegration?.opening_greeting]
  )

  useEffect(() => {
    let cancelled = false
    setIntegrationsLoaded(false)

    listIntegrationsApi().then(({ data }) => {
      if (cancelled) return

      setIntegrations(data)
      setIntegrationsLoaded(true)

      const currentActive = useChatStore.getState().activeIntegration
      const activeIsAccessible = currentActive
        ? data.some((integration) => integration.id === currentActive.id)
        : false

      if (!activeIsAccessible) {
        setActiveIntegration(resolvePreferredIntegration(data, user?.default_integration_id))
      }
    }).catch(() => {
      if (!cancelled) {
        setIntegrations([])
        setActiveIntegration(null)
        setIntegrationsLoaded(true)
        setError('Failed to load available chats.')
      }
    })

    return () => {
      cancelled = true
    }
  }, [setActiveIntegration, setIntegrations, setIntegrationsLoaded, user?.default_integration_id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages])

  const handleNewChat = () => {
    if (isStreaming) return
    const nextIntegration = resolvePreferredIntegration(integrations, user?.default_integration_id)
    startNewChat(nextIntegration)
    clearSelectedPins()
    setError('')
    setInput('')
    setShowPinSelector(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleSend = async () => {
    if (!activeIntegration || !input.trim() || isStreaming || questionLimitReached) return
    setError('')

    const nextSequence = currentMessages.reduce((max, message) => Math.max(max, message.sequence), 0) + 1
    const timestamp = Date.now()
    const userTempId = `temp-user-${timestamp}`
    const assistantTempId = `temp-assistant-${timestamp}`
    const integrationId = activeIntegration.id
    const userMsg = {
      id: userTempId,
      role: 'user',
      content: input,
      references: null,
      pinned: false,
      sequence: nextSequence,
      integration_id: integrationId,
      integration_name: activeIntegration.name,
    }
    addMessage(userMsg)

    const assistantMsg = {
      id: assistantTempId,
      role: 'assistant',
      content: '',
      references: null,
      pinned: false,
      sequence: nextSequence + 1,
      integration_id: integrationId,
      integration_name: activeIntegration.name,
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
      const { data } = await getSessionApi(returnedSessionId)
      if (!tempAssistantStillVisible()) return false

      setCurrentMessages(data.messages, data.id)
      return true
    }

    type PersistedRefreshResult = 'refreshed' | 'refresh-failed' | 'not-visible'

    const handlePersistedReloadFailure = (returnedSessionId: string): PersistedRefreshResult => {
      if (!tempAssistantStillVisible()) return 'not-visible'
      setActiveSessionId(returnedSessionId)
      setError('Response received, but failed to refresh the saved session.')
      return 'refresh-failed'
    }

    const refreshPersistedSessionState = async (returnedSessionId: string): Promise<PersistedRefreshResult> => {
      try {
        const reloaded = await reloadPersistedSession(returnedSessionId)
        if (!reloaded) return 'not-visible'
      } catch {
        return handlePersistedReloadFailure(returnedSessionId)
      }

      try {
        const sessionsRes = await getSessionsApi()
        setSessions(sessionsRes.data)
        return 'refreshed'
      } catch {
        setActiveSessionId(returnedSessionId)
        setError('Response received, but failed to refresh the saved session.')
        return 'refresh-failed'
      }
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
            const refreshResult = await refreshPersistedSessionState(returnedSessionId)
            if (refreshResult === 'not-visible') return
          } else {
            try {
              const sessionsRes = await getSessionsApi()
              setSessions(sessionsRes.data)
            } catch {
              setError('Response received, but failed to refresh the saved session.')
            }
          }
          clearSelectedPins()
        },
        async (errorMsg, returnedSessionId) => {
          if (!tempAssistantStillVisible()) return

          if (returnedSessionId) {
            const refreshResult = await refreshPersistedSessionState(returnedSessionId)
            if (refreshResult === 'not-visible') return
            clearSelectedPins()
            if (refreshResult === 'refreshed') setError(errorMsg)
          } else {
            removeMessages([userTempId, assistantTempId])
            setInput(message)
            if (textareaRef.current) textareaRef.current.style.height = 'auto'
            setError(errorMsg)
          }
        },
      )
    } catch {
      if (tempAssistantStillVisible()) {
        removeMessages([userTempId, assistantTempId])
        setInput(message)
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        setError('Failed to get response. Please try again.')
      }
    } finally {
      setStreaming(false)
    }
  }

  const handleSelectIntegration = (integration: Integration) => {
    if (isStreaming) return
    setActiveIntegration(integration)
  }

  const handleSetDefaultIntegration = async (integration: Integration) => {
    if (isStreaming) return
    try {
      await setDefaultIntegration(integration.id)
      setError('')
    } catch {
      setError('Failed to update default chat.')
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

  const placeholder = !activeIntegration
    ? 'No chats available'
    : questionLimitReached
      ? 'Start a new chat to continue...'
      : `Ask ${activeIntegration.name} something...`

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-we-canvas">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <PinnedBanner pins={selectedPins} onRemove={removeSelectedPin} />

        {/* Agent header card */}
        {currentMessages.length === 0 && activeIntegration && (
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

        {currentMessages.length === 0 && integrationsLoaded && !hasIntegrations && (
          <div className="flex min-h-[40vh] items-center justify-center text-center text-sm text-amcs-grey-300">
            No chats available. Contact your manager for access.
          </div>
        )}

        {/* Greeting card */}
        {currentMessages.length === 0 && activeIntegration?.opening_greeting && (
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
          10-question limit reached. Start a new chat to continue.
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 px-6 pb-4 pt-2 max-md:px-3">
        <div className="bg-white rounded-[14px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-we-border px-2 py-2">
          <div className="mb-2 flex items-center gap-2 md:hidden">
            <ChatSelector
              integrations={integrations}
              selectedIntegration={activeIntegration}
              defaultIntegrationId={user?.default_integration_id}
              disabled={isStreaming || !hasIntegrations}
              onSelect={handleSelectIntegration}
              onSetDefault={handleSetDefaultIntegration}
            />
            <button
              type="button"
              onClick={handleNewChat}
              disabled={isStreaming || !hasIntegrations}
              title="New chat"
              className="h-9 w-9 shrink-0 rounded-[10px] border border-we-border text-we-muted hover:text-amcs-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors inline-flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-end gap-2">
            <div className="hidden md:flex items-center gap-2 shrink-0 pb-0.5">
              <ChatSelector
                integrations={integrations}
                selectedIntegration={activeIntegration}
                defaultIntegrationId={user?.default_integration_id}
                disabled={isStreaming || !hasIntegrations}
                onSelect={handleSelectIntegration}
                onSetDefault={handleSetDefaultIntegration}
              />
              <button
                type="button"
                onClick={handleNewChat}
                disabled={isStreaming || !hasIntegrations}
                title="New chat"
                className="h-9 w-9 shrink-0 rounded-[10px] border border-we-border text-we-muted hover:text-amcs-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors inline-flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          <button
            type="button"
            onClick={() => setShowPinSelector(!showPinSelector)}
            disabled={!activeIntegration}
            title="Attach pinned responses"
            className="h-9 w-9 text-amcs-grey-300 hover:text-amcs-primary cursor-pointer transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center"
          >
            <Pin className="w-4 h-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            disabled={composerDisabled}
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
            placeholder={placeholder}
            className="flex-1 text-sm text-we-text placeholder:text-we-muted bg-transparent border-none outline-none resize-none py-1.5"
          />
          <div className="pb-3 text-[11px] text-we-muted shrink-0">
            {userQuestionCount}/10
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={composerDisabled || !input.trim()}
            className="w-10 h-10 bg-we-accent rounded-[10px] flex items-center justify-center text-white shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:brightness-110"
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}
