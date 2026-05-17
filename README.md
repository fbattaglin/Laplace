# Laplace

**Can you predict it? And which model does it best?**

Laplace is a desktop-first time series forecasting app that benchmarks Amazon's Chronos-2-Small foundation model against three classical baselines — AutoETS, AutoTheta, and Seasonal Naïve — on any time series you bring. It gives you a rigorous, reproducible answer to the question every forecast analyst eventually asks: *is a zero-shot deep learning model actually better than a well-tuned classical one?*

Named after [Laplace's Demon](https://en.wikipedia.org/wiki/Laplace%27s_demon): given a complete history, how well can we predict the future?

---

## The Approach

Most forecasting tools tell you *what* the forecast is. Laplace tells you *whether* forecasting is worth doing in the first place, and *which model* earns the right to do it.

The workflow starts with a **Forecastability Score** — a signal-theoretic assessment of how predictable your series is — before running a single model. If the score is low, you know to treat the forecast intervals with humility. If it's high, you can trust the winner's output.

The model comparison uses **rolling-origin cross-validation**: the dataset is split into expanding training windows, each model is evaluated on held-out future periods, and the winner is selected by sMAPE across all folds — not a single train/test split.

### Foundation Model vs. Classical Baselines

| Model | Type | Description |
|---|---|---|
| **Chronos-2-Small** | Foundation model (48M params) | A language model for numbers, pretrained on millions of real-world time series. Zero-shot — no fine-tuning required. Uses Apple MPS on M-series chips. |
| **AutoETS** | Classical (exponential smoothing) | Automatically selects error/trend/seasonal structure (ETS) via AIC. Handles additive and multiplicative seasonality. |
| **AutoTheta** | Classical (Theta decomposition) | Decomposes the series into two θ-lines. Strong on trended data with moderate seasonality. |
| **Seasonal Naïve** | Baseline | Repeats the last observed seasonal cycle. The floor: any serious model should beat this. |

Chronos produces native **80% and 90% prediction intervals** (quantile regression). Classical models use StatsForecast's native interval estimation.

---

## 5-Step Workflow

```
Load Data → Diagnose → Compare Models → Forecast → Export
```

1. **Load Data** — Pick a bundled dataset or upload your own CSV/XLSX. Auto-detects datetime and target columns.
2. **Analyze Patterns** — STL decomposition, ACF/PACF charts, and a Forecastability Score.
3. **Compare Models** — Rolling-origin backtest across 4 models × 5 folds. Metrics table + overlay chart.
4. **Forecast** — Generate a forward-looking prediction with 80%/90% confidence bands using any model.
5. **Export** — Download a formatted 5-sheet XLSX report and/or append results to a `results_log.csv` for cross-run comparison.

The app has a **Boardroom / Lab** toggle in the header — switch to plain-language mode for presentations, or to full statistical nomenclature for analysis.

---

## Forecastability Score

Before fitting any model, Laplace computes a 0–100 score from five dimensions:

| Dimension | Weight | What It Measures |
|---|---|---|
| Signal Strength | 40% | Ratio of trend + seasonal variance to total variance (Hyndman STL decomposition) |
| Regularity | 25% | Inverse spectral entropy — how concentrated the frequency spectrum is |
| Stationarity | 15% | Combined ADF + KPSS test result |
| Sample Adequacy | 10% | Whether you have ≥ 3× the seasonal period in observations |
| Noise Level | 10% | STL remainder variance relative to total variance |

**Interpretation:** ≥ 70 = High (strong learnable patterns), 45–69 = Moderate (some structure), < 45 = Low (noise-dominated, expect wide intervals).

---

## Metrics

| Metric | Plain English | Formula | Caveat |
|---|---|---|---|
| **sMAPE** | Symmetric percentage error (selection metric) | `2 × |y - ŷ| / (|y| + |ŷ|)` × 100 | Bounded, symmetric. Works when actuals include zeros. |
| **MAE** | Average absolute error in original units | `mean(|y - ŷ|)` | Scale-dependent. |
| **RMSE** | Same as MAE but penalises large errors more | `sqrt(mean((y - ŷ)²))` | More sensitive to outliers than MAE. |
| **MAPE** | Percentage error | `mean(|y - ŷ| / y)` × 100 | Undefined when actuals contain zeros; hidden when applicable. |
| **MASE** | Error relative to naïve seasonal repetition | `MAE / MAE_seasonal_naïve` | < 1 means the model beats naïve repetition. The gold standard for cross-series comparison. |

**Winner selection:** sMAPE, because it's symmetric, percentage-based, and handles zero-valued series cleanly.

---

## Supported Frequencies

| Code | Name | Season Length | Default Forecast Horizon |
|---|---|---|---|
| H | Hourly | 24 | 48 hours |
| D | Daily | 7 | 30 days |
| W | Weekly | 52 | 12 weeks |
| M | Monthly | 12 | 12 months |
| Q | Quarterly | 4 | 4 quarters |
| Y | Annual | 1 (no seasonality) | 3 years |

The season length drives STL decomposition, MASE baseline, and cross-validation fold sizing.

---

## Quick Start

**Prerequisites:** Python 3.12+, Node.js 20+, [uv](https://docs.astral.sh/uv/)

```bash
# Clone and run first-time setup (installs deps + downloads Chronos-2 ~500MB)
git clone https://github.com/fbattaglin/Laplace.git
cd Laplace
./scripts/setup.sh

# Start both servers
./scripts/dev.sh
```

Open **http://localhost:5173** in your browser.

> **Apple Silicon:** Chronos-2 uses MPS acceleration automatically on M-series chips. First run downloads the model weights (~500MB, cached locally after that).

---

## API Reference

The backend exposes a REST API at `http://localhost:8000`. Full interactive docs at `/docs`.

### `GET /api/datasets`
Returns the 3 bundled datasets with metadata.

### `GET /api/datasets/{name}`
Returns a prepared `TimeSeriesData` object (dates, values, frequency, n_points).

### `POST /api/datasets/upload`
Accepts CSV or XLSX (multipart). Returns column list, dtypes, preview rows, and auto-detected datetime/target columns.

### `POST /api/datasets/confirm`
```json
{
  "source": "preloaded",
  "dataset_name": "airline_passengers",
  "datetime_col": "date",
  "target_col": "passengers",
  "frequency": "M"
}
```

### `POST /api/diagnostics`
```json
{ "values": [112, 118, ...], "frequency": "M", "name": "airline_passengers", "n_points": 144, "dates": ["1949-01-01", ...] }
```
Returns `{ stl, acf_pacf, forecastability }`.

### `POST /api/backtest`
```json
{ "values": [...], "frequency": "M", "horizon": 12, "n_splits": 5 }
```
Returns aggregate metrics per model, fold-level results, and the winner.

### `POST /api/forecast`
```json
{ "values": [...], "frequency": "M", "horizon": 12, "model_name": "Chronos-2" }
```
Returns point forecast + `lo_80`, `hi_80`, `lo_90`, `hi_90` arrays.

### `POST /api/export/xlsx`
Returns a streaming XLSX file with 5 sheets: Summary, Forecast, Backtest Metrics, Diagnostics, Raw Data.

### `POST /api/export/log`
Appends one row to `results_log.csv` (timestamp, dataset, model, metrics, horizon, forecastability score).

---

## Bundled Datasets

| Dataset | Series | Frequency | Points | Source |
|---|---|---|---|---|
| `airline_passengers` | International airline passengers | Monthly | 144 | Box & Jenkins (1949–1960) |
| `sunspots` | Monthly mean sunspot numbers | Monthly | ~2820 | SILSO (1749–1983) |
| `energy_demand` | Hourly energy demand | Hourly | 1000 | Synthetic |

---

## Project Structure

```
Laplace/
├── scripts/
│   ├── setup.sh          # First-time: uv sync + npm install + model cache
│   ├── dev.sh            # Start backend (:8000) + frontend (:5173)
│   ├── test-all.sh       # Run all tests (backend + frontend)
│   └── check.sh          # Lint (ruff) + type check (tsc)
│
├── backend/
│   ├── pyproject.toml
│   └── src/laplace/
│       ├── main.py           # FastAPI app + CORS
│       ├── config.py         # Settings (BaseSettings)
│       ├── routers/          # datasets, diagnostics, backtest, forecast, export
│       ├── services/
│       │   ├── parser.py         # CSV/XLSX parsing, column detection
│       │   ├── diagnostics.py    # STL, ACF/PACF, forecastability score
│       │   ├── forecasting.py    # Chronos singleton + StatsForecast
│       │   ├── backtest.py       # Rolling-origin CV, metrics, winner selection
│       │   └── export.py         # XLSX workbook + results log
│       ├── models/schemas.py     # All Pydantic schemas
│       └── data/preloaded/       # airline_passengers, sunspots, energy_demand CSVs
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── data-input/       # DataInputScreen, DatasetPicker, FileUploader, ColumnMapper
│       │   ├── diagnostics/      # DiagnosticsScreen, STLChart, ACFChart, ForecastabilityGauge
│       │   ├── validation/       # ValidationScreen, MetricsTable, BacktestChart
│       │   ├── forecast/         # ForecastScreen, ForecastChart
│       │   ├── export/           # ExportScreen
│       │   └── layout/           # AppShell, StepNav, ErrorBoundary
│       ├── stores/useAppStore.ts  # Zustand + sessionStorage persistence
│       ├── hooks/useApi.ts        # TanStack Query hooks
│       └── lib/copy.ts            # Boardroom/Lab text dictionary
│
└── results_log.csv               # Created on first export (gitignored)
```

---

## Testing

```bash
# Backend: 66 tests (pytest)
./scripts/test-all.sh

# Lint + TypeScript
./scripts/check.sh

# E2E (requires dev servers running)
cd frontend && npx playwright test
```

Test coverage: dataset loading and parsing, diagnostics (STL, ACF, forecastability scoring), all 4 forecasting models, rolling-origin CV, metrics computation, XLSX export, results log, API endpoints, and a full wizard flow E2E test.

---

## Development

```bash
# Backend only
cd backend && uv run uvicorn laplace.main:app --reload --port 8000

# Frontend only
cd frontend && npm run dev

# Both together
./scripts/dev.sh
```

**Stack:** FastAPI · uvicorn · Pydantic v2 · pandas · statsmodels · scipy · chronos-forecasting · statsforecast · torch / React 19 · Vite · TypeScript · Tailwind CSS 3 · Recharts · TanStack Query · Zustand
