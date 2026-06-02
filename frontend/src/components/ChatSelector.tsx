import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, MessageSquare, Star } from 'lucide-react'
import { Integration } from '../api/integrations'

interface Props {
  integrations: Integration[]
  selectedIntegration: Integration | null
  defaultIntegrationId: string | null | undefined
  disabled?: boolean
  onSelect: (integration: Integration) => void
  onSetDefault: (integration: Integration) => Promise<void> | void
}

export default function ChatSelector({
  integrations,
  selectedIntegration,
  defaultIntegrationId,
  disabled = false,
  onSelect,
  onSetDefault,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const isDisabled = disabled || integrations.length === 0

  const orderedIntegrations = useMemo(() => {
    if (!defaultIntegrationId) return integrations
    const savedDefault = integrations.find((integration) => integration.id === defaultIntegrationId)
    if (!savedDefault) return integrations

    return [
      savedDefault,
      ...integrations.filter((integration) => integration.id !== defaultIntegrationId),
    ]
  }, [defaultIntegrationId, integrations])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const handleSelect = (integration: Integration) => {
    onSelect(integration)
    setOpen(false)
  }

  const handleSetDefault = async (integration: Integration) => {
    try {
      await onSetDefault(integration)
    } finally {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-full flex-1 md:flex-none">
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => setOpen((prev) => !prev)}
        className="h-9 w-full min-w-0 max-w-full inline-flex items-center gap-2 rounded-[10px] border border-we-border bg-amcs-grey-50 px-3 text-sm text-we-text hover:border-amcs-primary/40 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        title={selectedIntegration?.name || 'Select chat'}
      >
        <MessageSquare className="w-4 h-4 shrink-0 text-we-muted" />
        <span className="min-w-0 truncate font-medium">
          {selectedIntegration?.name || 'Select chat'}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-we-muted" />
      </button>

      {open && !isDisabled && (
        <div className="absolute left-0 bottom-full z-30 mb-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-[10px] border border-we-border bg-white shadow-[0_12px_32px_rgba(0,0,0,0.16)]">
          <div className="max-h-72 overflow-y-auto py-1">
            {orderedIntegrations.map((integration) => {
              const isSelected = selectedIntegration?.id === integration.id
              const isDefault = defaultIntegrationId === integration.id

              return (
                <div
                  key={integration.id}
                  className={`group flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isSelected ? 'bg-we-accent/10' : 'hover:bg-amcs-grey-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(integration)}
                    className="min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-medium text-we-text">
                        {integration.name}
                      </span>
                      {isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-we-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-we-accent">
                          <Star className="w-3 h-3 fill-current" />
                          Default
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-we-muted">
                      {integration.provider_type}
                    </span>
                  </button>

                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(integration)}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-we-muted opacity-100 hover:bg-white hover:text-we-accent md:opacity-0 md:group-hover:opacity-100 transition"
                    >
                      Set as default
                    </button>
                  )}

                  <span className="w-4 shrink-0 text-we-accent">
                    {isSelected && <Check className="w-4 h-4" />}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
