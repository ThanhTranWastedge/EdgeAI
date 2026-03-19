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
            ? 'bg-sky-50 text-slate-900 rounded-br-sm'
            : 'bg-white border border-slate-200 text-slate-900 rounded-bl-sm'
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
          <div className="mt-2 pt-2 border-t border-slate-100 flex gap-2">
            {onPin && !message.pinned && (
              <button
                onClick={() => onPin(message.id)}
                className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-600 border border-purple-100 hover:bg-purple-100 transition-colors cursor-pointer"
              >
                Pin
              </button>
            )}
            {message.pinned && (
              <span className="text-xs text-purple-500">Pinned</span>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(message.content)}
              className="text-xs px-2 py-1 rounded bg-sky-50 text-sky-600 border border-sky-100 hover:bg-sky-100 transition-colors cursor-pointer"
            >
              Copy
            </button>
          </div>
        )}
        {refs && refs.length > 0 && (
          <div className="mt-2 text-[10px] text-slate-400">
            References: {refs.map((r: { document_name: string }) => r.document_name).join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
