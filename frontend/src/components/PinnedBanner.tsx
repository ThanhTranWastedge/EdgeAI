interface PinItem {
  id: string
  label: string
  content: string
}

interface Props {
  pins: PinItem[]
  onRemove: (id: string) => void
}

export default function PinnedBanner({ pins, onRemove }: Props) {
  if (pins.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs">
      <span className="text-amber-600 font-medium">Injected context:</span>
      {pins.map((p) => (
        <span key={p.id} className="ml-2 text-slate-700">
          "{p.label}"
          <span
            onClick={() => onRemove(p.id)}
            className="text-slate-400 cursor-pointer ml-1 hover:text-red-500 transition-colors"
          >
            [remove]
          </span>
        </span>
      ))}
    </div>
  )
}
