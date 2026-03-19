import { useEffect } from 'react'
import { usePinStore } from '../store/pinStore'
import { listPinsApi } from '../api/pins'

interface Props {
  onClose: () => void
}

export default function PinSelector({ onClose }: Props) {
  const { allPins, setAllPins, selectedPins, toggleSelectedPin } = usePinStore()

  useEffect(() => {
    if (allPins.length === 0) {
      listPinsApi().then(({ data }) => setAllPins(data))
    }
  }, [])

  return (
    <div className="mt-2 bg-white border border-slate-200 rounded-lg p-3 max-h-[200px] overflow-y-auto shadow-sm">
      <div className="flex justify-between mb-2">
        <span className="text-xs text-slate-500">Select pinned responses to inject:</span>
        <span onClick={onClose} className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 transition-colors">
          Close
        </span>
      </div>
      {allPins.length === 0 && <div className="text-xs text-slate-400">No pinned responses yet</div>}
      {allPins.map((pin) => {
        const isSelected = selectedPins.some((p) => p.id === pin.id)
        return (
          <div
            key={pin.id}
            onClick={() => toggleSelectedPin(pin)}
            className={`p-2 rounded cursor-pointer mb-1 transition-colors
              ${isSelected
                ? 'bg-amber-50 border border-amber-200'
                : 'hover:bg-slate-50 border border-transparent'
              }`}
          >
            <div className="text-xs text-slate-700">{pin.label}</div>
            <div className="text-[10px] text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
              {pin.integration_name && <span className="text-slate-500">[{pin.integration_name}] </span>}
              {pin.content.slice(0, 80)}...
            </div>
          </div>
        )
      })}
    </div>
  )
}
