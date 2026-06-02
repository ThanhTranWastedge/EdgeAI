import { useMemo } from 'react'
import Markdown from 'react-markdown'
import { MessageData } from '../api/chat'

interface Props {
  message: MessageData
  onPin?: (messageId: string) => void
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const addDocumentName = (value: unknown, names: Set<string>) => {
  if (!isRecord(value)) return
  const documentName = value.document_name
  if (typeof documentName === 'string' && documentName.trim()) {
    names.add(documentName.trim())
  }
}

const addChunkDocumentNames = (chunks: unknown, names: Set<string>) => {
  if (Array.isArray(chunks)) {
    chunks.forEach((chunk) => addDocumentName(chunk, names))
    return
  }

  if (isRecord(chunks)) {
    Object.values(chunks).forEach((chunk) => addDocumentName(chunk, names))
  }
}

const extractReferenceNames = (references: string | null) => {
  if (!references) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(references)
  } catch {
    return []
  }

  const names = new Set<string>()

  if (Array.isArray(parsed)) {
    parsed.forEach((reference) => addDocumentName(reference, names))
  } else if (isRecord(parsed)) {
    addDocumentName(parsed, names)
    addChunkDocumentNames(parsed.chunks, names)
  }

  return Array.from(names)
}

export default function MessageBubble({ message, onPin }: Props) {
  const isUser = message.role === 'user'
  const referenceNames = useMemo(
    () => extractReferenceNames(message.references),
    [message.references],
  )

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
        {!isUser && message.integration_name && (
          <div className="mt-2 text-[11px] text-we-muted">
            Answered by {message.integration_name}
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
        {referenceNames.length > 0 && (
          <div className="mt-2 text-[10px] text-amcs-grey-300">
            References: {referenceNames.join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
