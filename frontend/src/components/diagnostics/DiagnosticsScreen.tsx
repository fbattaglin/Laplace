import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDiagnostics } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'
import { t } from '../../lib/copy'
import { STLChart } from './STLChart'
import { ACFChart } from './ACFChart'
import { ForecastabilityGauge } from './ForecastabilityGauge'
import { DescriptiveStatsPanel } from './DescriptiveStatsPanel'
import { DistributionChart } from './DistributionChart'
import { RollingStatsChart } from './RollingStatsChart'
import { OutlierHighlight } from './OutlierHighlight'
import { StationarityPanel } from './StationarityPanel'
import { DataPrepPanel } from './DataPrepPanel'
import { SeasonalityOverride } from './SeasonalityOverride'

type Tab = 'overview' | 'decomposition' | 'distribution' | 'stability' | 'dataPrepLab'

const BASE_TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'decomposition', label: 'Decomposition' },
  { id: 'distribution', label: 'Distribution & Outliers' },
  { id: 'stability', label: 'Stability' },
]

export function DiagnosticsScreen() {
  const { timeSeriesData, displayMode } = useAppStore()
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useDiagnostics(timeSeriesData)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const outlierCount = data?.outliers?.n_outliers ?? 0
  const isStationary = data?.stationarity?.is_stationary ?? true
  const issueCount = outlierCount + (!isStationary ? 1 : 0)

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

      {/* Tab navigation */}
      <div className="flex gap-1 bg-canvas rounded-xl p-1">
        {/* Standard tabs */}
        {BASE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-sm font-medium px-3 py-2 rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-surface text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {/* Lab-only Data Prep tab with visual badge */}
        {displayMode === 'lab' && (
          <button
            onClick={() => setActiveTab('dataPrepLab')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-all ${
              activeTab === 'dataPrepLab'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Data Prep
            {issueCount > 0 && (
              <span
                title={`${outlierCount > 0 ? `${outlierCount} outlier${outlierCount > 1 ? 's' : ''} detected` : ''}${outlierCount > 0 && !isStationary ? ' · ' : ''}${!isStationary ? 'Non-stationary series' : ''}`}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent-orange text-white text-[9px] font-bold"
              >
                {issueCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <ForecastabilityGauge result={data.forecastability} />
          {data.descriptive_stats && <DescriptiveStatsPanel stats={data.descriptive_stats} />}
        </div>
      )}

      {activeTab === 'decomposition' && (
        <div className="space-y-5">
          <STLChart stl={data.stl} dates={timeSeriesData.dates} />
          <ACFChart acfData={data.acf_pacf} />
        </div>
      )}

      {activeTab === 'distribution' && (
        <div className="space-y-5">
          {data.distribution && <DistributionChart distribution={data.distribution} />}
          {data.outliers && (
            <OutlierHighlight
              outliers={data.outliers}
              values={data.stl.observed}
              dates={timeSeriesData.dates}
            />
          )}
        </div>
      )}

      {activeTab === 'stability' && (
        <div className="space-y-5">
          {displayMode === 'lab' && (
            <SeasonalityOverride frequency={timeSeriesData.frequency} />
          )}
          {data.rolling_stats && (
            <RollingStatsChart data={data.rolling_stats} dates={timeSeriesData.dates} />
          )}
          {data.stationarity && <StationarityPanel stationarity={data.stationarity} />}
        </div>
      )}

      {activeTab === 'dataPrepLab' && displayMode === 'lab' && (
        <DataPrepPanel outlierCount={outlierCount} isStationary={isStationary} />
      )}

      <div className="flex justify-between items-center pt-4">
        <button
          onClick={() => useAppStore.getState().setStep('dataInput')}
          className="px-5 py-2.5 rounded-lg border border-surface text-secondary hover:border-secondary hover:text-primary transition-colors"
        >
          ← Back
        </button>
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
