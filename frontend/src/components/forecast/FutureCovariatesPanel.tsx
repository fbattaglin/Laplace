import { useState, useEffect } from 'react'

interface Props {
  covariates: Record<string, number[]>  // historical values per covariate
  horizon: number
  onChange: (futureCovariates: Record<string, number[]>) => void
}

type Method = 'constant' | 'trend'

interface CovConfig {
  method: Method
  constantValue: number
}

function generateFutureValues(
  historical: number[],
  method: Method,
  constantValue: number,
  horizon: int,
): number[] {
  if (method === 'constant') {
    return Array(horizon).fill(constantValue)
  }
  // Linear trend: fit last 10 points (or all if fewer)
  const window = Math.min(10, historical.length)
  const tail = historical.slice(-window)
  if (tail.length < 2) return Array(horizon).fill(tail[0] ?? 0)
  const n = tail.length
  const xs = Array.from({ length: n }, (_, i) => i)
  const xMean = (n - 1) / 2
  const yMean = tail.reduce((a, b) => a + b, 0) / n
  const slope =
    xs.reduce((sum, x, i) => sum + (x - xMean) * (tail[i] - yMean), 0) /
    xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0)
  const intercept = yMean - slope * xMean
  return Array.from({ length: horizon }, (_, i) => intercept + slope * (n + i))
}

// TypeScript fix: horizon is a number, not 'int'
type int = number

export function FutureCovariatesPanel({ covariates, horizon, onChange }: Props) {
  const covNames = Object.keys(covariates)

  const [configs, setConfigs] = useState<Record<string, CovConfig>>(() =>
    Object.fromEntries(
      covNames.map((name) => {
        const hist = covariates[name]
        const lastVal = hist[hist.length - 1] ?? 0
        return [name, { method: 'constant' as Method, constantValue: lastVal }]
      }),
    ),
  )

  // Recompute and emit future covariates whenever configs or horizon change
  useEffect(() => {
    const result: Record<string, number[]> = {}
    for (const name of covNames) {
      const cfg = configs[name] ?? { method: 'constant', constantValue: 0 }
      result[name] = generateFutureValues(covariates[name], cfg.method, cfg.constantValue, horizon)
    }
    onChange(result)
  }, [configs, horizon]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateConfig(name: string, patch: Partial<CovConfig>) {
    setConfigs((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }))
  }

  return (
    <div className="bg-canvas rounded-xl border border-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-medium text-secondary uppercase tracking-wide">
          Future Covariates
        </p>
        <span className="text-[9px] bg-[#8B5CF6] text-white px-1.5 py-0.5 rounded font-medium">
          LAB
        </span>
      </div>
      <p className="text-xs text-secondary/70 mb-4">
        Specify how each exogenous variable evolves over the forecast horizon.
      </p>

      <div className="space-y-3">
        {covNames.map((name) => {
          const cfg = configs[name] ?? { method: 'constant', constantValue: 0 }
          const hist = covariates[name]
          const lastVal = hist[hist.length - 1] ?? 0

          return (
            <div key={name} className="flex flex-wrap items-center gap-3 py-2 border-b border-surface last:border-0">
              <span className="text-xs font-medium text-primary w-24 shrink-0 truncate" title={name}>
                {name}
              </span>

              {/* Method selector */}
              <div className="flex gap-1">
                {(['constant', 'trend'] as Method[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => updateConfig(name, { method: m })}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors capitalize ${
                      cfg.method === m
                        ? 'border-[#8B5CF6] bg-[#8B5CF6]/5 text-[#8B5CF6] font-medium'
                        : 'border-primary/10 text-secondary hover:border-primary/20'
                    }`}
                  >
                    {m === 'constant' ? 'Constant' : 'Linear trend'}
                  </button>
                ))}
              </div>

              {/* Value input for constant method */}
              {cfg.method === 'constant' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-secondary">Value:</span>
                  <input
                    type="number"
                    value={cfg.constantValue}
                    onChange={(e) => updateConfig(name, { constantValue: parseFloat(e.target.value) || 0 })}
                    className="w-20 text-right border border-primary/10 rounded py-0.5 px-2 text-xs font-mono"
                  />
                  <button
                    onClick={() => updateConfig(name, { constantValue: lastVal })}
                    title="Reset to last historical value"
                    className="text-[10px] text-secondary/50 hover:text-secondary transition-colors"
                  >
                    ↺
                  </button>
                </div>
              )}

              {cfg.method === 'trend' && (
                <span className="text-xs text-secondary/60">
                  Extrapolating from last {Math.min(10, hist.length)} points
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
