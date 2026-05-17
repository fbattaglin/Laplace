import { useMutation, useQuery } from '@tanstack/react-query'

import {
  confirmDataset,
  fetchDatasets,
  loadDataset,
  runBacktest,
  runDiagnostics,
  uploadFile,
} from '../api/client'
import { useAppStore } from '../stores/useAppStore'
import type { TimeSeriesData } from '../types'

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

export function useDiagnostics(data: TimeSeriesData | null) {
  return useQuery({
    queryKey: ['diagnostics', data?.name, data?.n_points],
    queryFn: () => runDiagnostics(data!),
    enabled: !!data,
  })
}

export function useBacktest(data: TimeSeriesData | null) {
  return useQuery({
    queryKey: ['backtest', data?.name, data?.n_points],
    queryFn: () =>
      runBacktest({
        values: data!.values,
        frequency: data!.frequency,
      }),
    enabled: !!data,
    staleTime: Infinity,
  })
}
