import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { usePinStore } from '../store/pinStore'
import { sendMessageStreamApi, getSessionsApi } from '../api/chat'
import MessageBubble from './MessageBubble'
import PinnedBanner from './PinnedBanner'
import PinSelector from './PinSelector'

export default function ChatWindow() {
  const { activeIntegration, currentMessages, addMessage, clearMessages, setSessions, isStreaming, setStreaming, updateLastMessage } = useChatStore()
  const { selectedPins, removeSelectedPin, clearSelectedPins } = usePinStore()
  const [input, setInput] = useState('')
  const [showPinSelector, setShowPinSelector] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages])

  if (!activeIntegration) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Select an integration to start chatting
      </div>
    )
  }

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return
    setError('')
    clearMessages()

    const userMsg = { id: 'temp-user', role: 'user', content: input, references: null, pinned: false, sequence: 1 }
    addMessage(userMsg)

    const assistantMsg = { id: 'temp-assistant', role: 'assistant', content: '', references: null, pinned: false, sequence: 2 }
    addMessage(assistantMsg)

    const pinnedIds = selectedPins.map((p) => p.id)
    const message = input
    setInput('')
    setStreaming(true)

    try {
      await sendMessageStreamApi(
        activeIntegration.id,
        message,
        pinnedIds.length > 0 ? pinnedIds : undefined,
        (chunk) => {
          updateLastMessage((prev) => prev + chunk)
        },
        async (_refs) => {
          clearSelectedPins()
          const sessionsRes = await getSessionsApi(activeIntegration.id)
          setSessions(sessionsRes.data)
        },
        (errorMsg) => {
          setError(errorMsg)
        },
      )
    } catch {
      setError('Failed to get response. Please try again.')
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
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="h-14 px-6 flex items-center justify-between border-b border-slate-200 bg-white">
        <span className="text-sm font-medium text-slate-900">
          {activeIntegration.icon || '\uD83D\uDCAC'} {activeIntegration.name}
        </span>
        <span className="text-xs text-slate-400">New session each message</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <PinnedBanner pins={selectedPins} onRemove={removeSelectedPin} />
        {currentMessages.length === 0 && activeIntegration.opening_greeting && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border border-slate-200 rounded-xl rounded-bl-sm px-4 py-3 max-w-[70%] text-sm leading-relaxed text-slate-900 whitespace-pre-wrap">
              {activeIntegration.opening_greeting}
            </div>
          </div>
        )}
        {currentMessages.map((m, i) => (
          <MessageBubble key={i} message={m} onPin={m.role === 'assistant' ? handlePin : undefined} />
        ))}
        {isStreaming && <div className="text-slate-400 text-sm animate-pulse">Thinking...</div>}
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-3 border-t border-slate-200 bg-white">
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowPinSelector(!showPinSelector)}
            title="Attach pinned responses"
            className="text-slate-400 hover:text-sky-500 text-sm cursor-pointer transition-colors"
          >
            Pin
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={`Ask ${activeIntegration.name} something...`}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming}
            className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Send
          </button>
        </div>
        {showPinSelector && <PinSelector onClose={() => setShowPinSelector(false)} />}
      </div>
    </div>
  )
}
