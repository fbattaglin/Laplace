import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore, type BacktestConfig } from '../../stores/useAppStore'

const METRIC_OPTIONS: { value: BacktestConfig['metric']; label: string; description: string }[] = [
  { value: 'smape', label: 'sMAPE', description: 'Symmetric Mean Absolute Percentage Error — scale-free, preferred default' },
  { value: 'mae', label: 'MAE', description: 'Mean Absolute Error — intuitive, in series units' },
  { value: 'mase', label: 'MASE', description: 'Mean Absolute Scaled Error — robust to zero-crossing series' },
]

export function BacktestConfigPanel() {
  const queryClient = useQueryClient()
  const { backtestConfig, setBacktestConfig, timeSeriesData } = useAppStore()

  // Local draft state — applied only when user clicks "Re-run"
  const [draft, setDraft] = useState<BacktestConfig>({ ...backtestConfig })
  const [horizonAuto, setHorizonAuto] = useState(draft.horizon === null)

  const maxHorizon = timeSeriesData
    ? Math.min(Math.floor(timeSeriesData.n_points / 3), 64)
    : 32

  const isDirty =
    draft.n_splits !== backtestConfig.n_splits ||
    draft.horizon !== backtestConfig.horizon ||
    draft.metric !== backtestConfig.metric

  function handleApply() {
    const next: BacktestConfig = {
      ...draft,
      horizon: horizonAuto ? null : draft.horizon,
    }
    setBacktestConfig(next)
    setDraft(next)
    queryClient.invalidateQueries({ queryKey: ['backtest'] })
  }

  function handleReset() {
    const defaults: BacktestConfig = { n_splits: 5, horizon: null, metric: 'smape' }
    setDraft(defaults)
    setHorizonAuto(true)
    setBacktestConfig(defaults)
    queryClient.invalidateQueries({ queryKey: ['backtest'] })
  }

  return (
    <div className="bg-canvas rounded-xl border border-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-secondary uppercase tracking-wide">
          Backtest Configuration
        </p>
        {(backtestConfig.n_splits !== 5 || backtestConfig.horizon !== null || backtestConfig.metric !== 'smape') && (
          <button
            onClick={handleReset}
            className="text-xs text-secondary hover:text-accent-red transition-colors"
          >
            Reset to defaults
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-6 items-start">
        {/* n_splits */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            Folds (n_splits)
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDraft((d) => ({ ...d, n_splits: Math.max(1, d.n_splits - 1) }))}
              disabled={draft.n_splits <= 1}
              className="w-7 h-7 rounded border border-primary/10 text-primary text-sm hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed"
            >
              −
            </button>
            <span className="w-6 text-center text-sm font-mono text-primary">{draft.n_splits}</span>
            <button
              onClick={() => setDraft((d) => ({ ...d, n_splits: Math.min(10, d.n_splits + 1) }))}
              disabled={draft.n_splits >= 10}
              className="w-7 h-7 rounded border border-primary/10 text-primary text-sm hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          <p className="text-[10px] text-secondary/50 mt-1">1 – 10</p>
        </div>

        {/* horizon */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            Backtest Horizon
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setHorizonAuto((v) => {
                  if (!v) setDraft((d) => ({ ...d, horizon: null }))
                  return !v
                })
              }}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors ${
                horizonAuto
                  ? 'border-accent-blue bg-accent-blue/5 text-accent-blue font-medium'
                  : 'border-primary/10 text-secondary hover:border-primary/20'
              }`}
            >
              Auto
            </button>
            {!horizonAuto && (
              <input
                type="number"
                value={draft.horizon ?? 12}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (v >= 1 && v <= maxHorizon) setDraft((d) => ({ ...d, horizon: v }))
                }}
                className="w-14 text-center border border-primary/10 rounded py-1 text-xs"
                min={1}
                max={maxHorizon}
              />
            )}
          </div>
          {!horizonAuto && (
            <p className="text-[10px] text-secondary/50 mt-1">max {maxHorizon}</p>
          )}
        </div>

        {/* selection metric */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            Selection Metric
          </label>
          <div className="flex gap-1.5">
            {METRIC_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => setDraft((d) => ({ ...d, metric: value }))}
                title={description}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  draft.metric === value
                    ? 'border-accent-blue bg-accent-blue/5 text-accent-blue font-medium'
                    : 'border-primary/10 text-secondary hover:border-primary/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Apply button */}
        <div className="flex items-end pb-0.5">
          <button
            onClick={handleApply}
            disabled={!isDirty}
            className="px-4 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-accent-blue text-white hover:bg-accent-blue/90 border-transparent"
          >
            Re-run Backtest
          </button>
        </div>
      </div>
    </div>
  )
}
