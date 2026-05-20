# Laplace — Backend

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![uv](https://img.shields.io/badge/uv-package%20manager-DE5FE9)](https://docs.astral.sh/uv)
[![Tests](https://img.shields.io/badge/tests-144%20passing-22C55E)](./tests)

FastAPI backend for the Laplace time series forecasting app. Handles dataset management, signal diagnostics, data preprocessing, rolling-origin backtesting, ensemble forecasting, and report export.

---

## Running Locally

```bash
# Install dependencies
uv sync

# Start with hot-reload
uv run uvicorn laplace.main:app --reload --port 8000
```

Interactive API docs: **[http://localhost:8000/docs](http://localhost:8000/docs)**

---

## API Endpoints

### Datasets

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/datasets` | List all 15 bundled datasets |
| `GET` | `/api/datasets/{name}` | Load a dataset as `TimeSeriesData` |
| `POST` | `/api/datasets/upload` | Upload CSV/XLSX — returns preview + auto-detected columns |
| `POST` | `/api/datasets/confirm` | Confirm preloaded dataset selection |
| `POST` | `/api/datasets/upload/confirm` | Confirm uploaded file with column mapping + optional covariates |

### Analysis

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/diagnostics` | STL + ACF/PACF + Forecastability Score + outlier/stationarity analysis |
| `POST` | `/api/preprocessing` | Apply outlier removal, smoothing, and/or differencing |
| `POST` | `/api/backtest` | Rolling-origin CV across 5 models (configurable folds, horizon, covariates) |
| `POST` | `/api/forecast` | Single-model or Ensemble forecast with 80%/90% prediction intervals |

### Export

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/export/xlsx` | 5-sheet formatted XLSX report |
| `POST` | `/api/export/csv` | Flat CSV with metrics + forecast values |
| `GET` | `/api/export/log` | Read saved run history |
| `POST` | `/api/export/log` | Append one result row to `results_log.csv` |

---

## Key Schemas

### Backtest

```json
// POST /api/backtest — Request
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
      "metrics": { "Chronos-2": { "smape": 4.8 } }
    }
  ]
}
```

### Forecast

```json
// POST /api/forecast — single model
{ "values": [112, 118, 132], "frequency": "M", "horizon": 12, "model_name": "Chronos-2" }

// Ensemble (requires backtest_metrics for weight computation)
{
  "values": [112, 118, 132],
  "frequency": "M",
  "horizon": 12,
  "model_name": "Ensemble",
  "backtest_metrics": { "Chronos-2": { "smape": 5.0, "mae": 20.0, "rmse": 24.8, "mase": 0.685 } },
  "covariates": { "temperature": [20.1, 21.3] },
  "future_covariates": { "temperature": [22.0, 22.5, 21.8] }
}

// Response
{
  "horizon": 12, "frequency": "M",
  "forecasts": [{
    "model_name": "Ensemble",
    "point_forecast": [450.1, 470.3, 488.9],
    "lo_80": [420.0, 438.0, 455.2], "hi_80": [480.0, 502.0, 522.6],
    "lo_90": [405.0, 422.0, 438.4], "hi_90": [495.0, 518.0, 539.4]
  }]
}
```

### Upload Confirm (multipart)

| Field | Required | Description |
|---|---|---|
| `file` | ✓ | CSV or XLSX, max 10MB |
| `datetime_col` | ✓ | Column containing timestamps |
| `target_col` | ✓ | Column to forecast |
| `frequency` | — | Override auto-detected freq (`H D W M Q Y`) |
| `covariate_cols` | — | JSON array: `'["temp","promo"]'` |

---

## Services

### `parser.py`
CSV/XLSX parsing, auto-detection of datetime/target columns, frequency inference (via `pd.infer_freq` + median-diff fallback), gap interpolation (up to 3 consecutive missing), and covariate column extraction. `validate_and_prepare()` aligns covariates with the validated date index and handles missing values.

### `diagnostics.py`
Full signal analysis: STL decomposition, ACF/PACF, rolling statistics, outlier detection (IQR), ADF + KPSS stationarity tests, and the 5-dimension Forecastability Score (0–100). Accepts an optional `period_override` parameter that propagates through STL, forecastability, and rolling stats — used by the Lab seasonality override control.

### `preprocessing.py`
Optional data preparation pipeline: outlier removal (IQR or Z-score, with interpolation or winsorisation), exponential/simple moving average smoothing, first/second-order differencing. Returns a `PreprocessedResult` with a log of applied operations and original values preserved.

### `forecasting.py`
Two foundation model singletons (loaded once, reused across requests):

- **`ChronosSingleton`** — `autogluon/chronos-2-small` via `BaseChronosPipeline`. MPS on Apple Silicon, CPU elsewhere. Cold start ~5s.
- **`TimesFMSingleton`** — `google/timesfm-2.0-500m-pytorch` (500M params, CPU). Cold start ~15s.

`run_statsforecast()` wraps `AutoETS`, `AutoTheta`, `SeasonalNaive` via StatsForecast. `run_all_models()` runs all five in sequence; individual failures are caught and logged without breaking the others.

### `ensemble.py`
Inverse-sMAPE weighted combination of any set of `ModelForecast` objects:

```
w_i = (1 / sMAPE_i) / Σ(1 / sMAPE_j)
```

A floor of `1e-3` prevents division by zero for near-perfect models. All five arrays (`point_forecast`, `lo_80`, `hi_80`, `lo_90`, `hi_90`) are combined with the same weights.

### `backtest.py`
Expanding-window cross-validation. Folds grow the training set forward in time — more realistic for production deployments where all historical data is always available. Covariate arrays are sliced at the same `train_end_idx` boundary as the target (no future leakage). Metrics: MAE, RMSE, MAPE, sMAPE, MASE (vs. Seasonal Naïve). Winner selected by lowest aggregate sMAPE.

### `export.py`
`openpyxl` 5-sheet XLSX workbook: Summary, Forecast, Backtest Metrics, Diagnostics, Raw Data. Results log (`results_log.csv`) append for cross-run comparison.

---

## Design Decisions

**Singleton model loading** — Foundation models are loaded at first request and kept in memory. Subsequent requests are ~200–500ms. This trades memory for latency — acceptable for a single-user desktop tool.

**Expanding vs. sliding window** — Folds grow the training set forward rather than sliding a fixed window. This matches how a production system would actually retrain: with all available history.

**sMAPE as winner-selection metric** — Symmetric, bounded [0, 200%], and defined when actuals contain zeros. Less sensitive to outlier actuals than MAPE.

**MASE baseline = Seasonal Naïve** — The academic standard (Hyndman & Koehler 2006). MASE < 1 means the model outperforms naïve seasonal repetition.

**Period override** — The diagnostics endpoint accepts `period_override: int | null`. This propagates to STL, forecastability scoring, and rolling stats — letting Lab users experiment with different seasonality hypotheses without modifying the frequency.

---

## Testing

```bash
# All tests
uv run pytest tests/ -v

# Skip slow model-inference tests
uv run pytest tests/ -v --ignore=tests/test_forecasting.py --ignore=tests/test_backtest.py

# Lint
uv run ruff check src/ tests/
```

| Test file | Count | Coverage |
|---|---|---|
| `test_health.py` | 1 | Health endpoint |
| `test_datasets.py` | 33 | 15 datasets · upload · column detection · covariate pipeline · domain checks |
| `test_diagnostics.py` | 28 | STL · ACF/PACF · forecastability · stationarity · period override |
| `test_ensemble.py` | 10 | Weight computation · weighted average · zero-sMAPE edge case |
| `test_forecasting_covariates.py` | 12 | Fold no-leakage · shape invariance · parser extraction |
| `test_preprocessing.py` | ~15 | Outlier removal · smoothing · differencing |
| `test_forecasting.py` | — | Chronos-2 + StatsForecast inference (slow — requires weights) |
| `test_backtest.py` | — | Rolling-origin CV end-to-end (slow) |
| `test_export.py` | ~10 | XLSX sheet structure · results log |

---

## Project Structure

```
backend/
├── pyproject.toml
├── scripts/
│   └── generate_datasets.py      Reproducible dataset generator (fixed numpy seeds)
└── src/laplace/
    ├── main.py                   FastAPI app + CORS middleware
    ├── config.py                 Pydantic BaseSettings (data_dir, etc.)
    ├── models/
    │   └── schemas.py            All Pydantic schemas + FREQUENCY_MAP + FREQ_TO_PANDAS
    ├── routers/
    │   ├── datasets.py
    │   ├── diagnostics.py
    │   ├── preprocessing.py
    │   ├── backtest.py
    │   ├── forecast.py
    │   └── export.py
    ├── services/
    │   ├── parser.py             Parsing · validation · covariate extraction
    │   ├── diagnostics.py        STL · ACF · forecastability · stationarity · period override
    │   ├── preprocessing.py      Outlier removal · smoothing · differencing
    │   ├── forecasting.py        Foundation model singletons + StatsForecast
    │   ├── ensemble.py           Inverse-sMAPE weighted combination
    │   ├── backtest.py           Expanding-window CV · metrics · winner selection
    │   └── export.py             XLSX workbook · results_log.csv
    └── data/preloaded/           15 CSV datasets across 10 domains
```
