export type Step = 'dataInput' | 'diagnostics' | 'validation' | 'forecast' | 'export'

export const STEPS: Step[] = ['dataInput', 'diagnostics', 'validation', 'forecast', 'export']

export type Frequency = 'H' | 'D' | 'W' | 'M' | 'Q' | 'Y'

export interface TimeSeriesData {
  dates: string[]
  values: number[]
  frequency: Frequency
  name: string
  n_points: number
  covariates?: Record<string, number[]> | null  // {col_name: [values...]} — Lab only
}

export interface DatasetMeta {
  name: string
  description: string
  frequency: Frequency
  n_rows: number
  columns: string[]
  domain?: string
  covariate_cols?: string[] | null  // declared covariate columns — present for 3 preloaded datasets
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

export interface DescriptiveStats {
  count: number
  mean: number
  std: number
  min: number
  q1: number
  median: number
  q3: number
  max: number
  skewness: number
  kurtosis: number
  cv: number
}

export interface HistogramBin {
  x: number
  count: number
}

export interface DistributionResult {
  histogram: HistogramBin[]
  normal_x: number[]
  normal_y: number[]
  mean: number
  std: number
}

export interface RollingStatsResult {
  rolling_mean: number[]
  rolling_std: number[]
  window: number
}

export interface OutlierResult {
  lower_bound: number
  upper_bound: number
  outlier_indices: number[]
  outlier_values: number[]
  n_outliers: number
}

export interface StationarityResult {
  adf_statistic: number
  adf_pvalue: number
  kpss_statistic: number
  kpss_pvalue: number
  is_stationary: boolean
  verdict: string
  differenced: number[]
}

export interface DiagnosticsResponse {
  stl: STLResult
  acf_pacf: ACFResult
  forecastability: ForecastabilityResult
  descriptive_stats?: DescriptiveStats
  distribution?: DistributionResult
  rolling_stats?: RollingStatsResult
  outliers?: OutlierResult
  stationarity?: StationarityResult
}

export interface PreprocessingConfig {
  remove_outliers: boolean
  outlier_method: 'iqr' | 'zscore'
  outlier_replacement: 'interpolate' | 'winsorize'
  smooth: boolean
  smooth_method: 'sma' | 'ema'
  smooth_window: number | null
  difference: boolean
  difference_order: number
}

export interface PreprocessingStep {
  operation: string
  description: string
  points_affected: number
}

export interface PreprocessedResult {
  values: number[]
  dates: string[]
  original_values: number[]
  original_dates: string[]
  log: PreprocessingStep[]
  n_outliers_removed: number
  n_points_removed: number
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
  backtest_metrics?: Record<string, Metrics>          // required for Ensemble model
  covariates?: Record<string, number[]> | null        // historical exogenous values
  future_covariates?: Record<string, number[]> | null // horizon-length exogenous values
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
