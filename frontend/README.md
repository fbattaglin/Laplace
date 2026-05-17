# Laplace — Frontend

React 19 single-page app for the Laplace time series forecasting wizard. Five screens, zero page reloads, state persists across browser refreshes.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 3 · Recharts · TanStack Query · Zustand

---

## Running Locally

```bash
npm install
npm run dev      # http://localhost:5173 (proxies /api → localhost:8000)
npm run build    # Production build → dist/ (~190KB gzipped)
```

Requires the backend running on `:8000`. Use `../scripts/dev.sh` to start both together.

---

## Screens & Components

```
DataInputScreen
├── DatasetPicker        Preloaded dataset cards (3 bundled series)
├── FileUploader         Drag-and-drop CSV / XLSX
├── ColumnMapper         Override auto-detected datetime + target columns
└── DataPreview          First 20 rows + basic stats

DiagnosticsScreen
├── ForecastabilityGauge SVG arc gauge (0–100) with 5 dimension bars
├── STLChart             4-panel decomposition: Observed / Trend / Seasonal / Residual
└── ACFChart             ACF + PACF bar charts with ±1.96/√n confidence bands

ValidationScreen
├── MetricsTable         Sortable table, winner highlighted in blue, MAPE hidden when N/A
└── BacktestChart        Fold selector + model visibility toggles + historical overlay

ForecastScreen
├── Model selector       All 4 models, BEST badge on winner
├── HorizonConfig        +/− stepper with frequency-aware labels and max bound
└── ForecastChart        Historical tail + point forecast + 80% and 90% confidence bands

ExportScreen
├── Analysis Summary     8 KPI cards (dataset, points, freq, forecastability, model, metrics)
├── Download XLSX        5-sheet formatted report
└── Save to Log          Appends one row to results_log.csv on the backend
```

---

## Boardroom / Lab Toggle

Every piece of visible text is keyed through `src/lib/copy.ts`. The toggle in the header switches between two modes:

- **Boardroom** (default): plain language, decision-focused. "How predictable is your data?" / "Best model: Chronos-Bolt"
- **Lab**: full statistical nomenclature. "Forecastability Index" / "sMAPE 5.00%, MASE 0.685, Rolling-origin CV (5 folds)"

Switching mode is instant — no refetch, no reload.

---

## State Management

**Zustand** store at `src/stores/useAppStore.ts` holds:
- `currentStep` — controls which screen renders
- `displayMode` — `'boardroom'` | `'lab'`
- `timeSeriesData` — the loaded series (dates, values, frequency, name, n_points)

The store is persisted to **sessionStorage** — navigate away, refresh, come back, and you land exactly where you left off with the same data loaded.

**TanStack Query** manages server state: diagnostics and backtest results are cached with `staleTime: Infinity` — the heavy computations (STL, CV) run once per dataset, never twice.

---

## Charts

All charts use **Recharts** `ComposedChart`:

- **Confidence bands** — `Area` components with `dataKey` pointing to `[lo, hi]` arrays. Recharts renders these as range fills (band between two values), not fills from zero.
- **Model colors** are fixed across all screens: Chronos-Bolt `#0066FF`, AutoETS `#FF6B00`, AutoTheta `#FFC700`, SeasonalNaive `#FF2A3A`.
- **BacktestChart** overlays actual holdout data (dashed black line) against each model's fold forecasts. Fold selector narrows to a single fold.

---

## Testing

```bash
# Unit tests (Vitest + Testing Library)
npx vitest run

# E2E tests (Playwright — requires dev servers running)
npx playwright test

# Type check
npx tsc --noEmit
```

**E2E test coverage** (`e2e/wizard-flow.spec.ts`):
- Full wizard flow: Load → Diagnose → Compare → Forecast → Export
- State persistence: data survives a full page reload
- Error state: backtest failure shows a Retry button
- Dataset picker: all 3 bundled datasets visible

---

## Project Structure

```
frontend/
├── playwright.config.ts
├── vite.config.ts
├── tailwind.config.ts
├── e2e/
│   └── wizard-flow.spec.ts
└── src/
    ├── App.tsx                   Entry: ErrorBoundary → AppShell → StepContent (fade-in)
    ├── api/client.ts             Typed fetch wrappers for all backend endpoints
    ├── hooks/useApi.ts           TanStack Query hooks (useDatasets, useDiagnostics, useBacktest, ...)
    ├── stores/useAppStore.ts     Zustand + sessionStorage persist
    ├── types/index.ts            All TypeScript interfaces + FREQUENCY_LABELS map
    ├── lib/
    │   ├── copy.ts               Boardroom/Lab text dictionary
    │   ├── colors.ts             Design tokens + modelColorMap
    │   └── utils.ts              cn() classname helper
    └── components/
        ├── layout/               AppShell, StepNav, ErrorBoundary
        ├── data-input/           DataInputScreen + sub-components
        ├── diagnostics/          DiagnosticsScreen + STLChart, ACFChart, ForecastabilityGauge
        ├── validation/           ValidationScreen + MetricsTable, BacktestChart
        ├── forecast/             ForecastScreen + ForecastChart
        └── export/               ExportScreen
```
