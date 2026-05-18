# Laplace — Frontend

React 19 single-page app for the Laplace time series forecasting wizard. Five screens, zero page reloads, state persists across browser refreshes via sessionStorage.

**Stack:** React 19 · TypeScript 6 · Vite · Tailwind CSS 3 · Recharts · TanStack Query v5 · Zustand v5

---

## Running Locally

```bash
npm install
npm run dev      # http://localhost:5173 (proxies /api → localhost:8000)
npm run build    # Production build → dist/ (~200KB gzipped)
```

Requires the backend running on `:8000`. Use `../scripts/dev.sh` to start both together.

---

## Screens & Components

```
DataInputScreen
├── DatasetPicker        16 bundled dataset cards across 11 domains, grouped by category
├── FileUploader         Drag-and-drop CSV / XLSX with upload feedback (filename, size)
└── ColumnMapper         Auto-detected datetime + target column selectors, frequency override
                         └── [Lab only] Covariate selector — shown when CSV has ≥2 extra numeric cols

DiagnosticsScreen
├── ForecastabilityGauge SVG arc gauge (0–100) with 5 dimension breakdown bars
├── STLChart             4-panel decomposition: Observed / Trend / Seasonal / Residual
├── ACFChart             ACF + PACF bar charts with ±1.96/√n confidence bands
└── [Lab only] DataPrepPanel
    ├── Issue summary card  Detected outliers + non-stationarity with actionable hints
    ├── Outlier removal     IQR or Z-score, with interpolation or winsorisation
    ├── Smoothing           SMA or EMA with configurable window
    └── Differencing        First or second order
    → On Apply: re-runs diagnostics + backtest with preprocessed values
    → PreprocessingBanner   Persistent across all steps; shows active operations + Reset

ValidationScreen
├── [Lab only] BacktestConfigPanel
│   ├── n_splits (1–10)        Fold count stepper
│   ├── Horizon (auto/override) Backtest evaluation horizon
│   └── Selection metric       sMAPE / MAE / MASE — Re-run button triggers cache invalidation
├── MetricsTable         Sortable table; winner highlighted; MAPE hidden when N/A
├── [Lab only] FoldDetail (expandable)
│   └── Per-fold sMAPE table with winning model highlighted per row
└── BacktestChart        Fold selector + model toggles + historical overlay

ForecastScreen
├── Model selector       5 models + BEST badge on winner
│                        └── [Lab only] Ensemble chip — appears after backtest completes
├── EnsembleWeights      [Lab only] Weight% + sMAPE per model (purple progress bars)
├── HorizonConfig        +/− stepper with frequency-aware labels and max bound
├── [Lab only] FutureCovariatesPanel
│   └── Per covariate: Constant (with value input) or Linear trend extrapolation
├── ForecastChart        Historical tail + point forecast + 80% + 90% confidence bands
└── ↓ Download CSV       Client-side export: date, point, lo_80, hi_80, lo_90, hi_90

ExportScreen
├── Analysis Summary     8 KPI cards (dataset, points, freq, forecastability, model, metrics)
├── ReportBuilder        [Lab only] Section toggles + analyst notes field
├── Download XLSX        5-sheet formatted report (forecast sheet populated from store)
├── Download CSV         Flat file with metrics + raw data
├── Save to Log          Appends one row to results_log.csv on the backend
└── RunHistory           Table of all logged runs
```

---

## Boardroom / Lab Toggle

Every piece of visible text is keyed through `src/lib/copy.ts`. The toggle in the header switches between two modes:

- **Boardroom** (default): plain language, decision-focused. Clean UI — no preprocessing panel, no backtest config, no ensemble chip, no fold detail, no covariate UI.
- **Lab**: full analyst toolkit. Statistical nomenclature, DataPrepPanel, BacktestConfigPanel, FoldDetail, Ensemble chip, EnsembleWeights, FutureCovariatesPanel, covariate selector in ColumnMapper.

Switching mode is instant — no refetch, no reload. Lab features appear progressively as conditions are met (e.g. Ensemble chip only after backtest completes; covariate UI only when series has covariates attached).

---

## State Management

**Zustand** store at `src/stores/useAppStore.ts`:

| Field | Type | Description |
|---|---|---|
| `currentStep` | `Step` | Active wizard step |
| `displayMode` | `'boardroom' \| 'lab'` | Active UI mode |
| `timeSeriesData` | `TimeSeriesData \| null` | Loaded series (dates, values, frequency, name, n_points, covariates) |
| `preprocessingConfig` | `PreprocessingConfig` | Current Data Prep settings |
| `preprocessedData` | `PreprocessedResult \| null` | Output of last preprocessing run |
| `backtestConfig` | `BacktestConfig` | n_splits, horizon override, selection metric |
| `forecastResult` | `StoredForecast \| null` | Last generated forecast — persisted for ExportScreen |

The store is persisted to **sessionStorage** — refresh the page and you land exactly where you left off with the same data.

**TanStack Query** manages server state. The backtest query key includes the preprocessing hash and the full `backtestConfig` — changing either automatically invalidates the cache and triggers a fresh run. `staleTime: Infinity` ensures STL and CV computations never re-run unnecessarily.

---

## Preprocessing Cache Strategy

Preprocessing changes cascade correctly through the pipeline:
1. User applies Data Prep settings → `setPreprocessedData()` stores result
2. The preprocessing hash (stable JSON of active config) is included in both the `['diagnostics', ...]` and `['backtest', ...]` query keys
3. React Query sees a new key → re-fetches diagnostics and backtest automatically
4. The **PreprocessingBanner** appears across all subsequent steps showing active operations; "× Reset" clears `preprocessedData` and re-invalidates both caches

---

## Charts

All charts use **Recharts** `ComposedChart`:

- **Confidence bands** — `Area` components with `dataKey` pointing to `[lo, hi]` arrays, rendered as range fills between two values (not from zero).
- **Model colors** are fixed across all screens and specified in `src/lib/colors.ts`:
  - Chronos-2 `#0066FF`, TimesFM `#14B8A6`, AutoETS `#FF6B00`, AutoTheta `#FFC700`, SeasonalNaive `#FF2A3A`, Ensemble `#8B5CF6`
- **BacktestChart** overlays actual holdout data (dashed black line) against each model's fold forecasts with a fold selector.

---

## Forecast CSV Export

Clicking **↓ Download CSV** in ForecastScreen triggers a client-side download with no backend round-trip:

- Future dates are computed from the last historical date by stepping forward one frequency unit at a time
- Output columns: `date, point_forecast, lo_80, hi_80, lo_90, hi_90`
- Filename: `{series_name}_{model_name}_forecast.csv`

---

## Testing

```bash
# Type check
npx tsc --noEmit

# Production build
npm run build

# Unit tests (Vitest + Testing Library)
npx vitest run

# E2E tests (Playwright — requires dev servers running)
npx playwright test
```

---

## Project Structure

```
frontend/
├── playwright.config.ts
├── vite.config.ts
├── tailwind.config.ts
├── e2e/
│   └── wizard-flow.spec.ts       Full wizard flow + state persistence + error states
└── src/
    ├── App.tsx                   ErrorBoundary → AppShell → StepContent (fade-in transitions)
    ├── api/client.ts             Typed fetch wrappers for all backend endpoints
    ├── hooks/useApi.ts           TanStack Query hooks (preprocessing-hash-keyed cache)
    ├── stores/useAppStore.ts     Zustand + sessionStorage persist
    ├── types/index.ts            All TypeScript interfaces + FREQUENCY_LABELS
    ├── lib/
    │   ├── copy.ts               Boardroom/Lab text dictionary
    │   ├── colors.ts             Design tokens + modelColorMap (6 models)
    │   └── utils.ts              cn() classname utility
    └── components/
        ├── layout/
        │   ├── AppShell.tsx          Header, mode toggle, step navigation
        │   ├── StepNav.tsx           Pill-chip stepper with color states
        │   └── PreprocessingBanner.tsx  Active preprocessing indicator + Reset
        ├── data-input/
        │   ├── DataInputScreen.tsx
        │   ├── DatasetPicker.tsx     Domain-grouped cards (11 domains, 16 datasets)
        │   ├── FileUploader.tsx      Drag-and-drop with upload feedback
        │   └── ColumnMapper.tsx      Column selectors + covariate multi-select (Lab)
        ├── diagnostics/
        │   ├── DiagnosticsScreen.tsx
        │   ├── DataPrepPanel.tsx     Preprocessing controls + issue summary card
        │   ├── ForecastabilityGauge.tsx
        │   ├── STLChart.tsx
        │   └── ACFChart.tsx
        ├── validation/
        │   ├── ValidationScreen.tsx
        │   ├── BacktestConfigPanel.tsx  n_splits / horizon / metric (Lab)
        │   ├── FoldDetail.tsx           Per-fold sMAPE table (Lab, expandable)
        │   ├── MetricsTable.tsx
        │   └── BacktestChart.tsx
        ├── forecast/
        │   ├── ForecastScreen.tsx
        │   ├── EnsembleWeights.tsx      Weight breakdown table (Lab)
        │   ├── FutureCovariatesPanel.tsx  Constant / trend per covariate (Lab)
        │   └── ForecastChart.tsx
        └── export/
            ├── ExportScreen.tsx
            ├── ReportBuilder.tsx
            └── RunHistory.tsx
```
