# Laplace — Frontend

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-3-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

React 19 single-page application for the Laplace forecasting wizard. Five screens, zero page reloads, state persists across browser refreshes via sessionStorage.

---

## Running Locally

```bash
npm install
npm run dev      # http://localhost:5173 — proxies /api → localhost:8000
npm run build    # production build → dist/ (~205KB gzipped)
```

Requires the backend running on `:8000`. Use `../scripts/dev.sh` to start both together.

---

## Application Screens

### Step 1 · Load Data

```
DataInputScreen
├── FileUploader         Primary: drag-and-drop CSV/XLSX with upload feedback
├── ColumnMapper         Datetime + target selectors, frequency override
│   └── [Lab] Covariate selector — multi-select when CSV has ≥2 extra numeric cols
└── DatasetPicker        15 bundled datasets — Classic Benchmarks + Real-World Problems
                         Domain-colored tags · covariate badge in Lab mode
```

### Step 2 · Diagnose

```
DiagnosticsScreen
├── Overview tab
│   ├── ForecastabilityGauge    SVG arc gauge (0–100) with 5 dimension breakdown bars
│   └── DescriptiveStatsPanel   Count, mean, std, IQR, skewness, kurtosis, CV
├── Decomposition tab
│   ├── STLChart                4-panel: Observed / Trend / Seasonal / Residual
│   └── ACFChart                ACF + PACF bar charts with ±1.96/√n confidence bands
├── Distribution & Outliers tab
│   ├── DistributionChart       Histogram + normal overlay
│   └── OutlierHighlight        IQR-detected outliers highlighted on the series
├── Stability tab
│   ├── [Lab] SeasonalityOverride   Override auto-detected period → re-runs STL + score
│   ├── RollingStatsChart           Rolling mean ± std
│   └── StationarityPanel           ADF + KPSS results + verdict
└── [Lab] Data Prep tab
    ├── Issue summary card      Outlier count + stationarity verdict with actionable hints
    ├── Outlier removal         IQR or Z-score, interpolation or winsorisation
    ├── Smoothing               SMA or EMA with configurable window
    └── Differencing            First or second order
    → On Apply: re-runs diagnostics + backtest with preprocessed values
    → PreprocessingBanner persists across all steps; Reset clears + re-invalidates
```

### Step 3 · Compare Models

```
ValidationScreen
├── [Lab] BacktestConfigPanel
│   ├── n_splits (1–10)         Fold count stepper
│   ├── Horizon (auto/override) Backtest evaluation window
│   └── Selection metric        sMAPE / MAE / MASE — Re-run invalidates cache
├── MetricsTable                5-column table; winner highlighted
├── [Lab] FoldDetail (expandable)
│   └── Per-fold sMAPE table with best model highlighted per row
├── BacktestChart               Fold selector + model toggles + historical overlay
└── [Lab] CalibrationChart      Actual vs expected coverage (80%/90%) per model
                                Color-coded: green (calibrated) · amber (conservative) · red (over-confident)
```

### Step 4 · Forecast

```
ForecastScreen
├── Model selector              5 models + BEST badge on backtest winner
│   └── [Lab] Ensemble chip     Appears after backtest — inverse-sMAPE weighted
├── [Lab] EnsembleWeights       Weight% + sMAPE per model (purple progress bars)
├── HorizonConfig               +/− stepper, frequency-aware labels, max bound
├── [Lab] FutureCovariatesPanel Per-covariate: Constant (value input) or Linear trend
├── ForecastChart               Historical tail + point forecast + 80% + 90% bands
└── ↓ Download forecast CSV     Client-side: date · point · lo_80 · hi_80 · lo_90 · hi_90
```

### Step 5 · Export

```
ExportScreen
├── AnalysisSummary
│   ├── Verdict banner          Color-coded by tier (green/amber/red) + prescriptive sentence
│   ├── Metric strip            Signal Quality · Model Performance · Forward Outlook
│   └── [Lab] Dimension bars    5 forecastability breakdown bars
├── [Lab] ReportBuilder         Section toggles (5 sheets) + analyst notes
├── Download XLSX               5-sheet formatted report
├── Download CSV                Flat file with metrics + raw data
├── Save to Log                 Appends one row to results_log.csv
└── RunHistory
    ├── [Lab] WinRateBar        Model win rate chart (shown when ≥2 runs saved)
    └── Sortable table          Click any column header to sort — forecastability color-coded
```

---

## Boardroom / Lab Toggle

Every piece of UI text is keyed through `src/lib/copy.ts`. The toggle switches between:

**Boardroom** (default) — Clean, decision-focused. No preprocessing, no per-fold detail, no Ensemble chip, no covariate UI, no calibration chart. Ideal for presentations.

**Lab** — Full analyst toolkit. Every advanced feature is visible. Progressive disclosure: Ensemble chip appears only after backtest, covariate UI only when series has covariates, WinRateBar only with ≥2 saved runs.

Switching is instant — no refetch, no reload. Lab features persist through mode switches.

---

## State Management

**Zustand** store (`src/stores/useAppStore.ts`), persisted to sessionStorage:

| Field | Type | Description |
|---|---|---|
| `currentStep` | `Step` | Active wizard step |
| `displayMode` | `'boardroom' \| 'lab'` | Active UI mode |
| `timeSeriesData` | `TimeSeriesData \| null` | Loaded series (dates, values, frequency, covariates) |
| `preprocessingConfig` | `PreprocessingConfig` | Current Data Prep settings |
| `preprocessedData` | `PreprocessedResult \| null` | Output of last preprocessing run |
| `backtestConfig` | `BacktestConfig` | n_splits · horizon · metric |
| `forecastResult` | `StoredForecast \| null` | Last generated forecast (persisted for ExportScreen) |
| `periodOverride` | `number \| null` | Lab: override auto-detected seasonality period |

Refresh the page and you land exactly where you left off with the same data.

---

## Cache Strategy

**TanStack Query** manages server state. The query key for `['backtest']` and `['diagnostics']` includes:
1. Series name + point count
2. A stable hash of the active preprocessing config
3. The full `backtestConfig` (n_splits, horizon, metric)
4. `periodOverride` (diagnostics only)

Changing any of these automatically invalidates the cache and re-fetches. `staleTime: Infinity` on backtest/diagnostics — no unnecessary re-runs.

---

## Model Colors

Fixed across all charts and components (`src/lib/colors.ts`):

| Model | Color | Hex |
|---|---|---|
| Chronos‑2 | Blue | `#0066FF` |
| TimesFM | Teal | `#14B8A6` |
| AutoETS | Orange | `#FF6B00` |
| AutoTheta | Yellow | `#FFC700` |
| SeasonalNaïve | Red | `#FF2A3A` |
| Ensemble | Purple | `#8B5CF6` |

---

## Charts

All charts use **Recharts** `ComposedChart`:

- **Confidence bands** — `Area` components with range fills between lo/hi values (not from zero)
- **BacktestChart** — overlays holdout actuals (dashed black) against fold forecasts with a fold selector and model toggles
- **CalibrationChart** — horizontal bars showing actual vs expected 80%/90% coverage per model
- **ForecastabilityGauge** — SVG arc with animated fill, colored by tier

---

## Forecast CSV Export

No backend round-trip. Clicking **↓ Download CSV** in ForecastScreen:

1. Computes future dates by stepping forward from the last historical date (one frequency unit at a time)
2. Writes: `date, point_forecast, lo_80, hi_80, lo_90, hi_90`
3. Triggers a browser download as `{series_name}_{model_name}_forecast.csv`

---

## Testing

```bash
npx tsc --noEmit          # type check
npm run build             # production build
npx vitest run            # unit tests (Vitest + Testing Library)
npx playwright test       # E2E (requires dev servers running)
```

---

## Project Structure

```
frontend/
├── vite.config.ts             Proxy /api → :8000
├── tailwind.config.ts         Design tokens (accent-blue/orange/teal/purple/red/yellow)
└── src/
    ├── App.tsx                ErrorBoundary → AppShell → StepContent (fade transitions)
    ├── api/client.ts          Typed fetch wrappers for all backend endpoints
    ├── hooks/useApi.ts        TanStack Query hooks — preprocessing-hash-keyed cache
    ├── stores/useAppStore.ts  Zustand + sessionStorage persist
    ├── types/index.ts         All TypeScript interfaces + FREQUENCY_LABELS
    ├── lib/
    │   ├── copy.ts            Boardroom/Lab text dictionary
    │   ├── colors.ts          Design tokens + modelColorMap (6 models)
    │   └── utils.ts           cn() classname utility
    └── components/
        ├── layout/
        │   ├── AppShell.tsx              Header, mode toggle, step navigation
        │   ├── StepNav.tsx               Per-step color identity chips
        │   └── PreprocessingBanner.tsx   Active preprocessing indicator + Reset
        ├── data-input/
        │   ├── DataInputScreen.tsx
        │   ├── DatasetPicker.tsx         15 datasets, domain-colored, covariate badge
        │   ├── FileUploader.tsx          Drag-and-drop with upload feedback
        │   └── ColumnMapper.tsx          Column selectors + covariate multi-select (Lab)
        ├── diagnostics/
        │   ├── DiagnosticsScreen.tsx
        │   ├── SeasonalityOverride.tsx   Period override control (Lab, Stability tab)
        │   ├── DataPrepPanel.tsx         Preprocessing controls + issue summary
        │   ├── ForecastabilityGauge.tsx
        │   ├── STLChart.tsx
        │   ├── ACFChart.tsx
        │   ├── DistributionChart.tsx
        │   ├── OutlierHighlight.tsx
        │   ├── RollingStatsChart.tsx
        │   └── StationarityPanel.tsx
        ├── validation/
        │   ├── ValidationScreen.tsx
        │   ├── BacktestConfigPanel.tsx   n_splits / horizon / metric (Lab)
        │   ├── FoldDetail.tsx            Per-fold sMAPE table (Lab, expandable)
        │   ├── CalibrationChart.tsx      Coverage analysis per model (Lab)
        │   ├── MetricsTable.tsx
        │   └── BacktestChart.tsx
        ├── forecast/
        │   ├── ForecastScreen.tsx
        │   ├── EnsembleWeights.tsx       Weight breakdown table (Lab)
        │   ├── FutureCovariatesPanel.tsx Constant / linear per covariate (Lab)
        │   └── ForecastChart.tsx
        └── export/
            ├── ExportScreen.tsx
            ├── AnalysisSummary.tsx       Verdict banner + metric strip + dimension bars
            ├── ReportBuilder.tsx
            └── RunHistory.tsx            Sortable table + model win rate chart (Lab)
```
