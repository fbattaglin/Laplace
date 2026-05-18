# Laplace

**Can you predict it? And which model does it best?**

Laplace is a desktop-first time series forecasting app for analysts. It benchmarks two foundation models — Amazon Chronos-2 and Google TimesFM — against three classical baselines on any series you bring, using rigorous rolling-origin cross-validation. It then produces a forward-looking forecast with 80%/90% prediction intervals.

Named after [Laplace's Demon](https://en.wikipedia.org/wiki/Laplace%27s_demon): given a complete history, how well can we predict the future?

---

## The Approach

Most forecasting tools tell you *what* the forecast is. Laplace tells you *whether* forecasting is worth doing in the first place, and *which model* earns the right to do it.

The workflow starts with a **Forecastability Score** — a signal-theoretic assessment of how predictable your series is — before running a single model. If the score is low, you know to treat the forecast intervals with humility. If it's high, you can trust the winner's output.

Model comparison uses **rolling-origin cross-validation**: the dataset is split into expanding training windows, each model is evaluated on held-out future periods, and the winner is selected by sMAPE across all folds — not a single train/test split.

---

## Models

| Model | Type | Parameters | Description |
|---|---|---|---|
| **Chronos-2** | Foundation model | ~120M | Amazon's language model for time series, pretrained on millions of real-world series. Zero-shot. Uses Apple MPS on M-series chips. |
| **TimesFM 2.0** | Foundation model | 500M | Google's patched-time-series transformer. Zero-shot. |
| **AutoETS** | Classical | — | Automatically selects error/trend/seasonal structure via AIC. Handles additive and multiplicative seasonality. |
| **AutoTheta** | Classical | — | Theta decomposition. Strong on trended data with moderate seasonality. |
| **Seasonal Naïve** | Baseline | — | Repeats the last observed seasonal cycle. The floor — any serious model should beat this. |
| **Ensemble** *(Lab)* | Combined | — | Inverse-sMAPE weighted average of all five models. Weights are computed from the backtest and shown in the UI. |

All models produce native **80% and 90% prediction intervals**.

---

## 5-Step Workflow

```
Load Data → Diagnose → Compare Models → Forecast → Export
```

1. **Load Data** — Pick one of 16 bundled datasets or upload your own CSV/XLSX. Auto-detects datetime and target columns. In Lab mode, select additional columns as exogenous covariates.
2. **Diagnose** — STL decomposition, ACF/PACF, descriptive stats, rolling stats, outlier detection, stationarity tests, and a Forecastability Score. In Lab mode: preprocess the series (outlier removal, smoothing, differencing) before modelling.
3. **Compare Models** — Rolling-origin backtest across 5 models. Configurable folds and horizon in Lab mode. Per-fold breakdown available.
4. **Forecast** — Generate a forward prediction with confidence bands. Download results as CSV directly from the chart. In Lab mode, configure future values for each covariate.
5. **Export** — Download a formatted 5-sheet XLSX report and/or append results to `results_log.csv` for cross-run comparison.

The app has a **Boardroom / Lab** toggle — switch to plain-language mode for presentations, or to full analyst mode for deep control.

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

| Metric | Plain English | Caveat |
|---|---|---|
| **sMAPE** | Symmetric percentage error — **winner-selection metric** | Bounded, symmetric. Defined even when actuals contain zeros. |
| **MAE** | Average absolute error in original units | Scale-dependent. |
| **RMSE** | Like MAE but penalises large errors more | More sensitive to outliers. |
| **MAPE** | Percentage error | Hidden when actuals contain zeros (division undefined). |
| **MASE** | Error relative to naïve seasonal repetition (< 1 = beats naïve) | Scale-free; the academic standard for cross-series comparison. |

---

## Supported Frequencies

| Code | Name | Season Length | Default Horizon |
|---|---|---|---|
| H | Hourly | 24 | 48 hours |
| D | Daily | 7 | 30 days |
| W | Weekly | 52 | 12 weeks |
| M | Monthly | 12 | 12 months |
| Q | Quarterly | 4 | 4 quarters |
| Y | Annual | 1 | 3 years |

---

## Quick Start

**Prerequisites:** Python 3.12+, Node.js 20+, [uv](https://docs.astral.sh/uv/)

```bash
git clone https://github.com/fbattaglin/Laplace.git
cd Laplace

# Install all dependencies (backend + frontend) and cache Chronos weights (~500MB, one-time)
./scripts/setup.sh

# Start both servers
./scripts/dev.sh
```

Open **http://localhost:5173** in your browser.

> **Apple Silicon:** Chronos-2 uses MPS acceleration automatically on M-series chips. First run downloads model weights (~500MB, cached locally after that). TimesFM runs on CPU.

---

## Bundled Datasets (16)

| # | Key | Freq | Points | Domain | Covariates |
|---|---|---|---|---|---|
| 1 | `airline_passengers` | M | 144 | Transport | — |
| 2 | `sunspots` | M | ~2820 | Science | — |
| 3 | `energy_demand` | H | 1000 | Energy | — |
| 4 | `electricity_price_de` | D | ~730 | Energy | — |
| 5 | `energy_demand_temp` | D | 1000 | Energy | temperature_c, humidity_pct |
| 6 | `us_unemployment` | M | ~240 | Economics | — |
| 7 | `us_cpi` | M | 300 | Economics | — |
| 8 | `us_retail_sales` | M | ~295 | Retail | — |
| 9 | `supermarket_weekly` | W | 200 | Retail | promo_flag, competitor_price |
| 10 | `bike_rentals` | D | 730 | Transport | temperature, humidity, windspeed |
| 11 | `aus_beer_production` | Q | ~129 | Manufacturing | — |
| 12 | `daily_temp_melbourne` | D | ~3650 | Climate | — |
| 13 | `co2_atmospheric` | M | 780 | Environment | — |
| 14 | `hospital_admissions` | W | ~260 | Healthcare | — |
| 15 | `gold_price_usd` | M | 420 | Finance | — |
| 16 | `web_traffic` | D | ~730 | Digital | — |

Datasets 5, 9, and 10 have multiple numeric columns — these activate the **covariate selector** in Lab mode.

A `sample_datasets/` folder at the project root contains 5 test CSV files for manual upload testing (including covariate-heavy examples).

---

## API Reference

Full interactive docs at **http://localhost:8000/docs**. Key endpoints:

### Dataset Management

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/datasets` | List all 16 bundled datasets |
| `GET` | `/api/datasets/{name}` | Load a dataset as `TimeSeriesData` |
| `POST` | `/api/datasets/upload` | Upload CSV/XLSX — returns preview + auto-detected columns |
| `POST` | `/api/datasets/confirm` | Validate preloaded dataset selection |
| `POST` | `/api/datasets/upload/confirm` | Confirm uploaded file with column mapping and optional covariates |

### Analysis

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/diagnostics` | STL + ACF/PACF + Forecastability Score + outlier/stationarity analysis |
| `POST` | `/api/preprocessing` | Apply outlier removal, smoothing, or differencing |
| `POST` | `/api/backtest` | Rolling-origin CV (configurable folds, horizon, covariates) |
| `POST` | `/api/forecast` | Single model forecast or Ensemble (with backtest_metrics for weights) |

### Export

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/export/xlsx` | 5-sheet formatted XLSX report |
| `POST` | `/api/export/csv` | Flat CSV with metrics + forecast |
| `GET/POST` | `/api/export/log` | Read or append `results_log.csv` |

### Backtest request shape
```json
{
  "values": [112, 118, 132, "..."],
  "frequency": "M",
  "horizon": 12,
  "n_splits": 5,
  "covariates": { "temperature": [20.1, 21.3, "..."] }
}
```

### Forecast request shape
```json
{
  "values": [112, 118, 132, "..."],
  "frequency": "M",
  "horizon": 12,
  "model_name": "Ensemble",
  "backtest_metrics": {
    "Chronos-2": { "smape": 5.0, "mae": 20.0, "rmse": 24.8, "mase": 0.68 }
  },
  "covariates": { "temperature": [20.1, "..."] },
  "future_covariates": { "temperature": [22.0, 22.5, "..."] }
}
```

---

## Project Structure

```
Laplace/
├── scripts/
│   ├── setup.sh              # First-time: uv sync + npm install + model weights
│   ├── dev.sh                # Start backend (:8000) + frontend (:5173)
│   ├── test-all.sh           # Run all tests
│   └── check.sh              # Lint (ruff) + type check (tsc --noEmit)
│
├── sample_datasets/          # Test CSVs for manual upload testing
│   ├── bike_rentals_sample.csv      (date, count, temp, humidity, windspeed)
│   ├── retail_with_promo.csv        (date, sales, promo_flag, holiday_flag)
│   ├── energy_temp_humidity.csv     (date, demand, temperature, humidity)
│   ├── single_series_clean.csv      (date, value — no covariates)
│   └── single_series_noisy.csv      (date, value — outliers + non-stationary)
│
├── backend/
│   ├── pyproject.toml
│   ├── scripts/
│   │   └── generate_datasets.py    # Reproducible dataset generator (fixed seeds)
│   └── src/laplace/
│       ├── main.py
│       ├── config.py
│       ├── models/schemas.py       # All Pydantic schemas + frequency maps
│       ├── routers/                # datasets, diagnostics, backtest, forecast, export, preprocessing
│       ├── services/
│       │   ├── parser.py           # CSV/XLSX parsing, column detection, covariate extraction
│       │   ├── diagnostics.py      # STL, ACF/PACF, forecastability, outliers, stationarity
│       │   ├── preprocessing.py    # Outlier removal, smoothing, differencing
│       │   ├── forecasting.py      # Chronos-2 + TimesFM singletons + StatsForecast
│       │   ├── ensemble.py         # Inverse-sMAPE weighted combination
│       │   ├── backtest.py         # Expanding-window CV, 5 metrics, winner selection
│       │   └── export.py           # openpyxl workbook + results_log.csv
│       └── data/preloaded/         # 16 CSV datasets
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── layout/             # AppShell, StepNav, PreprocessingBanner
│       │   ├── data-input/         # DataInputScreen, DatasetPicker, FileUploader, ColumnMapper
│       │   ├── diagnostics/        # DiagnosticsScreen, DataPrepPanel, STLChart, ACFChart
│       │   ├── validation/         # ValidationScreen, BacktestConfigPanel, FoldDetail, MetricsTable, BacktestChart
│       │   ├── forecast/           # ForecastScreen, EnsembleWeights, FutureCovariatesPanel, ForecastChart
│       │   └── export/             # ExportScreen, ReportBuilder, RunHistory
│       ├── stores/useAppStore.ts   # Zustand: step, mode, data, preprocessing, backtestConfig, forecastResult
│       ├── hooks/useApi.ts         # TanStack Query hooks (cache-keyed by preprocessing hash + backtest config)
│       ├── api/client.ts           # Typed fetch wrappers
│       ├── types/index.ts          # All TypeScript interfaces
│       └── lib/                    # copy.ts (Boardroom/Lab text), colors.ts, utils.ts
│
└── results_log.csv                 # Created on first export (gitignored)
```

---

## Testing

```bash
# Backend (104 unit tests)
cd backend && uv run pytest tests/ -v

# TypeScript check
cd frontend && npx tsc --noEmit

# Production build
cd frontend && npm run build
```

| Backend test file | What it covers |
|---|---|
| `test_health.py` | Health endpoint |
| `test_datasets.py` | All 16 datasets load + parse, covariate columns, domain registration |
| `test_diagnostics.py` | STL, ACF/PACF, forecastability (all 5 dimensions), stationarity |
| `test_ensemble.py` | Weight computation, inverse-sMAPE, edge cases (zero sMAPE, missing models) |
| `test_forecasting_covariates.py` | Covariate pipeline: fold no-leakage, shape invariance, parser extraction |
| `test_preprocessing.py` | Outlier removal, smoothing, differencing, cache invalidation |
| `test_forecasting.py` | Chronos-2 + StatsForecast inference, prediction intervals |
| `test_backtest.py` | Rolling-origin CV, metrics, winner selection |
| `test_export.py` | XLSX sheet structure, results log CSV |

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

**Stack:** FastAPI · Pydantic v2 · pandas · statsmodels · scipy · chronos-forecasting · timesfm · statsforecast · torch / React 19 · Vite · TypeScript 6 · Tailwind CSS 3 · Recharts · TanStack Query v5 · Zustand v5
