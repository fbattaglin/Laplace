import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { exportCsv, exportXlsx, saveToLog } from '../../api/client'
import { useAppStore } from '../../stores/useAppStore'
import { useBacktest, useDiagnostics } from '../../hooks/useApi'
import { t } from '../../lib/copy'
import { ReportBuilder } from './ReportBuilder'
import { RunHistory } from './RunHistory'

const DEFAULT_SECTIONS = new Set(['summary', 'backtest', 'forecast', 'diagnostics', 'raw_data'])

export function ExportScreen() {
  const { timeSeriesData, displayMode } = useAppStore()
  const { data: diagnosticsData } = useDiagnostics(timeSeriesData)
  const { data: backtestData } = useBacktest(timeSeriesData)
  const queryClient = useQueryClient()

  const [selectedSections, setSelectedSections] = useState<Set<string>>(DEFAULT_SECTIONS)
  const [notes, setNotes] = useState('')
  const [logSaved, setLogSaved] = useState(false)

  const toggleSection = (id: string) => {
    setSelectedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const buildPayload = () => ({
    data: {
      name: timeSeriesData!.name,
      dates: timeSeriesData!.dates,
      values: timeSeriesData!.values,
      frequency: timeSeriesData!.frequency,
      n_points: timeSeriesData!.n_points,
    },
    diagnostics: diagnosticsData ? { forecastability: diagnosticsData.forecastability } : null,
    backtest: backtestData
      ? {
          winner: backtestData.winner,
          selection_metric: backtestData.selection_metric,
          n_splits: backtestData.n_splits,
          horizon: backtestData.horizon,
          aggregate_metrics: backtestData.aggregate_metrics,
        }
      : null,
  })

  const xlsxMutation = useMutation({
    mutationFn: () =>
      exportXlsx({
        ...buildPayload(),
        sections: [...selectedSections],
        notes: notes.trim() || undefined,
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

  const csvMutation = useMutation({
    mutationFn: () => exportCsv(buildPayload()),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `laplace_${timeSeriesData!.name}.csv`
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
    onSuccess: () => {
      setLogSaved(true)
      queryClient.invalidateQueries({ queryKey: ['run-history'] })
    },
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
            : 'Export XLSX report with section control, or download a flat CSV.'}
        </p>
      </div>

      {/* KPI summary cards */}
      <div className="bg-surface rounded-xl p-6">
        <h3 className="font-medium text-primary mb-4">Analysis Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Dataset" value={timeSeriesData.name} />
          <SummaryCard label="Points" value={`${timeSeriesData.n_points}`} />
          <SummaryCard label="Frequency" value={timeSeriesData.frequency} />
          <SummaryCard
            label="Forecastability"
            value={diagnosticsData ? `${diagnosticsData.forecastability.total_score.toFixed(0)} / 100` : '—'}
          />
          <SummaryCard label="Best Model" value={winner} />
          <SummaryCard label="sMAPE" value={winnerMetrics ? `${winnerMetrics.smape.toFixed(2)}%` : '—'} />
          <SummaryCard label="MAE" value={winnerMetrics ? winnerMetrics.mae.toFixed(2) : '—'} />
          <SummaryCard label="MASE" value={winnerMetrics ? winnerMetrics.mase.toFixed(3) : '—'} />
        </div>
      </div>

      {/* Report Builder */}
      <ReportBuilder
        selectedSections={selectedSections}
        onToggleSection={toggleSection}
        notes={notes}
        onNotesChange={setNotes}
      />

      {/* Download buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl p-5">
          <h3 className="font-medium text-primary mb-1">Download XLSX</h3>
          <p className="text-xs text-secondary mb-4">
            {[...selectedSections].length} sheet{[...selectedSections].length !== 1 ? 's' : ''} selected
          </p>
          <button
            onClick={() => xlsxMutation.mutate()}
            disabled={xlsxMutation.isPending || selectedSections.size === 0}
            className="w-full px-4 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
          >
            {xlsxMutation.isPending ? 'Generating...' : xlsxMutation.isSuccess ? 'Downloaded!' : 'Download XLSX'}
          </button>
          {xlsxMutation.isError && <p className="text-xs text-accent-red mt-2">Download failed.</p>}
        </div>

        <div className="bg-surface rounded-xl p-5">
          <h3 className="font-medium text-primary mb-1">Download CSV</h3>
          <p className="text-xs text-secondary mb-4">Flat file with metrics and raw data</p>
          <button
            onClick={() => csvMutation.mutate()}
            disabled={csvMutation.isPending}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {csvMutation.isPending ? 'Generating...' : csvMutation.isSuccess ? 'Downloaded!' : 'Download CSV'}
          </button>
          {csvMutation.isError && <p className="text-xs text-accent-red mt-2">Download failed.</p>}
        </div>

        <div className="bg-surface rounded-xl p-5">
          <h3 className="font-medium text-primary mb-1">Save to Log</h3>
          <p className="text-xs text-secondary mb-4">
            {displayMode === 'boardroom' ? 'Track this run for later comparison.' : 'Append to results_log.csv.'}
          </p>
          <button
            onClick={() => logMutation.mutate()}
            disabled={logMutation.isPending || logSaved}
            className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              logSaved
                ? 'bg-green-500/15 text-green-600 border border-green-500/20'
                : 'bg-canvas text-primary border border-surface hover:bg-surface disabled:opacity-50'
            }`}
          >
            {logMutation.isPending ? 'Saving...' : logSaved ? 'Saved!' : 'Save to Log'}
          </button>
          {logMutation.isError && <p className="text-xs text-accent-red mt-2">Failed to save.</p>}
        </div>
      </div>

      {/* Run History */}
      <RunHistory />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-secondary">{label}</p>
      <p className="text-sm font-medium text-primary mt-0.5 truncate">{value}</p>
    </div>
  )
}
