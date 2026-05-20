import type { FoldResult } from '../../types'
import { modelColorMap } from '../../lib/colors'

interface Props {
  folds: FoldResult[]
}

interface CoverageStats {
  model: string
  coverage80: number  // actual % of points inside 80% interval
  coverage90: number  // actual % of points inside 90% interval
  totalPoints: number
}

function computeCoverage(folds: FoldResult[]): CoverageStats[] {
  if (!folds || folds.length === 0) return []

  // Collect model names from first fold
  const modelNames = folds[0].forecasts.map((f) => f.model_name)

  return modelNames.map((model) => {
    let inside80 = 0
    let inside90 = 0
    let total = 0

    for (const fold of folds) {
      const forecast = fold.forecasts.find((f) => f.model_name === model)
      if (!forecast) continue

      const n = Math.min(fold.actual.length, forecast.lo_80.length)
      for (let i = 0; i < n; i++) {
        const actual = fold.actual[i]
        total++

        if (actual >= forecast.lo_80[i] && actual <= forecast.hi_80[i]) {
          inside80++
        }
        if (actual >= forecast.lo_90[i] && actual <= forecast.hi_90[i]) {
          inside90++
        }
      }
    }

    return {
      model,
      coverage80: total > 0 ? (inside80 / total) * 100 : 0,
      coverage90: total > 0 ? (inside90 / total) * 100 : 0,
      totalPoints: total,
    }
  })
}

function CoverageBar({
  label,
  actual,
  expected,
  color,
}: {
  label: string
  actual: number
  expected: number
  color: string
}) {
  const maxWidth = 100
  const barWidth = Math.min(actual, maxWidth)
  const isGood = Math.abs(actual - expected) <= 15 // within ±15 pp is "well-calibrated"
  const isOver = actual > expected + 10

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-secondary w-8 text-right shrink-0">{label}</span>
      <div className="flex-1 relative h-5">
        {/* Background track */}
        <div className="absolute inset-0 bg-canvas rounded-full overflow-hidden">
          {/* Actual coverage bar */}
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${barWidth}%`,
              backgroundColor: color,
              opacity: 0.7,
            }}
          />
        </div>
        {/* Expected reference line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-primary/40"
          style={{ left: `${expected}%` }}
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-secondary/60 whitespace-nowrap">
            {expected}%
          </div>
        </div>
      </div>
      <span
        className={`text-xs font-mono w-14 text-right shrink-0 ${
          isGood ? 'text-green-500' : isOver ? 'text-amber-500' : 'text-red-400'
        }`}
      >
        {actual.toFixed(1)}%
      </span>
    </div>
  )
}

export function CalibrationChart({ folds }: Props) {
  const stats = computeCoverage(folds)

  if (stats.length === 0) return null

  return (
    <div className="bg-surface rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-primary mb-1">Prediction Interval Calibration</h3>
        <p className="text-xs text-secondary">
          How often actuals fall within predicted intervals. Well-calibrated models match the expected coverage (reference line).
        </p>
      </div>

      <div className="space-y-5">
        {stats.map((s) => (
          <div key={s.model}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: modelColorMap[s.model] || '#999' }}
              />
              <span className="text-xs font-medium text-primary">{s.model}</span>
              <span className="text-[10px] text-secondary">
                ({s.totalPoints} test points)
              </span>
            </div>
            <div className="space-y-3 pl-4">
              <CoverageBar
                label="80%"
                actual={s.coverage80}
                expected={80}
                color={modelColorMap[s.model] || '#999'}
              />
              <CoverageBar
                label="90%"
                actual={s.coverage90}
                expected={90}
                color={modelColorMap[s.model] || '#999'}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-canvas">
        <div className="flex items-center gap-4 text-[10px] text-secondary">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-primary/40 inline-block" /> Expected coverage
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Well-calibrated (within ±15pp)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Conservative (wide intervals)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Over-confident (narrow intervals)
          </span>
        </div>
      </div>
    </div>
  )
}
