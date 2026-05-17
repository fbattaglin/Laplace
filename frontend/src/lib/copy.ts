export type DisplayMode = 'boardroom' | 'lab'

type CopyEntry = {
  boardroom: string
  lab: string
}

const copy: Record<string, CopyEntry> = {
  'app.title': {
    boardroom: 'Laplace',
    lab: 'Laplace',
  },
  'app.subtitle': {
    boardroom: 'Understand how predictable your data is — and which model forecasts it best.',
    lab: 'Foundation model vs. classical baselines: rolling-origin backtest with quantile forecasts.',
  },

  // ── Wizard steps ──────────────────────────────────────────────────────────────
  'steps.dataInput': {
    boardroom: 'Load Data',
    lab: 'Data Input',
  },
  'steps.diagnostics': {
    boardroom: 'Analyze Patterns',
    lab: 'Diagnostics',
  },
  'steps.validation': {
    boardroom: 'Compare Models',
    lab: 'Validation (Backtest)',
  },
  'steps.forecast': {
    boardroom: 'Predict Future',
    lab: 'Forecast',
  },
  'steps.export': {
    boardroom: 'Download Results',
    lab: 'Export',
  },

  // ── Data Prep (Lab-only) ──────────────────────────────────────────────────────
  'dataPrepTab': {
    boardroom: 'Data Prep',
    lab: 'Data Prep',
  },
  'dataPrepTitle': {
    boardroom: 'Data Preparation',
    lab: 'Data Preparation',
  },
  'dataPrepSubtitle': {
    boardroom: 'Clean your data before modeling.',
    lab: 'Transform the series before modeling. Changes propagate to diagnostics and backtest.',
  },
  'dataPrepApply': {
    boardroom: 'Apply',
    lab: 'Apply transformations',
  },
  'dataPrepReset': {
    boardroom: 'Reset',
    lab: 'Reset to raw',
  },
  'dataPrepApplied': {
    boardroom: 'Preprocessing active',
    lab: 'Preprocessing active — downstream steps use the cleaned series.',
  },
  'outlierTitle': {
    boardroom: 'Remove Outliers',
    lab: 'Outlier Removal',
  },
  'outlierMethod': {
    boardroom: 'Method',
    lab: 'Detection method',
  },
  'outlierReplacement': {
    boardroom: 'Replace with',
    lab: 'Replacement strategy',
  },
  'smoothTitle': {
    boardroom: 'Smooth Series',
    lab: 'Smoothing',
  },
  'smoothMethod': {
    boardroom: 'Method',
    lab: 'Smoothing method',
  },
  'smoothWindow': {
    boardroom: 'Window',
    lab: 'Window (auto if blank)',
  },
  'differenceTitle': {
    boardroom: 'Remove Trend',
    lab: 'Differencing',
  },
  'differenceOrder': {
    boardroom: 'Order',
    lab: 'Differencing order',
  },
  'differenceWarning': {
    boardroom: 'This removes the trend from the series.',
    lab: 'Differencing removes trend. 1st order = removes linear trend. 2nd order = removes quadratic trend. Shortens series by d points.',
  },

  // ── Validation (Lab extras) ───────────────────────────────────────────────────
  'validation.configTitle': {
    boardroom: 'Model Test Settings',
    lab: 'Backtest Configuration',
  },
  'validation.foldDetail': {
    boardroom: 'Show fold detail',
    lab: 'Expand per-fold results',
  },
}

export function t(key: string, mode: DisplayMode): string {
  const entry = copy[key]
  if (!entry) return key
  return entry[mode]
}
