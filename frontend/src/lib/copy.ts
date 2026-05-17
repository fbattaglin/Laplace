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
}

export function t(key: string, mode: DisplayMode): string {
  const entry = copy[key]
  if (!entry) return key
  return entry[mode]
}
