import type {
  BacktestResponse,
  DiagnosticsResponse,
  ForecastabilityDimension,
  TimeSeriesData,
} from '../../types'
import { FREQUENCY_LABELS } from '../../types'
import type { StoredForecast } from '../../stores/useAppStore'

interface AnalysisSummaryProps {
  timeSeriesData: TimeSeriesData
  diagnosticsData: DiagnosticsResponse | undefined
  backtestData: BacktestResponse | undefined
  forecastResult: StoredForecast | null
  displayMode: 'boardroom' | 'lab'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Tier = 'high' | 'moderate' | 'low'

function forecastabilityTier(score: number): Tier {
  if (score >= 70) return 'high'
  if (score >= 45) return 'moderate'
  return 'low'
}

const TIER_BORDER: Record<Tier, string> = {
  high: 'border-l-green-500',
  moderate: 'border-l-amber-500',
  low: 'border-l-red-500',
}

const TIER_BADGE_BG: Record<Tier, string> = {
  high: 'bg-green-500/10 text-green-400',
  moderate: 'bg-amber-500/10 text-amber-400',
  low: 'bg-red-500/10 text-red-400',
}

const TIER_LABEL: Record<Tier, string> = {
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
}

function buildNarrative(
  timeSeriesData: TimeSeriesData,
  diagnosticsData: DiagnosticsResponse | undefined,
  backtestData: BacktestResponse | undefined,
  forecastResult: StoredForecast | null,
  displayMode: 'boardroom' | 'lab',
): string {
  const name = `"${timeSeriesData.name.replace(/_/g, ' ')}"`
  const parts: string[] = []

  if (diagnosticsData) {
    const score = diagnosticsData.forecastability.total_score
    const tier = TIER_LABEL[forecastabilityTier(score)]
    parts.push(`${name} shows ${tier.toLowerCase()} forecastability (${score.toFixed(0)}/100).`)
  } else {
    parts.push(`${name} — analysis in progress.`)
  }

  if (backtestData) {
    const winner = backtestData.winner
    const metrics = backtestData.aggregate_metrics[winner]
    const sMAPE = metrics?.smape.toFixed(1) ?? '—'
    const nSplits = backtestData.n_splits
    const mase = metrics?.mase

    let modelSentence = `${winner} achieved ${sMAPE}% sMAPE across ${nSplits} test window${nSplits !== 1 ? 's' : ''}`
    if (mase !== undefined && mase < 1) {
      const times = (1 / mase).toFixed(1)
      modelSentence += ` — outperforming the seasonal baseline by ${times}×`
    }
    modelSentence += '.'
    parts.push(modelSentence)
  }

  if (forecastResult) {
    const freqLabel = FREQUENCY_LABELS[timeSeriesData.frequency].label
    const horizon = forecastResult.horizon
    const model = forecastResult.forecast.model_name
    parts.push(`The ${horizon}-${freqLabel} forecast uses ${model}.`)
  }

  if (displayMode === 'lab' && diagnosticsData) {
    const extras: string[] = []
    if (diagnosticsData.stationarity?.verdict) {
      extras.push(`Series: ${diagnosticsData.stationarity.verdict}.`)
    }
    const nOutliers = diagnosticsData.outliers?.n_outliers ?? 0
    if (nOutliers > 0) {
      extras.push(`${nOutliers} outlier${nOutliers !== 1 ? 's' : ''} detected.`)
    }
    if (extras.length > 0) parts.push(extras.join(' '))
  }

  return parts.join(' ')
}

function avgBandHalfWidth(forecast: StoredForecast | null): string | null {
  if (!forecast) return null
  const { lo_80, hi_80 } = forecast.forecast
  if (!lo_80.length) return null
  const avgHalf = lo_80.reduce((acc: number, lo: number, i: number) => acc + (hi_80[i] - lo) / 2, 0) / lo_80.length
  return avgHalf.toFixed(2)
}

function avgForecastValue(forecast: StoredForecast | null): string | null {
  if (!forecast) return null
  const pts = forecast.forecast.point_forecast
  if (!pts.length) return null
  const avg = pts.reduce((a: number, b: number) => a + b, 0) / pts.length
  return avg.toFixed(2)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  badge,
}: {
  label: string
  value: string | null
  badge?: { text: string; className: string }
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-xs text-secondary shrink-0">{label}</span>
      <span className="text-xs font-medium text-primary text-right">
        {value ?? '—'}
        {badge && (
          <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${badge.className}`}>
            {badge.text}
          </span>
        )}
      </span>
    </div>
  )
}

function MetricColumn({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="px-5 py-4 first:pt-5 last:pb-5 md:first:pt-4 md:last:pb-4">
      <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-2">{title}</p>
      <div className="divide-y divide-canvas/60">{children}</div>
    </div>
  )
}

function DimensionBar({ dim }: { dim: ForecastabilityDimension }) {
  const fillColor =
    dim.score >= 70 ? 'bg-green-500' : dim.score >= 45 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-xs text-secondary">{dim.name}</span>
        <span className="text-xs font-medium text-primary">{dim.score.toFixed(0)}</span>
      </div>
      <div className="h-1.5 w-full bg-canvas rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${fillColor}`}
          style={{ width: `${dim.score}%`, transition: 'width 0.4s ease' }}
        />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AnalysisSummary({
  timeSeriesData,
  diagnosticsData,
  backtestData,
  forecastResult,
  displayMode,
}: AnalysisSummaryProps) {
  const score = diagnosticsData?.forecastability.total_score ?? null
  const tier = score !== null ? forecastabilityTier(score) : null
  const winner = backtestData?.winner ?? null
  const winnerMetrics = winner ? backtestData?.aggregate_metrics[winner] : null
  const stationarity = diagnosticsData?.stationarity
  const outliers = diagnosticsData?.outliers
  const dimensions = diagnosticsData?.forecastability.dimensions ?? []
  const freqLabel = FREQUENCY_LABELS[timeSeriesData.frequency].label

  const narrative = buildNarrative(
    timeSeriesData,
    diagnosticsData,
    backtestData,
    forecastResult,
    displayMode,
  )

  const maseBadge =
    winnerMetrics?.mase !== undefined
      ? winnerMetrics.mase < 1
        ? { text: 'beats baseline', className: 'bg-green-500/15 text-green-400' }
        : { text: 'above baseline', className: 'bg-red-500/15 text-red-400' }
      : undefined

  const bandWidth = avgBandHalfWidth(forecastResult)
  const avgForecast = avgForecastValue(forecastResult)

  return (
    <div className="bg-surface rounded-xl overflow-hidden">
      {/* ── Verdict Banner ───────────────────────────────────────────────── */}
      <div
        className={`border-l-4 ${tier ? TIER_BORDER[tier] : 'border-l-surface'} px-5 py-4 flex items-start justify-between gap-4`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
            Analysis Summary
          </p>
          <p className="text-sm text-primary leading-relaxed">{narrative}</p>
        </div>

        {score !== null && tier && (
          <div className="shrink-0 text-center min-w-[56px]">
            <p className="text-3xl font-bold text-primary leading-none">{score.toFixed(0)}</p>
            <p className="text-[10px] text-secondary mt-0.5">/ 100</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold ${TIER_BADGE_BG[tier]}`}>
              {TIER_LABEL[tier]}
            </span>
          </div>
        )}
      </div>

      {/* ── Three-column Metric Strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-t border-canvas divide-y md:divide-y-0 md:divide-x divide-canvas">
        {/* Signal Quality */}
        <MetricColumn title="Signal Quality">
          <MetricRow
            label="Forecastability"
            value={score !== null ? `${score.toFixed(0)} / 100` : null}
          />
          <MetricRow
            label="Pattern"
            value={
              diagnosticsData
                ? diagnosticsData.forecastability.total_score >= 70
                  ? 'Strong trend + seasonality'
                  : diagnosticsData.forecastability.total_score >= 45
                  ? 'Moderate structure'
                  : 'Noise-dominated'
                : null
            }
          />
          <MetricRow label="Series length" value={`${timeSeriesData.n_points} ${freqLabel}`} />
          {displayMode === 'lab' && (
            <>
              <MetricRow
                label="Stationarity"
                value={stationarity?.verdict ?? null}
              />
              {(outliers?.n_outliers ?? 0) > 0 && (
                <MetricRow
                  label="Outliers detected"
                  value={String(outliers!.n_outliers)}
                />
              )}
            </>
          )}
        </MetricColumn>

        {/* Model Performance */}
        <MetricColumn title="Model Performance">
          <MetricRow label="Best model" value={winner} />
          <MetricRow
            label="sMAPE"
            value={winnerMetrics ? `${winnerMetrics.smape.toFixed(2)}%` : null}
          />
          <MetricRow
            label="MASE"
            value={winnerMetrics ? winnerMetrics.mase.toFixed(3) : null}
            badge={maseBadge}
          />
          <MetricRow
            label="MAE"
            value={winnerMetrics ? winnerMetrics.mae.toFixed(2) : null}
          />
          {displayMode === 'lab' && (
            <>
              <MetricRow
                label="RMSE"
                value={winnerMetrics ? winnerMetrics.rmse.toFixed(2) : null}
              />
              <MetricRow
                label="CV folds × horizon"
                value={
                  backtestData
                    ? `${backtestData.n_splits} × ${backtestData.horizon}`
                    : null
                }
              />
            </>
          )}
        </MetricColumn>

        {/* Forward Outlook */}
        <MetricColumn title="Forward Outlook">
          <MetricRow
            label="Forecast model"
            value={forecastResult?.forecast.model_name ?? winner}
          />
          <MetricRow
            label="Horizon"
            value={
              forecastResult
                ? `${forecastResult.horizon} ${freqLabel}`
                : backtestData
                ? `${backtestData.horizon} ${freqLabel} (backtest)`
                : null
            }
          />
          {displayMode === 'lab' && (
            <>
              <MetricRow label="Avg point forecast" value={avgForecast} />
              <MetricRow
                label="Avg ±80% half-width"
                value={bandWidth ? `±${bandWidth}` : null}
              />
            </>
          )}
          <MetricRow label="Frequency" value={`${timeSeriesData.frequency} (${freqLabel})`} />
          <MetricRow label="Dataset" value={timeSeriesData.name.replace(/_/g, ' ')} />
        </MetricColumn>
      </div>

      {/* ── Forecastability Dimensions (Lab only) ────────────────────────── */}
      {displayMode === 'lab' && dimensions.length > 0 && (
        <div className="border-t border-canvas px-5 py-4">
          <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-3">
            Forecastability Breakdown
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-3">
            {dimensions.map((dim) => (
              <DimensionBar key={dim.name} dim={dim} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
