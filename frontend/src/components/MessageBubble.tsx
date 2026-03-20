import { useMemo } from 'react'
import Markdown from 'react-markdown'
import { MessageData } from '../api/chat'

interface Props {
  message: MessageData
  onPin?: (messageId: string) => void
}

export default function MessageBubble({ message, onPin }: Props) {
  const isUser = message.role === 'user'
  const refs = useMemo(() => message.references ? JSON.parse(message.references) : null, [message.references])

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`px-4 py-3 max-w-[70%] text-sm leading-relaxed
          ${isUser
            ? 'bg-amcs-primary text-white rounded-[14px_14px_4px_14px]'
            : 'bg-white border border-we-border text-we-text rounded-[14px_14px_14px_4px] shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
          }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="markdown-body">
            <Markdown>{message.content}</Markdown>
          </div>
        )}
        {!isUser && (
          <div className="mt-2 pt-2 border-t border-we-border flex gap-2">
            {onPin && !message.pinned && (
              <button
                onClick={() => onPin(message.id)}
                className="text-xs px-2 py-1 rounded bg-amcs-positive-light text-[#166534] border border-[#bbf7d0] hover:bg-[#dcfce7] transition-colors cursor-pointer"
              >
                Pin
              </button>
            )}
            {message.pinned && (
              <span className="text-xs text-we-accent">Pinned</span>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(message.content)}
              className="text-xs px-2 py-1 rounded bg-[#f0f9ff] text-[#0c4a6e] border border-[#bae6fd] hover:bg-[#e0f2fe] transition-colors cursor-pointer"
            >
              Copy
            </button>
          </div>
        )}
        {refs && refs.length > 0 && (
          <div className="mt-2 text-[10px] text-amcs-grey-300">
            References: {refs.map((r: { document_name: string }) => r.document_name).join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
