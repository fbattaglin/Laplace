import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { runForecast } from '../../api/client'
import { useAppStore } from '../../stores/useAppStore'
import { useBacktest } from '../../hooks/useApi'
import { t } from '../../lib/copy'
import { modelColorMap } from '../../lib/colors'
import { FREQUENCY_LABELS } from '../../types'
import type { Frequency, ForecastResponse, ModelForecast } from '../../types'
import { ForecastChart } from './ForecastChart'
import { EnsembleWeights } from './EnsembleWeights'
import { FutureCovariatesPanel } from './FutureCovariatesPanel'

// ─── CSV export helpers ───────────────────────────────────────────────────────

function addFrequencyStep(date: Date, frequency: Frequency): Date {
  const d = new Date(date)
  switch (frequency) {
    case 'H': d.setHours(d.getHours() + 1); break
    case 'D': d.setDate(d.getDate() + 1); break
    case 'W': d.setDate(d.getDate() + 7); break
    case 'M': d.setMonth(d.getMonth() + 1); break
    case 'Q': d.setMonth(d.getMonth() + 3); break
    case 'Y': d.setFullYear(d.getFullYear() + 1); break
  }
  return d
}

function generateFutureDates(lastDate: string, frequency: Frequency, horizon: number): string[] {
  const dates: string[] = []
  let current = new Date(lastDate)
  for (let i = 0; i < horizon; i++) {
    current = addFrequencyStep(current, frequency)
    dates.push(current.toISOString().split('T')[0])
  }
  return dates
}

function downloadForecastCsv(
  forecast: ModelForecast,
  lastHistoricalDate: string,
  frequency: Frequency,
  horizon: number,
  seriesName: string,
) {
  const futureDates = generateFutureDates(lastHistoricalDate, frequency, horizon)
  const header = 'date,point_forecast,lo_80,hi_80,lo_90,hi_90'
  const rows = futureDates.map((date, i) =>
    [
      date,
      forecast.point_forecast[i]?.toFixed(4) ?? '',
      forecast.lo_80[i]?.toFixed(4) ?? '',
      forecast.hi_80[i]?.toFixed(4) ?? '',
      forecast.lo_90[i]?.toFixed(4) ?? '',
      forecast.hi_90[i]?.toFixed(4) ?? '',
    ].join(','),
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${seriesName.replace(/\s+/g, '_')}_${forecast.model_name}_forecast.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const ENSEMBLE_MODEL = 'Ensemble'

export function ForecastScreen() {
  const { timeSeriesData, displayMode, setStep, setForecastResult } = useAppStore()
  const { data: backtestData } = useBacktest(timeSeriesData)

  const winner = backtestData?.winner || 'Chronos-2'
  const baseModelNames = backtestData
    ? Object.keys(backtestData.aggregate_metrics)
    : ['Chronos-2', 'TimesFM', 'AutoETS', 'AutoTheta', 'SeasonalNaive']

  // Ensemble chip appears in Lab mode after backtest completes
  const modelNames =
    displayMode === 'lab' && backtestData
      ? [...baseModelNames, ENSEMBLE_MODEL]
      : baseModelNames

  const freq = timeSeriesData?.frequency || 'M'
  const freqInfo = FREQUENCY_LABELS[freq]
  const maxHorizon = timeSeriesData
    ? Math.min(Math.floor(timeSeriesData.n_points / 3), 64)
    : freqInfo.horizonDefault

  const [selectedModel, setSelectedModel] = useState(winner)
  const [horizon, setHorizon] = useState(Math.min(freqInfo.horizonDefault, maxHorizon))
  const [result, setResult] = useState<ForecastResponse | null>(null)
  const [futureCovariates, setFutureCovariates] = useState<Record<string, number[]> | null>(null)

  const forecastMutation = useMutation({
    mutationFn: () =>
      runForecast({
        values: timeSeriesData!.values,
        frequency: timeSeriesData!.frequency,
        horizon,
        model_name: selectedModel,
        // Pass backtest metrics so the backend can compute ensemble weights
        backtest_metrics:
          selectedModel === ENSEMBLE_MODEL
            ? backtestData?.aggregate_metrics
            : undefined,
        // Pass covariates if available (graceful fallback on backend if model doesn't support them)
        covariates: timeSeriesData!.covariates ?? undefined,
        future_covariates: futureCovariates ?? undefined,
      }),
    onSuccess: (data) => {
      setResult(data)
      // Persist to store so ExportScreen can include it in the XLSX/CSV payload
      if (data.forecasts[0]) {
        setForecastResult({ forecast: data.forecasts[0], horizon: data.horizon })
      }
    },
  })

  if (!timeSeriesData) {
    return (
      <div className="text-center text-secondary mt-16">
        No data loaded. Go back to the first step.
      </div>
    )
  }

  const selectedForecast = result?.forecasts[0] || null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-primary mb-2">
          {t('steps.forecast', displayMode)}
        </h2>
        <p className="text-secondary">
          {displayMode === 'boardroom'
            ? 'Generate a forecast with confidence ranges using your best model.'
            : 'Produce point forecasts with 80% and 90% prediction intervals.'}
        </p>
      </div>

      <div className="bg-surface rounded-xl p-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-xs font-medium text-secondary mb-1.5">Model</label>
            <div className="flex flex-wrap gap-2">
              {modelNames.map((name) => {
                const isEnsemble = name === ENSEMBLE_MODEL
                return (
                  <button
                    key={name}
                    onClick={() => {
                      setSelectedModel(name)
                      setResult(null)
                    }}
                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                      selectedModel === name
                        ? 'border-accent-blue bg-accent-blue/5 text-primary font-medium'
                        : 'border-primary/10 text-secondary hover:border-primary/20'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: modelColorMap[name] || '#999' }}
                    />
                    {name}
                    {name === winner && !isEnsemble && (
                      <span className="text-[9px] bg-accent-blue text-white px-1 py-0.5 rounded">
                        BEST
                      </span>
                    )}
                    {isEnsemble && (
                      <span className="text-[9px] bg-[#8B5CF6] text-white px-1 py-0.5 rounded">
                        LAB
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary mb-1.5">
              Horizon ({freqInfo.label})
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHorizon((h) => Math.max(1, h - 1))}
                className="w-8 h-8 rounded border border-primary/10 text-primary hover:bg-primary/5"
                disabled={horizon <= 1}
              >
                −
              </button>
              <input
                type="number"
                value={horizon}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (v >= 1 && v <= maxHorizon) {
                    setHorizon(v)
                    setResult(null)
                  }
                }}
                className="w-16 text-center border border-primary/10 rounded py-1 text-sm"
                min={1}
                max={maxHorizon}
              />
              <button
                onClick={() => setHorizon((h) => Math.min(maxHorizon, h + 1))}
                className="w-8 h-8 rounded border border-primary/10 text-primary hover:bg-primary/5"
                disabled={horizon >= maxHorizon}
              >
                +
              </button>
              <span className="text-xs text-secondary">max {maxHorizon}</span>
            </div>
            {horizon > freqInfo.horizonDefault * 2 && (
              <p className="text-xs text-accent-orange mt-1">
                Long horizons may produce less reliable forecasts.
              </p>
            )}
          </div>

          <button
            onClick={() => forecastMutation.mutate()}
            disabled={forecastMutation.isPending}
            className="px-6 py-2.5 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
          >
            {forecastMutation.isPending ? 'Generating...' : 'Generate Forecast'}
          </button>
        </div>
      </div>

      {/* Ensemble weight breakdown (Lab-only, shown when Ensemble is selected) */}
      {displayMode === 'lab' &&
        selectedModel === ENSEMBLE_MODEL &&
        backtestData && (
          <EnsembleWeights aggregateMetrics={backtestData.aggregate_metrics} />
        )}

      {/* Future covariates panel (Lab-only, shown when series has covariates) */}
      {displayMode === 'lab' && timeSeriesData.covariates && Object.keys(timeSeriesData.covariates).length > 0 && (
        <FutureCovariatesPanel
          covariates={timeSeriesData.covariates as Record<string, number[]>}
          horizon={horizon}
          onChange={setFutureCovariates}
        />
      )}

      {forecastMutation.isPending && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-secondary mt-4">
            {selectedModel === ENSEMBLE_MODEL
              ? `Running all 5 models and computing ensemble weights...`
              : `Running ${selectedModel} forecast for ${horizon} ${freqInfo.label}...`}
          </p>
        </div>
      )}

      {forecastMutation.isError && (
        <div className="bg-accent-red/5 rounded-xl p-4 text-center">
          <p className="text-accent-red text-sm">Forecast failed: {forecastMutation.error.message}</p>
          <button
            onClick={() => forecastMutation.mutate()}
            className="mt-3 px-5 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {selectedForecast && (
        <ForecastChart
          historical={timeSeriesData.values}
          dates={timeSeriesData.dates}
          forecast={selectedForecast}
          horizon={result!.horizon}
        />
      )}

      <div className="flex justify-between items-center pt-4">
        <button
          onClick={() => setStep('validation')}
          className="px-5 py-2.5 rounded-lg border border-surface text-secondary hover:border-secondary hover:text-primary transition-colors"
        >
          ← Back
        </button>
        {selectedForecast && (
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                downloadForecastCsv(
                  selectedForecast,
                  timeSeriesData.dates[timeSeriesData.dates.length - 1],
                  timeSeriesData.frequency,
                  result!.horizon,
                  timeSeriesData.name,
                )
              }
              className="px-4 py-2.5 rounded-lg border border-primary/10 text-secondary text-sm hover:border-primary/20 hover:text-primary transition-colors flex items-center gap-1.5"
            >
              ↓ Download CSV
            </button>
            <button
              onClick={() => setStep('export')}
              className="px-6 py-2.5 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-colors"
            >
              {displayMode === 'boardroom' ? 'Download Results →' : 'Export →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
