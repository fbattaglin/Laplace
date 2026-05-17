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
  problem_statement?: string;
  tags?: string[];
}

export interface DatasetResponse {
  columns: string[];
  suggested_date_col: string | null;
  suggested_target_col: string | null;
  total_rows: number;
  preview_data: any[];   // first 15 rows for the table
  chart_data: any[];     // up to 300 evenly-sampled rows for the full-fidelity chart
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
  anomalies: number[];
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
