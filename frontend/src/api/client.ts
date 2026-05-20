import type {
  BacktestRequest,
  BacktestResponse,
  DatasetMeta,
  DiagnosticsResponse,
  ForecastRequest,
  ForecastResponse,
  PreprocessedResult,
  PreprocessingConfig,
  TimeSeriesData,
  UploadResponse,
} from '../types'

const BASE_URL = '/api'

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `Request failed: ${response.status}`)
  }

  return response.json()
}

export async function healthCheck(): Promise<{ status: string }> {
  return apiFetch('/health')
}

export async function fetchDatasets(): Promise<DatasetMeta[]> {
  return apiFetch('/datasets')
}

export async function loadDataset(name: string): Promise<TimeSeriesData> {
  return apiFetch(`/datasets/${name}`)
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${BASE_URL}/datasets/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(error.detail || `Upload failed: ${response.status}`)
  }

  return response.json()
}

export async function confirmDataset(params: {
  source: 'preloaded' | 'upload'
  dataset_name?: string
  datetime_col: string
  target_col: string
  frequency?: string
}): Promise<TimeSeriesData> {
  return apiFetch('/datasets/confirm', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function confirmUpload(params: {
  file: File
  datetime_col: string
  target_col: string
  frequency?: string
  covariate_cols?: string[]
}): Promise<TimeSeriesData> {
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('datetime_col', params.datetime_col)
  formData.append('target_col', params.target_col)
  if (params.frequency) formData.append('frequency', params.frequency)
  if (params.covariate_cols && params.covariate_cols.length > 0) {
    formData.append('covariate_cols', JSON.stringify(params.covariate_cols))
  }

  const response = await fetch(`${BASE_URL}/datasets/upload/confirm`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Confirm failed' }))
    throw new Error(error.detail || `Confirm failed: ${response.status}`)
  }

  return response.json()
}

export async function runDiagnostics(
  data: TimeSeriesData,
  periodOverride?: number | null,
): Promise<DiagnosticsResponse> {
  return apiFetch('/diagnostics', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      period_override: periodOverride ?? undefined,
    }),
  })
}

export async function runBacktest(params: BacktestRequest): Promise<BacktestResponse> {
  return apiFetch('/backtest', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function runForecast(params: ForecastRequest): Promise<ForecastResponse> {
  return apiFetch('/forecast', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function exportXlsx(payload: {
  data: Record<string, unknown>
  diagnostics?: Record<string, unknown> | null
  backtest?: Record<string, unknown> | null
  forecast?: Record<string, unknown> | null
  sections?: string[]
  notes?: string
}): Promise<Blob> {
  const response = await fetch(`${BASE_URL}/export/xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Export failed')
  return response.blob()
}

export async function exportCsv(payload: {
  data: Record<string, unknown>
  backtest?: Record<string, unknown> | null
  forecast?: Record<string, unknown> | null
}): Promise<Blob> {
  const response = await fetch(`${BASE_URL}/export/csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('CSV export failed')
  return response.blob()
}

export async function fetchRunHistory(): Promise<{ entries: Record<string, string>[] }> {
  return apiFetch('/export/log')
}

export async function runPreprocessing(params: {
  values: number[]
  dates: string[]
  config: PreprocessingConfig
}): Promise<PreprocessedResult> {
  return apiFetch('/preprocessing', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function saveToLog(entry: Record<string, unknown>): Promise<{ status: string }> {
  return apiFetch('/export/log', {
    method: 'POST',
    body: JSON.stringify(entry),
  })
}

export async function deleteLogEntry(index: number): Promise<{ status: string }> {
  return apiFetch(`/export/log/${index}`, { method: 'DELETE' })
}

export async function clearLog(): Promise<{ status: string }> {
  return apiFetch('/export/log', { method: 'DELETE' })
}
