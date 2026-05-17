import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import type { DisplayMode } from '../lib/copy'
import type { PreprocessedResult, PreprocessingConfig, Step, TimeSeriesData } from '../types'

const DEFAULT_PREPROCESSING: PreprocessingConfig = {
  remove_outliers: false,
  outlier_method: 'iqr',
  outlier_replacement: 'interpolate',
  smooth: false,
  smooth_method: 'sma',
  smooth_window: null,
  difference: false,
  difference_order: 1,
}

interface AppState {
  currentStep: Step
  displayMode: DisplayMode
  timeSeriesData: TimeSeriesData | null
  preprocessingConfig: PreprocessingConfig
  preprocessedData: PreprocessedResult | null

  setStep: (step: Step) => void
  setDisplayMode: (mode: DisplayMode) => void
  setTimeSeriesData: (data: TimeSeriesData) => void
  setPreprocessingConfig: (config: PreprocessingConfig) => void
  setPreprocessedData: (data: PreprocessedResult | null) => void
  resetPreprocessing: () => void
  reset: () => void

  // Returns preprocessed data if available, otherwise raw — used by all downstream steps
  getActiveData: () => TimeSeriesData | null
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentStep: 'dataInput',
      displayMode: 'boardroom',
      timeSeriesData: null,
      preprocessingConfig: DEFAULT_PREPROCESSING,
      preprocessedData: null,

      setStep: (step) => set({ currentStep: step }),
      setDisplayMode: (mode) => set({ displayMode: mode }),
      setTimeSeriesData: (data) => set({ timeSeriesData: data, preprocessedData: null, preprocessingConfig: DEFAULT_PREPROCESSING }),
      setPreprocessingConfig: (config) => set({ preprocessingConfig: config }),
      setPreprocessedData: (data) => set({ preprocessedData: data }),
      resetPreprocessing: () => set({ preprocessedData: null, preprocessingConfig: DEFAULT_PREPROCESSING }),

      reset: () => set({
        currentStep: 'dataInput',
        timeSeriesData: null,
        preprocessedData: null,
        preprocessingConfig: DEFAULT_PREPROCESSING,
      }),

      getActiveData: () => {
        const { timeSeriesData, preprocessedData } = get()
        if (!timeSeriesData) return null
        if (preprocessedData) {
          return {
            ...timeSeriesData,
            values: preprocessedData.values,
            dates: preprocessedData.dates,
            n_points: preprocessedData.values.length,
          }
        }
        return timeSeriesData
      },
    }),
    {
      name: 'laplace-app-state',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
