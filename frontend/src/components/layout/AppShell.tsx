import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../../stores/useAppStore'
import { StepNav } from './StepNav'
import { PreprocessingBanner } from './PreprocessingBanner'
import laplaceLogo from '../../logo/laplace_logo.png'

const LAB_FEATURES = [
  { icon: '⚡', label: 'Ensemble forecast', desc: 'Inverse-sMAPE weighted combo of all 5 models' },
  { icon: '⚙️', label: 'Backtest config', desc: 'Set folds, horizon, and selection metric' },
  { icon: '🧹', label: 'Data Prep', desc: 'Outlier removal, smoothing, differencing' },
  { icon: '📊', label: 'Covariate support', desc: 'Add exogenous variables to the forecast' },
  { icon: '🎯', label: 'Calibration chart', desc: 'Prediction interval coverage per model' },
  { icon: '🔬', label: 'Per-fold detail', desc: 'Expand backtest fold-by-fold breakdown' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { displayMode, setDisplayMode, reset } = useAppStore()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [labHovered, setLabHovered] = useState(false)

  function handleReset() {
    queryClient.clear()
    reset()
    setConfirming(false)
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Top bar: logo + utilities */}
      <header className="px-8 py-3 flex items-center justify-between">
        <img src={laplaceLogo} alt="Laplace" className="h-[98px] w-auto" />

        <div className="flex items-center gap-3">
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-secondary text-xs">Reset everything?</span>
              <button
                onClick={() => setConfirming(false)}
                className="px-3 py-1.5 rounded-lg border border-surface text-secondary hover:border-secondary hover:text-primary transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg bg-accent-red/10 text-accent-red border border-accent-red/20 hover:bg-accent-red/20 transition-colors text-xs font-medium"
              >
                Reset
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="px-3 py-1.5 rounded-lg border border-surface text-secondary hover:border-secondary hover:text-primary transition-colors text-xs"
            >
              New Analysis
            </button>
          )}

          <div className="w-px h-4 bg-surface" />

          {/* Segmented mode toggle */}
          <div className="relative flex bg-surface rounded-lg p-0.5">
            {/* Boardroom button */}
            <button
              onClick={() => setDisplayMode('boardroom')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                displayMode === 'boardroom'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Boardroom
            </button>

            {/* Lab button — with flask icon + feature badge when inactive */}
            <button
              onClick={() => { setDisplayMode('lab'); setLabHovered(false) }}
              onMouseEnter={() => setLabHovered(true)}
              onMouseLeave={() => setLabHovered(false)}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                displayMode === 'lab'
                  ? 'bg-accent-purple/10 text-accent-purple shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <span className={displayMode === 'lab' ? '' : 'opacity-50'}>⚗</span>
              <span>Lab</span>
              {displayMode === 'boardroom' && (
                <span className="bg-accent-purple/10 text-accent-purple text-[9px] px-1 py-0.5 rounded font-semibold leading-none">
                  {LAB_FEATURES.length}+
                </span>
              )}
            </button>

            {/* Feature discovery popover — shown on Lab hover when in Boardroom */}
            {displayMode === 'boardroom' && labHovered && (
              <div
                className="absolute top-full right-0 mt-2 w-72 bg-canvas border border-surface rounded-xl shadow-xl p-4 z-50"
                onMouseEnter={() => setLabHovered(true)}
                onMouseLeave={() => setLabHovered(false)}
              >
                <p className="text-xs font-semibold text-primary mb-3">Lab mode unlocks:</p>
                <ul className="space-y-2">
                  {LAB_FEATURES.map((f) => (
                    <li key={f.label} className="flex items-start gap-2 text-xs text-secondary">
                      <span className="text-accent-purple shrink-0 mt-px">{f.icon}</span>
                      <span>
                        <span className="font-medium text-primary">{f.label}</span>
                        {' — '}{f.desc}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => { setDisplayMode('lab'); setLabHovered(false) }}
                  className="mt-3 w-full py-1.5 bg-accent-purple text-white rounded-lg text-xs font-medium hover:bg-accent-purple/90 transition-colors"
                >
                  Switch to Lab →
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Stepper row — its own visual layer */}
      <div className="px-8 py-4 border-t border-b border-surface">
        <StepNav />
      </div>

      {/* Preprocessing banner — appears on all screens when active */}
      <PreprocessingBanner />

      <main className="px-8 py-8">{children}</main>
    </div>
  )
}
