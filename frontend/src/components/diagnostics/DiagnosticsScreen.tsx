import { useQueryClient } from '@tanstack/react-query'
import { useDiagnostics } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'
import { t } from '../../lib/copy'
import { STLChart } from './STLChart'
import { ACFChart } from './ACFChart'
import { ForecastabilityGauge } from './ForecastabilityGauge'

export function DiagnosticsScreen() {
  const { timeSeriesData, displayMode } = useAppStore()
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useDiagnostics(timeSeriesData)

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
          <p className="text-secondary mt-4">Decomposing signal and computing diagnostics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto mt-16 text-center">
        <p className="text-accent-red">Diagnostics failed: {error.message}</p>
        <p className="text-xs text-secondary mt-2">Check that the backend is running.</p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['diagnostics'] })}
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
          {t('steps.diagnostics', displayMode)}
        </h2>
        <p className="text-secondary">
          {displayMode === 'boardroom'
            ? `Analyzing patterns in "${timeSeriesData.name}" (${timeSeriesData.n_points} data points).`
            : `STL decomposition, ACF/PACF, and forecastability analysis for "${timeSeriesData.name}" (n=${timeSeriesData.n_points}, freq=${timeSeriesData.frequency}).`}
        </p>
      </div>

      <ForecastabilityGauge result={data.forecastability} />

      <STLChart stl={data.stl} dates={timeSeriesData.dates} />

      <ACFChart acfData={data.acf_pacf} />

      <div className="flex justify-end pt-4">
        <button
          onClick={() => useAppStore.getState().setStep('validation')}
          className="px-6 py-2.5 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-colors"
        >
          {displayMode === 'boardroom' ? 'Compare Models →' : 'Run Backtest →'}
        </button>
      </div>
    </div>
  )
}
