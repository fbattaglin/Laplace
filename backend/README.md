# Laplace — Backend

FastAPI backend for the Laplace time series forecasting app. Exposes a REST API for dataset management, signal diagnostics, rolling-origin backtesting, forecasting, and report export.

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
| `GET` | `/api/datasets` | List all 3 bundled datasets |
| `GET` | `/api/datasets/{name}` | Load a bundled dataset as `TimeSeriesData` |
| `POST` | `/api/datasets/upload` | Upload CSV or XLSX — returns preview + auto-detected columns |
| `POST` | `/api/datasets/confirm` | Validate columns and return prepared `TimeSeriesData` |
| `POST` | `/api/diagnostics` | STL decomposition + ACF/PACF + Forecastability Score |
| `POST` | `/api/backtest` | Rolling-origin cross-validation across 4 models |
| `POST` | `/api/forecast` | Single forecast with 80%/90% prediction intervals |
| `POST` | `/api/export/xlsx` | Generate 5-sheet XLSX report (streaming download) |
| `POST` | `/api/export/log` | Append one result row to `results_log.csv` |

---

## Key Request/Response Shapes

### `POST /api/backtest`

**Request:**
```json
{
  "values": [112, 118, 132, "..."],
  "frequency": "M",
  "horizon": 12,
  "n_splits": 5
}
```

**Response:**
```json
{
  "winner": "Chronos-Bolt",
  "selection_metric": "smape",
  "horizon": 12,
  "n_splits": 5,
  "aggregate_metrics": {
    "Chronos-Bolt": { "smape": 5.0, "mae": 20.02, "rmse": 24.83, "mape": 4.5, "mase": 0.685 },
    "AutoETS":      { "smape": 7.1, "mae": 28.4,  "rmse": 35.2,  "mape": 6.8, "mase": 0.961 }
  },
  "folds": ["..."]
}
```

### `POST /api/forecast`

**Request:**
```json
{
  "values": [112, 118, 132, "..."],
  "frequency": "M",
  "horizon": 12,
  "model_name": "Chronos-Bolt"
}
```

**Response:**
```json
{
  "horizon": 12,
  "frequency": "M",
  "forecasts": [{
    "model_name": "Chronos-Bolt",
    "point_forecast": [450.1, 470.3, "..."],
    "lo_80": [420.0, 438.0, "..."],
    "hi_80": [480.0, 502.0, "..."],
    "lo_90": [405.0, 420.0, "..."],
    "hi_90": [495.0, 520.0, "..."]
  }]
}
```

---

## Design Decisions

**Chronos singleton.** `ChronosSingleton.get_pipeline()` loads the model once at first request and reuses the in-memory instance. Cold start: ~5s on MPS (Apple Silicon). Subsequent requests: ~200ms.

**Expanding-window cross-validation.** Folds grow the training set forward in time rather than sliding a fixed window. More realistic for real-world series where all historical data is available at each deployment point. Folds are built from the end and reversed to preserve chronological order.

**MASE baseline = Seasonal Naïve.** The academic standard (Hyndman & Koehler 2006). A MASE < 1 means the model outperforms naïve seasonal repetition. MASE is scale-free and comparable across series.

**sMAPE as winner-selection metric.** Symmetric, bounded [0, 200%], and defined even when actuals contain zeros. Less sensitive to outlier actuals than standard MAPE.

**MAPE suppressed for zero-containing series.** If any actual value is zero or near-zero, MAPE returns `null` to avoid division artifacts.

---

## Testing

```bash
# Run all backend tests
uv run pytest tests/ -v

# Lint
uv run ruff check src/ tests/
```

| Test file | Coverage |
|---|---|
| `test_health.py` | Health endpoint |
| `test_datasets.py` | Dataset loading, upload, column detection, frequency inference |
| `test_diagnostics.py` | STL, ACF/PACF, forecastability (all 5 dimensions) |
| `test_forecasting.py` | Chronos + StatsForecast inference, horizons, prediction intervals |
| `test_backtest.py` | Metrics computation, rolling-origin CV, winner selection |
| `test_export.py` | XLSX structure, results log CSV |
| `test_forecast_endpoint.py` | API-level backtest + forecast endpoint tests |

---

## Project Structure

```
backend/
├── pyproject.toml
├── uv.lock
└── src/laplace/
    ├── main.py               # FastAPI app + CORS middleware
    ├── config.py             # Pydantic BaseSettings
    ├── models/
    │   └── schemas.py        # All Pydantic schemas + frequency maps
    ├── routers/
    │   ├── datasets.py
    │   ├── diagnostics.py
    │   ├── backtest.py
    │   ├── forecast.py
    │   └── export.py
    ├── services/
    │   ├── parser.py         # CSV/XLSX parsing, gap interpolation, column detection
    │   ├── diagnostics.py    # STL (statsmodels), ACF/PACF, forecastability composite score
    │   ├── forecasting.py    # Chronos-Bolt singleton, AutoETS/AutoTheta/SeasonalNaive
    │   ├── backtest.py       # Expanding-window CV, 5 metrics, winner selection
    │   └── export.py         # openpyxl 5-sheet workbook, results_log.csv append
    └── data/preloaded/
        ├── airline_passengers.csv
        ├── sunspots.csv
        └── energy_demand.csv
```
