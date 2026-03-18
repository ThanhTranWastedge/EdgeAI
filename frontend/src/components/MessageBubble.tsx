import Markdown from 'react-markdown'
import { MessageData } from '../api/chat'

interface Props {
  message: MessageData
  onPin?: (messageId: string) => void
}

export default function MessageBubble({ message, onPin }: Props) {
  const isUser = message.role === 'user'
  const refs = message.references ? JSON.parse(message.references) : null

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
      <div style={{
        background: isUser ? '#1a2332' : '#161b22',
        border: '1px solid #30363d',
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        padding: '12px 16px',
        maxWidth: '70%',
      }}>
        {isUser ? (
          <div style={{ color: '#e0e0e0', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {message.content}
          </div>
        ) : (
          <div className="markdown-body" style={{ color: '#e0e0e0', fontSize: 13, lineHeight: 1.6 }}>
            <Markdown>{message.content}</Markdown>
          </div>
        )}
        {!isUser && (
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #30363d', display: 'flex', gap: 8 }}>
            {onPin && !message.pinned && (
              <button onClick={() => onPin(message.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(187,134,252,0.1)', border: '1px solid rgba(187,134,252,0.2)', borderRadius: 3, color: '#bb86fc', cursor: 'pointer' }}>
                Pin
              </button>
            )}
            {message.pinned && <span style={{ fontSize: 11, color: '#bb86fc' }}>Pinned</span>}
            <button onClick={() => navigator.clipboard.writeText(message.content)} style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(100,255,218,0.1)', border: '1px solid rgba(100,255,218,0.2)', borderRadius: 3, color: '#64ffda', cursor: 'pointer' }}>
              Copy
            </button>
          </div>
        )}
        {refs && refs.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#484f58' }}>
            References: {refs.map((r: { document_name: string }) => r.document_name).join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
