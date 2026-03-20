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
    <div className="bg-white border border-[#e2e8f0] rounded-lg p-3 max-h-[200px] overflow-y-auto shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex justify-between mb-2">
        <span className="text-xs text-amcs-grey-400">Select pinned responses to inject:</span>
        <span onClick={onClose} className="cursor-pointer text-xs text-amcs-grey-300 hover:text-amcs-grey-500 transition-colors">
          Close
        </span>
      </div>
      {allPins.length === 0 && <div className="text-xs text-amcs-grey-300">No pinned responses yet</div>}
      {allPins.map((pin) => {
        const isSelected = selectedPins.some((p) => p.id === pin.id)
        return (
          <div
            key={pin.id}
            onClick={() => toggleSelectedPin(pin)}
            className={`p-2 rounded cursor-pointer mb-1 transition-colors
              ${isSelected
                ? 'bg-amber-50 border border-amber-200'
                : 'hover:bg-amcs-grey-50 border border-transparent'
              }`}
          >
            <div className="text-xs text-amcs-grey-600">{pin.label}</div>
            <div className="text-[10px] text-amcs-grey-300 overflow-hidden text-ellipsis whitespace-nowrap">
              {pin.integration_name && <span className="text-amcs-grey-400">[{pin.integration_name}] </span>}
              {pin.content.slice(0, 80)}...
            </div>
          </div>
        )
      })}
    </div>
  )
}
