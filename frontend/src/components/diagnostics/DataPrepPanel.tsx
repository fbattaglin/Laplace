import { useState } from 'react'
import { usePreprocessing } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'
import { t } from '../../lib/copy'
import type { PreprocessingConfig } from '../../types'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none ${
        checked ? 'bg-accent-blue' : 'bg-surface border border-secondary/30'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-surface rounded-lg px-2 py-1.5 bg-canvas text-primary focus:outline-none focus:border-accent-blue/50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

interface Props {
  outlierCount?: number
  isStationary?: boolean
}

export function DataPrepPanel({ outlierCount = 0, isStationary = true }: Props) {
  const { displayMode, preprocessedData, timeSeriesData } = useAppStore()
  const { apply, reset } = usePreprocessing()

  const [config, setConfig] = useState<PreprocessingConfig>({
    remove_outliers: false,
    outlier_method: 'iqr',
    outlier_replacement: 'interpolate',
    smooth: false,
    smooth_method: 'sma',
    smooth_window: null,
    difference: false,
    difference_order: 1,
  })

  const [windowInput, setWindowInput] = useState('')

  function patch<K extends keyof PreprocessingConfig>(key: K, value: PreprocessingConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  function handleApply() {
    const resolvedConfig = {
      ...config,
      smooth_window: windowInput ? parseInt(windowInput) : null,
    }
    apply.mutate(resolvedConfig)
  }

  function handleReset() {
    setConfig({
      remove_outliers: false,
      outlier_method: 'iqr',
      outlier_replacement: 'interpolate',
      smooth: false,
      smooth_method: 'sma',
      smooth_window: null,
      difference: false,
      difference_order: 1,
    })
    setWindowInput('')
    reset()
  }

  const isActive = !!preprocessedData
  const nOps = [config.remove_outliers, config.smooth, config.difference].filter(Boolean).length

  return (
    <div className="space-y-5">
      {/* Detected issues summary — shown before the controls so the user understands what needs fixing */}
      {(outlierCount > 0 || !isStationary) && !isActive && (
        <div className="bg-accent-orange/8 border border-accent-orange/20 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-accent-orange">Issues detected in your data</p>
          {outlierCount > 0 && (
            <p className="text-xs text-secondary">
              · {outlierCount} outlier{outlierCount > 1 ? 's' : ''} detected — consider removing or winsorizing
            </p>
          )}
          {!isStationary && (
            <p className="text-xs text-secondary">
              · Non-stationary series — differencing can stabilize the mean before modeling
            </p>
          )}
        </div>
      )}

      {/* Active badge */}
      {isActive && (
        <div className="flex items-center gap-2 bg-accent-blue/8 border border-accent-blue/20 rounded-xl px-4 py-3">
          <span className="w-2 h-2 rounded-full bg-accent-blue" />
          <p className="text-xs text-accent-blue font-medium">{t('dataPrepApplied', displayMode)}</p>
          {preprocessedData.log.map((step, i) => (
            <span key={i} className="text-[10px] bg-accent-blue/10 text-accent-blue px-2 py-0.5 rounded">
              {step.description}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-secondary">{t('dataPrepSubtitle', displayMode)}</p>

      {/* ── Outlier removal ─────────────────────────────────────────── */}
      <div className="bg-canvas rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary">{t('outlierTitle', displayMode)}</p>
            {timeSeriesData && (
              <p className="text-xs text-secondary mt-0.5">
                IQR bounds computed from your data
              </p>
            )}
          </div>
          <Toggle checked={config.remove_outliers} onChange={(v) => patch('remove_outliers', v)} />
        </div>

        {config.remove_outliers && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <p className="text-xs text-secondary mb-1">{t('outlierMethod', displayMode)}</p>
              <Select
                value={config.outlier_method}
                onChange={(v) => patch('outlier_method', v as 'iqr' | 'zscore')}
                options={[
                  { value: 'iqr', label: 'IQR (1.5×)' },
                  { value: 'zscore', label: 'Z-score (|z|>3)' },
                ]}
              />
            </div>
            <div>
              <p className="text-xs text-secondary mb-1">{t('outlierReplacement', displayMode)}</p>
              <Select
                value={config.outlier_replacement}
                onChange={(v) => patch('outlier_replacement', v as 'interpolate' | 'winsorize')}
                options={[
                  { value: 'interpolate', label: 'Interpolate' },
                  { value: 'winsorize', label: 'Winsorize' },
                ]}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Smoothing ────────────────────────────────────────────────── */}
      <div className="bg-canvas rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary">{t('smoothTitle', displayMode)}</p>
            <p className="text-xs text-secondary mt-0.5">Reduces noise while preserving trend</p>
          </div>
          <Toggle checked={config.smooth} onChange={(v) => patch('smooth', v)} />
        </div>

        {config.smooth && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <p className="text-xs text-secondary mb-1">{t('smoothMethod', displayMode)}</p>
              <Select
                value={config.smooth_method}
                onChange={(v) => patch('smooth_method', v as 'sma' | 'ema')}
                options={[
                  { value: 'sma', label: 'SMA (centered)' },
                  { value: 'ema', label: 'EMA (span)' },
                ]}
              />
            </div>
            <div>
              <p className="text-xs text-secondary mb-1">{t('smoothWindow', displayMode)}</p>
              <input
                type="number"
                min={2}
                value={windowInput}
                placeholder="auto"
                onChange={(e) => setWindowInput(e.target.value)}
                className="w-full text-xs border border-surface rounded-lg px-2 py-1.5 bg-canvas text-primary focus:outline-none focus:border-accent-blue/50"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Differencing ─────────────────────────────────────────────── */}
      <div className="bg-canvas rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary">{t('differenceTitle', displayMode)}</p>
            <p className="text-xs text-secondary mt-0.5">Makes a non-stationary series stationary</p>
          </div>
          <Toggle checked={config.difference} onChange={(v) => patch('difference', v)} />
        </div>

        {config.difference && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-secondary mb-1">{t('differenceOrder', displayMode)}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => patch('difference_order', Math.max(1, config.difference_order - 1))}
                    className="w-7 h-7 rounded border border-surface text-primary text-sm hover:bg-surface"
                  >
                    −
                  </button>
                  <span className="text-sm font-mono w-4 text-center">{config.difference_order}</span>
                  <button
                    onClick={() => patch('difference_order', Math.min(2, config.difference_order + 1))}
                    className="w-7 h-7 rounded border border-surface text-primary text-sm hover:bg-surface"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-secondary/70">{t('differenceWarning', displayMode)}</p>
          </div>
        )}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleApply}
          disabled={apply.isPending || nOps === 0}
          className="px-5 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-40"
        >
          {apply.isPending ? 'Applying…' : t('dataPrepApply', displayMode)}
        </button>

        {isActive && (
          <button
            onClick={handleReset}
            className="px-5 py-2 rounded-lg border border-surface text-secondary text-sm hover:border-secondary hover:text-primary transition-colors"
          >
            {t('dataPrepReset', displayMode)}
          </button>
        )}

        {nOps === 0 && !isActive && (
          <p className="text-xs text-secondary/60">Enable at least one transformation to apply.</p>
        )}

        {apply.isError && (
          <p className="text-xs text-accent-red">{apply.error.message}</p>
        )}
      </div>
    </div>
  )
}
