import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBacktest } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'
import { t } from '../../lib/copy'
import { MetricsTable } from './MetricsTable'
import { BacktestChart } from './BacktestChart'
import { BacktestConfigPanel } from './BacktestConfigPanel'
import { CalibrationChart } from './CalibrationChart'
import { FoldDetail } from './FoldDetail'
import { LabNudge } from '../layout/LabNudge'

export function ValidationScreen() {
  const { timeSeriesData, displayMode, backtestConfig } = useAppStore()
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useBacktest(timeSeriesData)
  const [showFolds, setShowFolds] = useState(false)

  if (!timeSeriesData) {
    return (
      <div className="text-center text-secondary mt-16">
        No data loaded. Go back to the first step.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto mt-16">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-secondary mt-4">
            {displayMode === 'boardroom'
              ? 'Testing all models on your data...'
              : `Running rolling-origin cross-validation (5 models × ${backtestConfig.n_splits} folds)...`}
          </p>
          <p className="text-xs text-secondary/60 mt-2">
            This may take a moment on the first run while foundation models load.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto mt-16 text-center">
        <p className="text-accent-red">Backtest failed: {error.message}</p>
        <p className="text-xs text-secondary mt-2">
          Try reducing the dataset size or check the backend logs.
        </p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['backtest'] })}
          className="mt-4 px-5 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-primary mb-2">
          {t('steps.validation', displayMode)}
        </h2>
        <p className="text-secondary">
          {displayMode === 'boardroom'
            ? `We tested 4 forecasting models on "${timeSeriesData.name}" — ${data.winner} performed best.`
            : `Rolling-origin backtest: ${data.n_splits} folds, h=${data.horizon}. Winner by ${data.selection_metric}: ${data.winner}.`}
        </p>
      </div>

      <LabNudge count={3} features={['Backtest config', 'Fold detail', 'Calibration chart']} />

      {displayMode === 'lab' && <BacktestConfigPanel />}

      <MetricsTable metrics={data.aggregate_metrics} winner={data.winner} />

      {/* Per-fold detail (Lab-only) */}
      {displayMode === 'lab' && (
        <div>
          <button
            onClick={() => setShowFolds((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary transition-colors"
          >
            <span className={`transition-transform ${showFolds ? 'rotate-90' : ''}`}>▶</span>
            {showFolds ? 'Hide' : 'Expand'} per-fold results
          </button>
          {showFolds && <FoldDetail folds={data.folds} winner={data.winner} />}
        </div>
      )}

      <BacktestChart
        backtest={data}
        dates={timeSeriesData.dates}
        values={timeSeriesData.values}
      />

      {/* Calibration chart (Lab-only) */}
      {displayMode === 'lab' && data.folds.length > 0 && (
        <CalibrationChart folds={data.folds} />
      )}

      <div className="flex justify-between items-center pt-4">
        <button
          onClick={() => useAppStore.getState().setStep('diagnostics')}
          className="px-5 py-2.5 rounded-lg border border-surface text-secondary hover:border-secondary hover:text-primary transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => useAppStore.getState().setStep('forecast')}
          className="px-6 py-2.5 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-colors"
        >
          {displayMode === 'boardroom' ? 'Predict Future →' : 'Generate Forecast →'}
        </button>
      </div>
    </div>
  )
}
