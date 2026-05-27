const API_BASE = "http://127.0.0.1:8000/api";

const extractError = (errorData: any, defaultMsg: string): string => {
  if (errorData && typeof errorData.detail === 'string') {
    return errorData.detail;
  } else if (errorData && Array.isArray(errorData.detail)) {
    return JSON.stringify(errorData.detail);
  }
  return defaultMsg;
};
export interface DatasetInfo {
  name: string;
  description: string;
  problem_statement: string;
  tags: string[];
  has_covariates?: boolean;
}

export interface DatasetResponse {
  columns: string[];
  suggested_date_col: string | null;
  suggested_target_col: string | null;
  total_rows: number;
  preview_data: any[];   // first 15 rows for the table
  chart_data: any[];     // up to 300 evenly-sampled rows for the full-fidelity chart
  covariate_candidates?: Array<{
    column: string;
    correlation: number;
    suggested_type: string;
  }>;
}

export async function fetchDatasets() {
  const res = await fetch(`${API_BASE}/datasets`);
  if (!res.ok) throw new Error("Failed to fetch datasets");
  return res.json();
}

export async function loadDataset(name: string): Promise<DatasetResponse> {
  const res = await fetch(`${API_BASE}/datasets/${name}`);
  if (!res.ok) throw new Error("Failed to load dataset");
  return res.json();
}

export async function uploadDataset(file: File): Promise<DatasetResponse> {
  const formData = new FormData();
  formData.append("file", file);
  
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload dataset");
  return res.json();
}

export interface CleanRequest {
  dataset_type: string;
  dataset_name: string;
  date_col: string;
  target_col: string;
  config: any[];
  excluded_anomalies?: number[];
}

export interface CleanResponse {
  cleaned_data: number[];
  variance_params: any;
  steps_log: string[];
}

export async function cleanData(req: CleanRequest): Promise<CleanResponse> {
  const res = await fetch(`${API_BASE}/clean`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Failed to clean data");
  return res.json();
}

export interface AnomalyRequest {
  dataset_type: string;
  dataset_name: string;
  date_col: string;
  target_col: string;
  method?: string;
  threshold?: number;
}

export interface AnomalyResponse {
  engine: string;
  threshold: number;
  count: number;
  anomalies: any[];
}

export async function detectAnomalies(req: AnomalyRequest): Promise<AnomalyResponse> {
  const res = await fetch(`${API_BASE}/anomalies/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Failed to detect anomalies");
  return res.json();
}

export interface DiagnosticsRequest {
  dataset_type: string;
  dataset_name: string;
  date_col: string;
  target_col: string;
}

export interface DiagnosticsResponse {
  dates: string[];
  stats: {
    start_date: string;
    end_date: string;
    count: number;
    missing_pct: number;
    zeros_pct: number;
    mean: number;
    std: number;
    min: number;
    max: number;
    skewness: number;
    kurtosis: number;
  };
  adf_test: {
    is_stationary: boolean;
    p_value: number;
    test_statistic: number;
  };
  anomalies: any[];
  changepoints: number[];
  stl: {
    observed: number[];
    trend: number[];
    seasonal: number[];
    resid: number[];
  };
  forecastability: {
    score: number;
    label: string;
    trend_strength: number;
    seasonal_strength: number;
  };
  acf: number[];
  pacf: number[];
  covariates?: Array<{
    column: string;
    correlation: number;
    suggested_type: string;
  }>;
}

export async function runDiagnostics(req: DiagnosticsRequest): Promise<DiagnosticsResponse> {
  const res = await fetch(`${API_BASE}/diagnostics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Failed to run diagnostics");
  return res.json();
}

export interface ValidationRequest {
  dataset_type: string;
  dataset_name: string;
  date_col: string;
  target_col: string;
  horizon?: number;
  selected_models?: string[];
  covariate_cols?: string[];
  cleaning_config?: any[];
  excluded_anomalies?: number[];
}

export interface ModelMetrics {
  model: string;
  sMAPE: number;
  MASE: number;
  RMSE: number;
}

export interface ValidationResponse {
  horizon: number;
  metrics: ModelMetrics[];
  predictions: {
    dates: string[];
    actual: number[];
    [model_name: string]: string[] | number[];
  };
  history: {
    dates: string[];
    actual: number[];
  };
}

export async function runValidation(req: ValidationRequest): Promise<ValidationResponse> {
  const res = await fetch(`${API_BASE}/validation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(extractError(errorData, "Failed to run backtest validation"));
  }
  return res.json();
}

export interface ForecastRequest {
  dataset_type: string;
  dataset_name: string;
  date_col: string;
  target_col: string;
  model_name: string;
  horizon?: number;
  covariate_cols?: string[];
  cleaning_config?: any[];
  excluded_anomalies?: number[];
}

export interface ForecastResponse {
  model: string;
  horizon: number;
  history: {
    dates: string[];
    actual: number[];
  };
  forecast: {
    dates: string[];
    mean: number[];
    lower: number[];
    upper: number[];
  };
}

export async function runForecast(req: ForecastRequest): Promise<ForecastResponse> {
  const res = await fetch(`${API_BASE}/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(extractError(errorData, "Failed to run forecast"));
  }
  return res.json();
}
