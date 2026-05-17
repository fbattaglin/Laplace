import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import type { DisplayMode } from '../lib/copy'
import type { Step, TimeSeriesData } from '../types'

interface AppState {
  currentStep: Step
  displayMode: DisplayMode
  timeSeriesData: TimeSeriesData | null

  setStep: (step: Step) => void
  setDisplayMode: (mode: DisplayMode) => void
  setTimeSeriesData: (data: TimeSeriesData) => void
  reset: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentStep: 'dataInput',
      displayMode: 'boardroom',
      timeSeriesData: null,

      setStep: (step) => set({ currentStep: step }),
      setDisplayMode: (mode) => set({ displayMode: mode }),
      setTimeSeriesData: (data) => set({ timeSeriesData: data }),
      reset: () => set({ currentStep: 'dataInput', timeSeriesData: null }),
    }),
    {
      name: 'laplace-app-state',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
