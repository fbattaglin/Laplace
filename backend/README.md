# Laplace — Backend

FastAPI backend for the Laplace time series forecasting app. Exposes a REST API for dataset management, signal diagnostics, data preprocessing, rolling-origin backtesting, ensemble forecasting, and report export.

**Runtime:** Python 3.12 · FastAPI · uvicorn · uv

---

## Running Locally

```bash
# Install dependencies
uv sync

# Start with hot-reload
uv run uvicorn laplace.main:app --reload --port 8000
```

Interactive API docs: **http://localhost:8000/docs**

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/datasets` | List all 16 bundled datasets |
| `GET` | `/api/datasets/{name}` | Load a bundled dataset as `TimeSeriesData` |
| `POST` | `/api/datasets/upload` | Upload CSV or XLSX — returns preview + auto-detected columns |
| `POST` | `/api/datasets/confirm` | Validate preloaded dataset selection, return `TimeSeriesData` |
| `POST` | `/api/datasets/upload/confirm` | Confirm uploaded file with column mapping + optional covariates |
| `POST` | `/api/diagnostics` | STL + ACF/PACF + Forecastability Score + outlier/stationarity analysis |
| `POST` | `/api/preprocessing` | Apply outlier removal, smoothing, and/or differencing |
| `POST` | `/api/backtest` | Rolling-origin CV across 5 models (configurable folds, horizon, covariates) |
| `POST` | `/api/forecast` | Single-model or Ensemble forecast with 80%/90% prediction intervals |
| `POST` | `/api/export/xlsx` | Generate 5-sheet XLSX report (streaming download) |
| `POST` | `/api/export/csv` | Flat CSV with metrics + forecast values |
| `GET` | `/api/export/log` | Read `results_log.csv` entries |
| `POST` | `/api/export/log` | Append one result row to `results_log.csv` |

---

## Key Request / Response Shapes

### `POST /api/backtest`

```json
// Request
{
  "values": [112, 118, 132],
  "frequency": "M",
  "horizon": 12,
  "n_splits": 5,
  "covariates": { "temperature": [20.1, 21.3, 19.8] }
}

// Response
{
  "winner": "Chronos-2",
  "selection_metric": "smape",
  "horizon": 12,
  "n_splits": 5,
  "aggregate_metrics": {
    "Chronos-2":     { "smape": 5.0, "mae": 20.0, "rmse": 24.8, "mape": 4.5, "mase": 0.685 },
    "TimesFM":       { "smape": 6.2, "mae": 24.1, "rmse": 29.3, "mape": 5.8, "mase": 0.821 },
    "AutoETS":       { "smape": 7.1, "mae": 28.4, "rmse": 35.2, "mape": 6.8, "mase": 0.961 },
    "AutoTheta":     { "smape": 7.8, "mae": 30.2, "rmse": 37.5, "mape": 7.1, "mase": 1.024 },
    "SeasonalNaive": { "smape": 9.4, "mae": 36.8, "rmse": 44.1, "mape": 8.9, "mase": 1.248 }
  },
  "folds": [
    {
      "fold": 1,
      "train_end_idx": 108,
      "actual": [430, 445, 460],
      "forecasts": [{ "model_name": "Chronos-2", "point_forecast": [435, 450, 465], "..." }],
      "metrics": { "Chronos-2": { "smape": 4.8, "..." } }
    }
  ]
}
```

### `POST /api/forecast`

```json
// Request — single model
{
  "values": [112, 118, 132],
  "frequency": "M",
  "horizon": 12,
  "model_name": "Chronos-2"
}

// Request — Ensemble (requires backtest_metrics for weight computation)
{
  "values": [112, 118, 132],
  "frequency": "M",
  "horizon": 12,
  "model_name": "Ensemble",
  "backtest_metrics": {
    "Chronos-2": { "smape": 5.0, "mae": 20.0, "rmse": 24.8, "mase": 0.685 }
  },
  "covariates": { "temperature": [20.1, 21.3] },
  "future_covariates": { "temperature": [22.0, 22.5, 21.8] }
}

// Response
{
  "horizon": 12,
  "frequency": "M",
  "forecasts": [{
    "model_name": "Ensemble",
    "point_forecast": [450.1, 470.3, 488.9],
    "lo_80": [420.0, 438.0, 455.2],
    "hi_80": [480.0, 502.0, 522.6],
    "lo_90": [405.0, 422.0, 438.4],
    "hi_90": [495.0, 518.0, 539.4]
  }]
}
```

### `POST /api/datasets/upload/confirm`

Multipart form — sends file + column selections:

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | ✓ | CSV or XLSX (max 10MB) |
| `datetime_col` | string | ✓ | Column containing timestamps |
| `target_col` | string | ✓ | Column to forecast |
| `frequency` | string | — | Override auto-detected frequency (`H`, `D`, `W`, `M`, `Q`, `Y`) |
| `covariate_cols` | string | — | JSON array of additional numeric columns, e.g. `'["temp","promo"]'` |

---

## Services

### `parser.py`
CSV/XLSX parsing, auto-detection of datetime/target columns, frequency inference, gap interpolation, and covariate column extraction. `validate_and_prepare()` accepts optional `covariate_cols` — aligns them with the validated date index and handles missing values.

### `diagnostics.py`
Full signal analysis: STL decomposition (statsmodels), ACF/PACF, rolling statistics, outlier detection (IQR / Z-score), ADF + KPSS stationarity tests, and the composite Forecastability Score (5 dimensions, 0–100).

### `preprocessing.py`
Optional data preparation pipeline: outlier removal (IQR or Z-score, with interpolation or winsorisation), exponential/simple moving average smoothing, and differencing. Returns a `PreprocessedResult` with a log of applied operations.

### `forecasting.py`
Two foundation model singletons (loaded once, reused across requests):
- **`ChronosSingleton`** — `autogluon/chronos-2-small` via `BaseChronosPipeline`. MPS on Apple Silicon, CPU elsewhere.
- **`TimesFMSingleton`** — `google/timesfm-2.0-500m-pytorch` (500M params, CPU).

`run_statsforecast()` uses StatsForecast with `AutoETS`, `AutoTheta`, and `SeasonalNaive`. `run_all_models()` runs all five in sequence; failures are caught and logged individually.

All models accept `covariates` and `future_covariates` arguments and currently run univariate (graceful fallback with a log warning) — the infrastructure is in place for model-level exogenous variable support.

### `ensemble.py`
Inverse-sMAPE weighted combination of any set of `ModelForecast` objects. Weights are computed as `w_i = (1 / sMAPE_i) / Σ(1 / sMAPE_j)`. A floor of `_MIN_SMAPE = 1e-3` prevents division by zero for near-perfect models. All five arrays (`point_forecast`, `lo_80`, `hi_80`, `lo_90`, `hi_90`) are combined with the same weights.

### `backtest.py`
Expanding-window cross-validation. Folds grow the training set forward in time. Covariate arrays are sliced at the same `train_end_idx` boundary as the target (no leakage). Metrics: MAE, RMSE, MAPE, sMAPE, MASE (relative to seasonal naïve baseline). Winner selected by lowest aggregate sMAPE.

### `export.py`
`openpyxl` 5-sheet XLSX workbook: Summary, Forecast, Backtest Metrics, Diagnostics, Raw Data. `results_log.csv` append for cross-run comparison.

---

## Design Decisions

**Singleton model loading.** Foundation models are loaded once at first request and kept in memory. Cold start: ~5s (Chronos on MPS), ~15s (TimesFM on CPU). Subsequent requests: ~200–500ms.

**Expanding-window CV.** Folds grow the training set forward in time rather than sliding a fixed window — more realistic for production deployments where all historical data is always available. Folds are built from the end and reversed to preserve chronological display order.

**sMAPE as winner-selection metric.** Symmetric, bounded [0, 200%], and defined when actuals contain zeros. Less sensitive to outlier actuals than standard MAPE.

**MASE baseline = Seasonal Naïve.** The academic standard (Hyndman & Koehler 2006). MASE < 1 means the model outperforms naïve seasonal repetition.

**Covariate graceful fallback.** All models accept covariate arguments in the API. Current models run univariate and log an info message when covariates are provided. The schema and pipeline infrastructure is complete for future model-level exogenous support.

---

## Testing

```bash
# Run all tests
uv run pytest tests/ -v

# Exclude slow model-inference tests
uv run pytest tests/ -v --ignore=tests/test_forecasting.py --ignore=tests/test_backtest.py

# Lint
uv run ruff check src/ tests/
```

| Test file | Tests | Coverage |
|---|---|---|
| `test_health.py` | 1 | Health endpoint |
| `test_datasets.py` | 23 | All 16 datasets, upload, column detection, covariate columns, new domains |
| `test_diagnostics.py` | ~30 | STL, ACF/PACF, forecastability (all 5 dimensions), stationarity, outliers |
| `test_ensemble.py` | 10 | Weight computation, weighted average, edge cases (zero sMAPE, missing models) |
| `test_forecasting_covariates.py` | 12 | Covariate fold no-leakage, shape invariance, parser extraction, interpolation |
| `test_preprocessing.py` | ~15 | Outlier removal, smoothing, differencing |
| `test_forecasting.py` | — | Chronos-2 + StatsForecast inference (slow, requires model weights) |
| `test_backtest.py` | — | Rolling-origin CV end-to-end (slow) |
| `test_export.py` | ~10 | XLSX sheet structure, results log CSV |

---

## Project Structure

```
backend/
├── pyproject.toml
├── uv.lock
├── scripts/
│   └── generate_datasets.py      # Reproducible dataset generator (fixed numpy seeds)
└── src/laplace/
    ├── main.py                   # FastAPI app + CORS middleware
    ├── config.py                 # Pydantic BaseSettings (data_dir, etc.)
    ├── models/
    │   └── schemas.py            # All Pydantic schemas + FREQUENCY_MAP + FREQ_TO_PANDAS
    ├── routers/
    │   ├── datasets.py
    │   ├── diagnostics.py
    │   ├── preprocessing.py
    │   ├── backtest.py
    │   ├── forecast.py
    │   └── export.py
    ├── services/
    │   ├── parser.py             # Parsing, validation, covariate extraction
    │   ├── diagnostics.py        # STL, ACF, forecastability, stationarity, outliers
    │   ├── preprocessing.py      # Outlier removal, smoothing, differencing
    │   ├── forecasting.py        # Foundation model singletons + StatsForecast
    │   ├── ensemble.py           # Inverse-sMAPE weighted combination
    │   ├── backtest.py           # Expanding-window CV, metrics, winner selection
    │   └── export.py             # XLSX workbook, results_log.csv
    └── data/preloaded/           # 16 CSV datasets across 11 domains
```
