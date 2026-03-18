import { create } from 'zustand'

export interface PinItem {
  id: string
  label: string
  content: string
  integration_name?: string
}

interface PinState {
  allPins: PinItem[]
  selectedPins: PinItem[]
  setAllPins: (pins: PinItem[]) => void
  toggleSelectedPin: (pin: PinItem) => void
  removeSelectedPin: (id: string) => void
  clearSelectedPins: () => void
}

export const usePinStore = create<PinState>((set) => ({
  allPins: [],
  selectedPins: [],
  setAllPins: (pins) => set({ allPins: pins }),
  toggleSelectedPin: (pin) => set((state) => {
    const exists = state.selectedPins.find((p) => p.id === pin.id)
    if (exists) {
      return { selectedPins: state.selectedPins.filter((p) => p.id !== pin.id) }
    }
    return { selectedPins: [...state.selectedPins, pin] }
  }),
  removeSelectedPin: (id) => set((state) => ({ selectedPins: state.selectedPins.filter((p) => p.id !== id) })),
  clearSelectedPins: () => set({ selectedPins: [] }),
}))
