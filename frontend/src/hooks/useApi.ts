import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  confirmDataset,
  confirmUpload,
  fetchDatasets,
  fetchRunHistory,
  loadDataset,
  runBacktest,
  runDiagnostics,
  runPreprocessing,
  uploadFile,
} from '../api/client'
import { useAppStore } from '../stores/useAppStore'
import type { PreprocessingConfig, TimeSeriesData } from '../types'

// Stable hash of the preprocessing config — used to bust diagnostics/backtest
// cache when preprocessing changes. Only includes the fields that affect values.
function preprocessingHash(config: PreprocessingConfig | null): string {
  if (!config) return 'raw'
  const {
    remove_outliers, outlier_method, outlier_replacement,
    smooth, smooth_method, smooth_window,
    difference, difference_order,
  } = config
  return JSON.stringify({
    remove_outliers, outlier_method, outlier_replacement,
    smooth, smooth_method, smooth_window,
    difference, difference_order,
  })
}

export function useDatasets() {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: fetchDatasets,
  })
}

export function useLoadDataset() {
  const setTimeSeriesData = useAppStore((s) => s.setTimeSeriesData)
  const setStep = useAppStore((s) => s.setStep)

  return useMutation({
    mutationFn: loadDataset,
    onSuccess: (data) => {
      setTimeSeriesData(data)
      setStep('diagnostics')
    },
  })
}

export function useUploadFile() {
  return useMutation({
    mutationFn: uploadFile,
  })
}

export function useConfirmDataset() {
  const setTimeSeriesData = useAppStore((s) => s.setTimeSeriesData)
  const setStep = useAppStore((s) => s.setStep)

  return useMutation({
    mutationFn: confirmDataset,
    onSuccess: (data) => {
      setTimeSeriesData(data)
      setStep('diagnostics')
    },
  })
}

export function useConfirmUpload() {
  const setTimeSeriesData = useAppStore((s) => s.setTimeSeriesData)
  const setStep = useAppStore((s) => s.setStep)

  return useMutation({
    mutationFn: confirmUpload,
    onSuccess: (data) => {
      setTimeSeriesData(data)
      setStep('diagnostics')
    },
  })
}

export function useDiagnostics(data: TimeSeriesData | null) {
  const preprocessingConfig = useAppStore((s) => s.preprocessingConfig)
  const preprocessedData = useAppStore((s) => s.preprocessedData)
  const periodOverride = useAppStore((s) => s.periodOverride)

  // Use the active data (preprocessed if available, otherwise raw)
  const activeData = data
    ? (preprocessedData
        ? { ...data, values: preprocessedData.values, dates: preprocessedData.dates, n_points: preprocessedData.values.length }
        : data)
    : null

  return useQuery({
    queryKey: ['diagnostics', data?.name, data?.n_points, preprocessingHash(preprocessedData ? preprocessingConfig : null), periodOverride],
    queryFn: () => runDiagnostics(activeData!, periodOverride),
    enabled: !!activeData,
  })
}

export function useBacktest(data: TimeSeriesData | null) {
  const preprocessingConfig = useAppStore((s) => s.preprocessingConfig)
  const preprocessedData = useAppStore((s) => s.preprocessedData)
  const backtestConfig = useAppStore((s) => s.backtestConfig)

  const activeValues = preprocessedData ? preprocessedData.values : data?.values
  const activeFrequency = data?.frequency

  return useQuery({
    queryKey: [
      'backtest',
      data?.name,
      data?.n_points,
      preprocessingHash(preprocessedData ? preprocessingConfig : null),
      backtestConfig.n_splits,
      backtestConfig.horizon,
      backtestConfig.metric,
    ],
    queryFn: () =>
      runBacktest({
        values: activeValues!,
        frequency: activeFrequency!,
        n_splits: backtestConfig.n_splits,
        horizon: backtestConfig.horizon ?? undefined,
      }),
    enabled: !!data && !!activeValues,
    staleTime: Infinity,
  })
}

export function usePreprocessing() {
  const queryClient = useQueryClient()
  const { timeSeriesData, preprocessingConfig, setPreprocessedData, resetPreprocessing } = useAppStore()

  const apply = useMutation({
    mutationFn: (config: PreprocessingConfig) => {
      if (!timeSeriesData) throw new Error('No data loaded')
      return runPreprocessing({
        values: timeSeriesData.values,
        dates: timeSeriesData.dates,
        config,
      })
    },
    onSuccess: (result) => {
      setPreprocessedData(result)
      // Bust diagnostics + backtest cache so they re-run with new values
      queryClient.invalidateQueries({ queryKey: ['diagnostics'] })
      queryClient.invalidateQueries({ queryKey: ['backtest'] })
    },
  })

  const reset = () => {
    resetPreprocessing()
    queryClient.invalidateQueries({ queryKey: ['diagnostics'] })
    queryClient.invalidateQueries({ queryKey: ['backtest'] })
  }

  return { apply, reset, currentConfig: preprocessingConfig }
}

export function useRunHistory() {
  return useQuery({
    queryKey: ['run-history'],
    queryFn: fetchRunHistory,
    staleTime: 0,
  })
}
