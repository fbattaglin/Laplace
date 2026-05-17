export type Step = 'dataInput' | 'diagnostics' | 'validation' | 'forecast' | 'export'

export const STEPS: Step[] = ['dataInput', 'diagnostics', 'validation', 'forecast', 'export']

export type Frequency = 'H' | 'D' | 'W' | 'M' | 'Q' | 'Y'

export interface TimeSeriesData {
  dates: string[]
  values: number[]
  frequency: Frequency
  name: string
  n_points: number
}

export interface DatasetMeta {
  name: string
  description: string
  frequency: Frequency
  n_rows: number
  columns: string[]
}

export interface ColumnDetection {
  datetime_col: string | null
  target_col: string | null
  confidence: number
}

export interface UploadResponse {
  columns: string[]
  dtypes: Record<string, string>
  preview_rows: Record<string, string | number | null>[]
  detected: ColumnDetection
  n_rows: number
}

export interface STLResult {
  observed: number[]
  trend: number[]
  seasonal: number[]
  residual: number[]
}

export interface ACFResult {
  acf_values: number[]
  pacf_values: number[]
  ci_upper: number
  ci_lower: number
  lags: number[]
}

export interface ForecastabilityDimension {
  name: string
  score: number
  weight: number
  description: string
}

export interface ForecastabilityResult {
  total_score: number
  interpretation: string
  dimensions: ForecastabilityDimension[]
  details: { trend_strength: number; seasonal_strength: number }
}

export interface DiagnosticsResponse {
  stl: STLResult
  acf_pacf: ACFResult
  forecastability: ForecastabilityResult
}

export interface ModelForecast {
  model_name: string
  point_forecast: number[]
  lo_90: number[]
  lo_80: number[]
  hi_80: number[]
  hi_90: number[]
}

export interface Metrics {
  mae: number
  rmse: number
  mape: number | null
  smape: number
  mase: number
}

export interface FoldResult {
  fold: number
  train_end_idx: number
  actual: number[]
  forecasts: ModelForecast[]
  metrics: Record<string, Metrics>
}

export interface BacktestResponse {
  folds: FoldResult[]
  aggregate_metrics: Record<string, Metrics>
  winner: string
  selection_metric: string
  horizon: number
  n_splits: number
}

export interface BacktestRequest {
  values: number[]
  frequency: Frequency
  horizon?: number
  n_splits?: number
}

export interface ForecastRequest {
  values: number[]
  frequency: Frequency
  horizon?: number
  model_name?: string
}

export interface ForecastResponse {
  forecasts: ModelForecast[]
  horizon: number
  frequency: Frequency
}

export const FREQUENCY_LABELS: Record<Frequency, { label: string; horizonDefault: number }> = {
  H: { label: 'hours', horizonDefault: 48 },
  D: { label: 'days', horizonDefault: 30 },
  W: { label: 'weeks', horizonDefault: 12 },
  M: { label: 'months', horizonDefault: 12 },
  Q: { label: 'quarters', horizonDefault: 4 },
  Y: { label: 'years', horizonDefault: 3 },
}
