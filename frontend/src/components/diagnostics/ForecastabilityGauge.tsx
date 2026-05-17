import type { ForecastabilityResult } from '../../types'
import { useAppStore } from '../../stores/useAppStore'

interface Props {
  result: ForecastabilityResult
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#0066FF'
  if (score >= 45) return '#FF6B00'
  return '#FF2A3A'
}

function GaugeArc({ score }: { score: number }) {
  const radius = 60
  const cx = 70
  const cy = 70
  const startAngle = -135
  const endAngle = 135
  const totalAngle = endAngle - startAngle

  const progressAngle = startAngle + (score / 100) * totalAngle
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const bgPath = describeArc(cx, cy, radius, startAngle, endAngle)
  const progressPath = describeArc(cx, cy, radius, startAngle, progressAngle)

  function describeArc(x: number, y: number, r: number, start: number, end: number) {
    const startX = x + r * Math.cos(toRad(start))
    const startY = y + r * Math.sin(toRad(start))
    const endX = x + r * Math.cos(toRad(end))
    const endY = y + r * Math.sin(toRad(end))
    const largeArc = end - start > 180 ? 1 : 0
    return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`
  }

  return (
    <svg viewBox="0 0 140 100" className="w-40 h-28">
      <path
        d={bgPath}
        fill="none"
        stroke="#F5F5F7"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d={progressPath}
        fill="none"
        stroke={getScoreColor(score)}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <text
        x="70"
        y="75"
        textAnchor="middle"
        className="text-2xl font-semibold"
        fill={getScoreColor(score)}
        fontSize="24"
      >
        {Math.round(score)}
      </text>
      <text x="70" y="92" textAnchor="middle" fill="#6E6E73" fontSize="9">
        / 100
      </text>
    </svg>
  )
}

export function ForecastabilityGauge({ result }: Props) {
  const { displayMode } = useAppStore()

  return (
    <div className="bg-surface rounded-xl p-6">
      <div className="mb-4">
        <h3 className="font-medium text-primary">
          {displayMode === 'boardroom' ? 'Predictability Score' : 'Forecastability Index'}
        </h3>
        <p className="text-xs text-secondary mt-1">
          {displayMode === 'boardroom'
            ? 'How predictable is your data? Higher means models can forecast it more accurately.'
            : 'Composite score: signal strength (40%), regularity (25%), stationarity (15%), sample adequacy (10%), noise (10%).'}
        </p>
      </div>

      <div className="flex items-start gap-6">
        <div className="flex flex-col items-center">
          <GaugeArc score={result.total_score} />
          <p className="text-sm text-secondary mt-2 text-center max-w-[200px]">
            {result.interpretation}
          </p>
        </div>

        <div className="flex-1 space-y-3">
          {result.dimensions.map((dim) => (
            <div key={dim.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-primary font-medium" title={dim.description}>
                  {dim.name}
                </span>
                <span className="text-secondary">
                  {dim.score.toFixed(0)} / 100
                </span>
              </div>
              <div className="h-2 bg-canvas rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${dim.score}%`,
                    backgroundColor: getScoreColor(dim.score),
                  }}
                />
              </div>
              {displayMode === 'boardroom' && (
                <p className="text-[10px] text-secondary/70 mt-0.5">{dim.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
