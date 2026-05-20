import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../../stores/useAppStore'
import { FREQUENCY_LABELS } from '../../types'
import type { Frequency } from '../../types'

const PERIOD_LABELS: Record<Frequency, number> = {
  H: 24,
  D: 7,
  W: 52,
  M: 12,
  Q: 4,
  Y: 1,
}

interface Props {
  frequency: Frequency
}

export function SeasonalityOverride({ frequency }: Props) {
  const queryClient = useQueryClient()
  const { periodOverride, setPeriodOverride } = useAppStore()
  const autoPeriod = PERIOD_LABELS[frequency]
  const freqLabel = FREQUENCY_LABELS[frequency].label

  const [localValue, setLocalValue] = useState<string>(
    periodOverride ? String(periodOverride) : ''
  )
  const [isEditing, setIsEditing] = useState(false)

  const handleApply = () => {
    const parsed = parseInt(localValue, 10)
    if (parsed >= 2 && parsed <= 365) {
      setPeriodOverride(parsed)
      queryClient.invalidateQueries({ queryKey: ['diagnostics'] })
    }
    setIsEditing(false)
  }

  const handleReset = () => {
    setLocalValue('')
    setPeriodOverride(null)
    setIsEditing(false)
    queryClient.invalidateQueries({ queryKey: ['diagnostics'] })
  }

  const activePeriod = periodOverride ?? autoPeriod

  return (
    <div className="bg-surface rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-primary mb-1">Seasonality Period</h3>
          <p className="text-xs text-secondary">
            Auto-detected: <span className="font-mono font-medium text-primary">{autoPeriod}</span> {freqLabel}
            {periodOverride && (
              <span className="ml-2 text-accent-orange">
                (overridden to <span className="font-mono font-medium">{periodOverride}</span>)
              </span>
            )}
          </p>
          <p className="text-[10px] text-secondary/60 mt-1">
            Controls STL decomposition, forecastability scoring, and rolling window size.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <input
                type="number"
                min={2}
                max={365}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApply()
                  if (e.key === 'Escape') setIsEditing(false)
                }}
                placeholder={String(autoPeriod)}
                className="w-20 px-2 py-1.5 text-xs font-mono bg-canvas border border-surface rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
                autoFocus
              />
              <button
                onClick={handleApply}
                className="px-2.5 py-1.5 text-xs font-medium bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-2 py-1.5 text-xs text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <span className="text-lg font-bold font-mono text-primary">{activePeriod}</span>
              <button
                onClick={() => {
                  setLocalValue(periodOverride ? String(periodOverride) : '')
                  setIsEditing(true)
                }}
                className="px-2.5 py-1.5 text-xs text-secondary border border-surface rounded-lg hover:border-secondary hover:text-primary transition-colors"
              >
                Override
              </button>
              {periodOverride && (
                <button
                  onClick={handleReset}
                  className="px-2.5 py-1.5 text-xs text-accent-orange border border-accent-orange/20 rounded-lg hover:bg-accent-orange/5 transition-colors"
                >
                  Reset
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
