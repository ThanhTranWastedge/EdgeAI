import { useEffect } from 'react'
import { usePinStore } from '../store/pinStore'
import { listPinsApi } from '../api/pins'

interface Props {
  onClose: () => void
}

export default function PinSelector({ onClose }: Props) {
  const { allPins, setAllPins, selectedPins, toggleSelectedPin } = usePinStore()

  useEffect(() => {
    listPinsApi().then(({ data }) => setAllPins(data))
  }, [])

  return (
    <div style={{ marginTop: 8, background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 12, maxHeight: 200, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#8b949e' }}>Select pinned responses to inject:</span>
        <span onClick={onClose} style={{ cursor: 'pointer', color: '#8b949e', fontSize: 12 }}>Close</span>
      </div>
      {allPins.length === 0 && <div style={{ color: '#484f58', fontSize: 12 }}>No pinned responses yet</div>}
      {allPins.map((pin) => {
        const isSelected = selectedPins.some((p) => p.id === pin.id)
        return (
          <div
            key={pin.id}
            onClick={() => toggleSelectedPin(pin)}
            style={{
              padding: 8,
              borderRadius: 4,
              marginBottom: 4,
              cursor: 'pointer',
              background: isSelected ? 'rgba(255,215,0,0.1)' : 'transparent',
              border: `1px solid ${isSelected ? 'rgba(255,215,0,0.3)' : 'transparent'}`,
            }}
          >
            <div style={{ fontSize: 12, color: '#c9d1d9' }}>{pin.label}</div>
            <div style={{ fontSize: 10, color: '#484f58', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pin.integration_name && <span style={{ color: '#8b949e' }}>[{pin.integration_name}] </span>}
              {pin.content.slice(0, 80)}...
            </div>
          </div>
        )
      })}
    </div>
  )
}
