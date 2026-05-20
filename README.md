# ◇ Laplace

**Not every signal can be predicted. Let's find out if yours can.**

Laplace is a desktop-first time series forecasting app for analysts. It starts by asking *whether* your data is worth forecasting — then benchmarks five models in rolling cross-validation and delivers the best forecast with honest confidence intervals.

Named after [Laplace's Demon](https://en.wikipedia.org/wiki/Laplace%27s_demon): given complete historical knowledge, how precisely can we predict the future?

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tests](https://img.shields.io/badge/tests-144%20passing-22C55E)](./backend/tests)

---

## The Philosophy

Most forecasting tools hand you a chart. Laplace makes you earn it.

Before a single model runs, you get a **Forecastability Score** — a signal-theoretic assessment of how predictable your series actually is. If the score is low, the wide prediction intervals aren't a bug; they're the truth. If it's high, you can trust the winner's output.

Model comparison uses **rolling-origin cross-validation**: no cherry-picking a single train/test split. Every model is evaluated on multiple held-out future periods and ranked by sMAPE across all folds.

---

## The Workflow

```
Upload Data  →  Diagnose Signal  →  Compare Models  →  Forecast  →  Export
```

| Step | What Happens |
|---|---|
| **1 · Load Data** | Pick from 15 bundled datasets or upload your own CSV/XLSX. Auto-detects columns. In Lab mode, select covariate columns for exogenous forecasting. |
| **2 · Diagnose** | STL decomposition · ACF/PACF · rolling statistics · outlier detection · stationarity tests · Forecastability Score. Lab: preprocess before modelling. |
| **3 · Compare Models** | 5-model rolling-origin backtest. Lab: configure folds, horizon, selection metric. Per-fold breakdown available. |
| **4 · Forecast** | Forward prediction with 80% and 90% confidence bands. Lab: Ensemble model, future covariates, download CSV. |
| **5 · Export** | XLSX report with prescriptive summary + model performance strip. Save to log for cross-run comparison. |

---

## Models

| Model | Type | Description |
|---|---|---|
| **Chronos‑2** | Foundation (120M params) | Amazon's language model for time series. Zero-shot. MPS acceleration on Apple Silicon. |
| **TimesFM 2.0** | Foundation (500M params) | Google's patched-time-series transformer. Zero-shot. |
| **AutoETS** | Classical | Automatically selects error/trend/seasonal structure via AIC. |
| **AutoTheta** | Classical | Theta decomposition. Strong on trended data with moderate seasonality. |
| **Seasonal Naïve** | Baseline | Repeats the last seasonal cycle. Any serious model should beat this. |
| **Ensemble** *(Lab)* | Combined | Inverse-sMAPE weighted average of all five. Weights shown in the UI. |

All models produce native **80% and 90% prediction intervals**.

---

## Forecastability Score

Before fitting any model, Laplace computes a 0–100 score from five signal dimensions:

| Dimension | Weight | What It Measures |
|---|---|---|
| Signal Strength | **40%** | Ratio of trend + seasonal variance to total (Hyndman STL features) |
| Regularity | **25%** | Inverse spectral entropy — how concentrated the frequency spectrum is |
| Stationarity | **15%** | Combined ADF + KPSS test verdict |
| Sample Adequacy | **10%** | Whether you have ≥ 3× the seasonal period in observations |
| Noise Level | **10%** | STL remainder variance relative to total variance |

> **≥ 70** — High · strong learnable patterns  
> **45–69** — Moderate · some structure, noise limits precision  
> **< 45** — Low · noise-dominated, expect wide intervals

---

## Boardroom / Lab

The **Boardroom / Lab** toggle in the header switches the entire app between two modes:

**Boardroom** (default) — Plain language, decision-focused. Clean UI. No statistical jargon, no preprocessing controls, no per-fold detail. Ideal for sharing with stakeholders.

**Lab** — Full analyst toolkit. Data Prep panel (outlier removal, smoothing, differencing), backtest config, per-fold breakdown, Ensemble model, covariate inputs, prediction interval calibration chart, seasonality period override.

Switching is instant — no refetch, no reload.

---

## Quick Start

**Prerequisites:** Python 3.12+, Node.js 20+, [uv](https://docs.astral.sh/uv/)

```bash
git clone https://github.com/fbattaglin/Laplace.git
cd Laplace

# Install dependencies + cache model weights (~500MB, one-time)
./scripts/setup.sh

# Start backend (:8000) + frontend (:5173)
./scripts/dev.sh
```

Open **[http://localhost:5173](http://localhost:5173)** — interactive API docs at **[http://localhost:8000/docs](http://localhost:8000/docs)**.

> **Apple Silicon:** Chronos‑2 uses MPS acceleration automatically. First run downloads model weights (~500MB, cached after that). TimesFM runs on CPU.

---

## Bundled Datasets (15)

Three classic benchmarks every forecasting practitioner knows, plus twelve real-world problems:

### Classic Benchmarks

| Dataset | Freq | Points | Why It's Here |
|---|---|---|---|
| `airline_passengers` | M | 144 | Box-Jenkins 1970 — the canonical forecasting reference |
| `co2_atmospheric` | M | 780 | Keeling Curve — iconic trend + annual cycle |
| `us_retail_sales` | M | 300 | Macro-economics textbook standard |

### Real-World Problems

| Dataset | Freq | Points | Domain | Covariates |
|---|---|---|---|---|
| `bike_rentals` | D | 730 | Transport | temperature, humidity, windspeed |
| `energy_demand` | H | 1000 | Energy | — |
| `electricity_price_de` | D | 1095 | Energy | — |
| `energy_demand_temp` | D | 1000 | Energy | temperature_c, humidity_pct |
| `supermarket_weekly` | W | 200 | Retail | promo_flag, competitor_price |
| `hotel_occupancy` | D | 730 | Hospitality | avg_daily_rate, local_events_count, holiday_flag |
| `ecommerce_orders` | D | 730 | E-commerce | ad_spend_usd, discount_pct, competitor_price_index |
| `us_unemployment` | M | 240 | Economics | — |
| `us_cpi` | M | 300 | Economics | — |
| `hospital_admissions` | W | 313 | Healthcare | — |
| `gold_price_usd` | M | 420 | Finance | — |
| `web_traffic` | D | 1096 | Digital | — |

The 5 datasets with covariates activate the **covariate selector** in Lab mode.

---

## API Reference

Full interactive docs at **http://localhost:8000/docs**.

### Core Endpoints

```
GET  /api/datasets              → list 15 bundled datasets
GET  /api/datasets/{name}       → load dataset as TimeSeriesData
POST /api/datasets/upload       → parse CSV/XLSX, return preview + column detection
POST /api/datasets/upload/confirm → confirm columns, extract covariates

POST /api/diagnostics           → STL + ACF/PACF + Forecastability + stationarity
POST /api/preprocessing         → outlier removal, smoothing, differencing
POST /api/backtest              → rolling-origin CV across 5 models
POST /api/forecast              → single model or Ensemble forecast

POST /api/export/xlsx           → 5-sheet XLSX report
POST /api/export/csv            → flat CSV with metrics + forecast
GET  /api/export/log            → run history
POST /api/export/log            → append result row
```

### Backtest Request

```json
{
  "values": [112, 118, 132],
  "frequency": "M",
  "horizon": 12,
  "n_splits": 5,
  "covariates": { "temperature": [20.1, 21.3, 19.8] }
}
```

### Forecast Request

```json
{
  "values": [112, 118, 132],
  "frequency": "M",
  "horizon": 12,
  "model_name": "Ensemble",
  "backtest_metrics": {
    "Chronos-2": { "smape": 5.0, "mae": 20.0, "rmse": 24.8, "mase": 0.68 }
  },
  "covariates": { "temperature": [20.1, 21.3] },
  "future_covariates": { "temperature": [22.0, 22.5, 21.8] }
}
```

---

## Metrics

| Metric | Role | Notes |
|---|---|---|
| **sMAPE** | Winner selection | Symmetric, bounded, defined when actuals contain zeros |
| **MASE** | Academic benchmark | < 1 means model beats Seasonal Naïve (Hyndman & Koehler 2006) |
| **MAE** | Raw error | In original units, scale-dependent |
| **RMSE** | Outlier-sensitive error | Penalises large errors more than MAE |
| **MAPE** | Percentage error | Hidden when actuals contain zeros |

---

## Supported Frequencies

| Code | Period | Default Horizon |
|---|---|---|
| `H` Hourly | 24 | 48 hours |
| `D` Daily | 7 | 30 days |
| `W` Weekly | 52 | 12 weeks |
| `M` Monthly | 12 | 12 months |
| `Q` Quarterly | 4 | 4 quarters |
| `Y` Annual | 1 | 3 years |

---

## Testing

```bash
# Backend — 144 unit tests
cd backend && uv run pytest tests/ -v

# TypeScript
cd frontend && npx tsc --noEmit

# Production build
cd frontend && npm run build
```

| Test file | Coverage |
|---|---|
| `test_datasets.py` | 15 datasets · upload · column detection · covariate pipeline · domain registration |
| `test_diagnostics.py` | STL · ACF/PACF · forecastability (all 5 dims) · stationarity · period override |
| `test_ensemble.py` | Weight computation · weighted average · edge cases |
| `test_forecasting_covariates.py` | Fold no-leakage · shape invariance · parser extraction |
| `test_preprocessing.py` | Outlier removal · smoothing · differencing |
| `test_backtest.py` | Rolling-origin CV end-to-end |
| `test_export.py` | XLSX structure · results log |

---

## Project Structure

```
Laplace/
├── scripts/
│   ├── setup.sh          First-time install + model weights
│   ├── dev.sh            Start backend (:8000) + frontend (:5173)
│   └── check.sh          Lint + type check
│
├── backend/
│   └── src/laplace/
│       ├── models/schemas.py     All Pydantic schemas + frequency maps
│       ├── routers/              datasets · diagnostics · backtest · forecast · export
│       ├── services/
│       │   ├── parser.py         Parsing · column detection · covariate extraction
│       │   ├── diagnostics.py    STL · ACF · forecastability · stationarity
│       │   ├── preprocessing.py  Outlier removal · smoothing · differencing
│       │   ├── forecasting.py    Chronos-2 + TimesFM singletons + StatsForecast
│       │   ├── ensemble.py       Inverse-sMAPE weighted combination
│       │   ├── backtest.py       Expanding-window CV · metrics · winner selection
│       │   └── export.py         openpyxl workbook · results_log.csv
│       └── data/preloaded/       15 CSV datasets
│
└── frontend/
    └── src/
        ├── components/
        │   ├── data-input/       DatasetPicker · FileUploader · ColumnMapper
        │   ├── diagnostics/      ForecastabilityGauge · STL · ACF · DataPrepPanel
        │   ├── validation/       MetricsTable · BacktestChart · FoldDetail · CalibrationChart
        │   ├── forecast/         ForecastChart · EnsembleWeights · FutureCovariatesPanel
        │   └── export/           AnalysisSummary · ReportBuilder · RunHistory
        ├── stores/useAppStore.ts  Zustand: step · mode · data · preprocessing · backtest · forecast
        ├── hooks/useApi.ts        TanStack Query (cache-keyed by preprocessing hash + config)
        └── lib/                   copy.ts · colors.ts · utils.ts
```

---

**Stack:** FastAPI · Pydantic v2 · pandas · statsmodels · scipy · chronos-forecasting · timesfm · statsforecast · openpyxl  
React 19 · Vite · TypeScript · Tailwind CSS 3 · Recharts · TanStack Query v5 · Zustand v5
