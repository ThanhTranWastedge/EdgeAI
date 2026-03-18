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
    <div style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
      <span style={{ color: '#ffd700' }}>Injected context:</span>
      {pins.map((p) => (
        <span key={p.id} style={{ marginLeft: 8, color: '#c9d1d9' }}>
          "{p.label}"
          <span onClick={() => onRemove(p.id)} style={{ color: '#484f58', cursor: 'pointer', marginLeft: 4 }}>[remove]</span>
        </span>
      ))}
    </div>
  )
}
