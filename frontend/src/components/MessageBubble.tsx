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
        className={`rounded-xl px-4 py-3 max-w-[70%] text-sm leading-relaxed
          ${isUser
            ? 'bg-amcs-primary/10 text-amcs-black rounded-br-sm'
            : 'bg-amcs-white border border-amcs-grey-100 text-amcs-black rounded-bl-sm'
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
          <div className="mt-2 pt-2 border-t border-amcs-grey-100 flex gap-2">
            {onPin && !message.pinned && (
              <button
                onClick={() => onPin(message.id)}
                className="text-xs px-2 py-1 rounded bg-amcs-primary/10 text-amcs-primary border border-amcs-primary/20 hover:bg-amcs-primary/20 transition-colors cursor-pointer"
              >
                Pin
              </button>
            )}
            {message.pinned && (
              <span className="text-xs text-amcs-primary">Pinned</span>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(message.content)}
              className="text-xs px-2 py-1 rounded bg-amcs-primary/10 text-amcs-primary border border-amcs-primary/20 hover:bg-amcs-grey-100 transition-colors cursor-pointer"
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
