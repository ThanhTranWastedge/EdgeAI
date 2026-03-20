import { useState, useRef, useEffect, useMemo } from 'react'
import Markdown from 'react-markdown'
import { useChatStore } from '../store/chatStore'
import { usePinStore } from '../store/pinStore'
import { sendMessageStreamApi, getSessionsApi } from '../api/chat'
import MessageBubble from './MessageBubble'
import PinnedBanner from './PinnedBanner'
import PinSelector from './PinSelector'
import { Send } from 'lucide-react'

export default function ChatWindow() {
  const { activeIntegration, currentMessages, addMessage, clearMessages, setSessions, isStreaming, setStreaming, updateLastMessage } = useChatStore()
  const { selectedPins, removeSelectedPin, clearSelectedPins } = usePinStore()
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showPinSelector, setShowPinSelector] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
      <div className="flex-1 flex items-center justify-center text-amcs-grey-300 text-sm bg-[#f8fafc]">
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
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
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
    <div className="flex-1 min-w-0 flex flex-col bg-[#f8fafc] relative">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        <PinnedBanner pins={selectedPins} onRemove={removeSelectedPin} />

        {/* Agent header card */}
        {currentMessages.length === 0 && (
          <div className="flex items-center gap-3 mb-5 p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="w-10 h-10 bg-amcs-primary rounded-[10px] flex items-center justify-center text-lg">
              {activeIntegration.icon || '\uD83D\uDCAC'}
            </div>
            <div>
              <div className="font-bold text-[15px] text-[#1e293b]">{activeIntegration.name}</div>
              <div className="text-xs text-[#94a3b8]">Online</div>
            </div>
          </div>
        )}

        {/* Greeting card */}
        {currentMessages.length === 0 && activeIntegration.opening_greeting && (
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 markdown-body text-sm leading-relaxed text-amcs-black">
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

      {/* Pin selector — opens above floating input */}
      {showPinSelector && (
        <div className="absolute bottom-20 left-6 right-6 z-20">
          <PinSelector onClose={() => setShowPinSelector(false)} />
        </div>
      )}

      {/* Floating input bar */}
      <div className="absolute bottom-4 left-6 right-6 z-10 max-md:left-3 max-md:right-3">
        <div className="bg-white rounded-[14px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#e2e8f0] flex items-end gap-3 pl-5 pr-2 py-2">
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
            placeholder={`Ask ${activeIntegration.name} something...`}
            className="flex-1 text-sm text-[#1e293b] placeholder:text-[#94a3b8] bg-transparent border-none outline-none resize-none py-1.5"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming}
            className="w-10 h-10 bg-we-accent rounded-[10px] flex items-center justify-center text-white shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:brightness-110"
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </div>
  )
}
