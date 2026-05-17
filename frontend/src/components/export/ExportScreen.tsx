import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { exportXlsx, saveToLog } from '../../api/client'
import { useAppStore } from '../../stores/useAppStore'
import { useBacktest, useDiagnostics } from '../../hooks/useApi'
import { t } from '../../lib/copy'

export function ExportScreen() {
  const { timeSeriesData, displayMode } = useAppStore()
  const { data: diagnosticsData } = useDiagnostics(timeSeriesData)
  const { data: backtestData } = useBacktest(timeSeriesData)
  const [logSaved, setLogSaved] = useState(false)

  const downloadMutation = useMutation({
    mutationFn: () =>
      exportXlsx({
        data: {
          name: timeSeriesData!.name,
          dates: timeSeriesData!.dates,
          values: timeSeriesData!.values,
          frequency: timeSeriesData!.frequency,
          n_points: timeSeriesData!.n_points,
        },
        diagnostics: diagnosticsData
          ? {
              forecastability: diagnosticsData.forecastability,
            }
          : null,
        backtest: backtestData
          ? {
              winner: backtestData.winner,
              selection_metric: backtestData.selection_metric,
              n_splits: backtestData.n_splits,
              horizon: backtestData.horizon,
              aggregate_metrics: backtestData.aggregate_metrics,
            }
          : null,
      }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `laplace_${timeSeriesData!.name}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    },
  })

  const logMutation = useMutation({
    mutationFn: () => {
      const winner = backtestData?.winner || 'unknown'
      const metrics = backtestData?.aggregate_metrics[winner]
      return saveToLog({
        dataset: timeSeriesData!.name,
        model: winner,
        smape: metrics?.smape || 0,
        mae: metrics?.mae || 0,
        rmse: metrics?.rmse || 0,
        horizon: backtestData?.horizon || 0,
        forecastability_score: diagnosticsData?.forecastability.total_score || 0,
        n_observations: timeSeriesData!.n_points,
        frequency: timeSeriesData!.frequency,
      })
    },
    onSuccess: () => setLogSaved(true),
  })

  if (!timeSeriesData) {
    return (
      <div className="text-center text-secondary mt-16">
        No data loaded. Go back to the first step.
      </div>
    )
  }

  const winner = backtestData?.winner || '—'
  const winnerMetrics = backtestData?.aggregate_metrics[winner]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-primary mb-2">
          {t('steps.export', displayMode)}
        </h2>
        <p className="text-secondary">
          {displayMode === 'boardroom'
            ? 'Download your analysis as an Excel report or save results for comparison.'
            : 'Export XLSX report (5 sheets) and/or append to results_log.csv.'}
        </p>
      </div>

      <div className="bg-surface rounded-xl p-6">
        <h3 className="font-medium text-primary mb-4">Analysis Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Dataset" value={timeSeriesData.name} />
          <SummaryCard label="Points" value={`${timeSeriesData.n_points}`} />
          <SummaryCard label="Frequency" value={timeSeriesData.frequency} />
          <SummaryCard
            label="Forecastability"
            value={
              diagnosticsData
                ? `${diagnosticsData.forecastability.total_score.toFixed(0)} / 100`
                : '—'
            }
          />
          <SummaryCard label="Best Model" value={winner} />
          <SummaryCard
            label="sMAPE"
            value={winnerMetrics ? `${winnerMetrics.smape.toFixed(2)}%` : '—'}
          />
          <SummaryCard
            label="MAE"
            value={winnerMetrics ? winnerMetrics.mae.toFixed(2) : '—'}
          />
          <SummaryCard
            label="MASE"
            value={winnerMetrics ? winnerMetrics.mase.toFixed(3) : '—'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface rounded-xl p-6">
          <h3 className="font-medium text-primary mb-2">Download Report</h3>
          <p className="text-xs text-secondary mb-4">
            {displayMode === 'boardroom'
              ? 'Excel file with summary, forecasts, model comparison, diagnostics, and raw data.'
              : '5-sheet XLSX: Summary, Forecast, Backtest Metrics, Diagnostics, Raw Data.'}
          </p>
          <button
            onClick={() => downloadMutation.mutate()}
            disabled={downloadMutation.isPending}
            className="w-full px-4 py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
          >
            {downloadMutation.isPending
              ? 'Generating...'
              : downloadMutation.isSuccess
                ? 'Downloaded! Click to download again'
                : 'Download XLSX'}
          </button>
          {downloadMutation.isError && (
            <p className="text-xs text-accent-red mt-2">
              Download failed. Please try again.
            </p>
          )}
        </div>

        <div className="bg-surface rounded-xl p-6">
          <h3 className="font-medium text-primary mb-2">Save to Results Log</h3>
          <p className="text-xs text-secondary mb-4">
            {displayMode === 'boardroom'
              ? 'Save this run for later comparison across different datasets or models.'
              : 'Append one row to results_log.csv with key metrics and metadata.'}
          </p>
          <button
            onClick={() => logMutation.mutate()}
            disabled={logMutation.isPending || logSaved}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
              logSaved
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-primary text-white hover:bg-primary/90 disabled:opacity-50'
            }`}
          >
            {logMutation.isPending
              ? 'Saving...'
              : logSaved
                ? 'Saved to results_log.csv'
                : 'Save to Log'}
          </button>
          {logMutation.isError && (
            <p className="text-xs text-accent-red mt-2">
              Failed to save. Please try again.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-secondary">{label}</p>
      <p className="text-sm font-medium text-primary mt-0.5">{value}</p>
    </div>
  )
}
