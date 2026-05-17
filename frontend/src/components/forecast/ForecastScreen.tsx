import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { runForecast } from '../../api/client'
import { useAppStore } from '../../stores/useAppStore'
import { useBacktest } from '../../hooks/useApi'
import { t } from '../../lib/copy'
import { modelColorMap } from '../../lib/colors'
import { FREQUENCY_LABELS } from '../../types'
import type { ForecastResponse } from '../../types'
import { ForecastChart } from './ForecastChart'

export function ForecastScreen() {
  const { timeSeriesData, displayMode, setStep } = useAppStore()
  const { data: backtestData } = useBacktest(timeSeriesData)

  const winner = backtestData?.winner || 'Chronos-Bolt'
  const modelNames = backtestData
    ? Object.keys(backtestData.aggregate_metrics)
    : ['Chronos-Bolt', 'AutoETS', 'AutoTheta', 'SeasonalNaive']

  const freq = timeSeriesData?.frequency || 'M'
  const freqInfo = FREQUENCY_LABELS[freq]
  const maxHorizon = timeSeriesData
    ? Math.min(Math.floor(timeSeriesData.n_points / 3), 64)
    : freqInfo.horizonDefault

  const [selectedModel, setSelectedModel] = useState(winner)
  const [horizon, setHorizon] = useState(Math.min(freqInfo.horizonDefault, maxHorizon))
  const [result, setResult] = useState<ForecastResponse | null>(null)

  const forecastMutation = useMutation({
    mutationFn: () =>
      runForecast({
        values: timeSeriesData!.values,
        frequency: timeSeriesData!.frequency,
        horizon,
        model_name: selectedModel,
      }),
    onSuccess: (data) => setResult(data),
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
            <div className="flex gap-2">
              {modelNames.map((name) => (
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
                    style={{ backgroundColor: modelColorMap[name] }}
                  />
                  {name}
                  {name === winner && (
                    <span className="text-[9px] bg-accent-blue text-white px-1 py-0.5 rounded">
                      BEST
                    </span>
                  )}
                </button>
              ))}
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

      {forecastMutation.isPending && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-secondary mt-4">
            Running {selectedModel} forecast for {horizon} {freqInfo.label}...
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
        <>
          <ForecastChart
            historical={timeSeriesData.values}
            dates={timeSeriesData.dates}
            forecast={selectedForecast}
            horizon={result!.horizon}
          />

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep('export')}
              className="px-6 py-2.5 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-colors"
            >
              {displayMode === 'boardroom' ? 'Download Results →' : 'Export →'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
