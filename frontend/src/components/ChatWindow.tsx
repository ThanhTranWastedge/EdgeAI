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
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
      Select an integration to start chatting
    </div>
  }

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return
    setError('')
    clearMessages()

    const userMsg = { id: 'temp-user', role: 'user', content: input, references: null, pinned: false, sequence: 1 }
    addMessage(userMsg)

    // Add empty assistant message that will be filled by streaming
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
          // Append each chunk to the assistant message
          updateLastMessage((prev) => prev + chunk)
        },
        async (_refs) => {
          // Stream done - refresh sessions
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
      // Mark message as pinned in local state
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 15, color: '#fff' }}>{activeIntegration.icon || '\uD83D\uDCAC'} {activeIntegration.name}</span>
          <span style={{ fontSize: 11, color: '#64ffda', marginLeft: 8, padding: '2px 6px', background: 'rgba(100,255,218,0.1)', borderRadius: 3 }}>
            {activeIntegration.provider_type}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#8b949e' }}>New session each message</span>
      </div>

      <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
        <PinnedBanner pins={selectedPins} onRemove={removeSelectedPin} />
        {currentMessages.map((m, i) => (
          <MessageBubble key={i} message={m} onPin={m.role === 'assistant' ? handlePin : undefined} />
        ))}
        {isStreaming && <div style={{ color: '#8b949e', fontSize: 13 }}>Thinking...</div>}
        {error && <div style={{ color: '#cf6679', fontSize: 13 }}>{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '12px 20px', borderTop: '1px solid #30363d' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 16, cursor: 'pointer', color: '#8b949e' }} onClick={() => setShowPinSelector(!showPinSelector)} title="Attach pinned responses">Pin</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={`Ask ${activeIntegration.name} something...`}
            style={{ flex: 1, background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#e0e0e0', fontSize: 13, outline: 'none' }}
          />
          <button onClick={handleSend} disabled={isStreaming} style={{ background: '#64ffda', color: '#0d1117', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 'bold', cursor: 'pointer', border: 'none' }}>
            Send
          </button>
        </div>
        {showPinSelector && <PinSelector onClose={() => setShowPinSelector(false)} />}
      </div>
    </div>
  )
}
