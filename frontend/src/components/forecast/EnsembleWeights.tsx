import type { Metrics } from '../../types'

interface Props {
  aggregateMetrics: Record<string, Metrics>
}

export function EnsembleWeights({ aggregateMetrics }: Props) {
  const MIN_SMAPE = 1e-3

  const entries = Object.entries(aggregateMetrics)
  if (entries.length === 0) return null

  const rawWeights = entries.map(([name, m]) => ({
    name,
    smape: m.smape,
    raw: 1 / Math.max(m.smape, MIN_SMAPE),
  }))
  const total = rawWeights.reduce((s, w) => s + w.raw, 0)
  const weights = rawWeights
    .map((w) => ({ ...w, weight: w.raw / total }))
    .sort((a, b) => b.weight - a.weight)

  return (
    <div className="bg-canvas rounded-xl border border-surface p-4">
      <p className="text-xs font-medium text-secondary uppercase tracking-wide mb-3">
        Ensemble weights — inverse-sMAPE
      </p>
      <div className="space-y-2">
        {weights.map(({ name, weight, smape }) => (
          <div key={name} className="flex items-center gap-3">
            <span className="text-xs text-secondary w-24 shrink-0 truncate">{name}</span>
            <div className="flex-1 bg-surface rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-[#8B5CF6]"
                style={{ width: `${(weight * 100).toFixed(1)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-primary w-10 text-right">
              {(weight * 100).toFixed(1)}%
            </span>
            <span className="text-xs text-secondary/60 w-16 text-right">
              {smape.toFixed(2)}% sMAPE
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
