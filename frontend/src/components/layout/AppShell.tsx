import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../../stores/useAppStore'
import { StepNav } from './StepNav'
import { PreprocessingBanner } from './PreprocessingBanner'
import laplaceLogo from '../../logo/laplace_logo.png'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { displayMode, setDisplayMode, reset } = useAppStore()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

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
          <div className="flex bg-surface rounded-lg p-0.5">
            <button
              title="Business view — clean results, no statistical detail"
              onClick={() => setDisplayMode('boardroom')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                displayMode === 'boardroom'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Boardroom
            </button>
            <button
              title="Analyst view — full diagnostics, data prep, Lab controls"
              onClick={() => setDisplayMode('lab')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                displayMode === 'lab'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Lab
            </button>
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
