import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../../stores/useAppStore'
import { t } from '../../lib/copy'
import { StepNav } from './StepNav'

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
      <header className="border-b border-surface px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-semibold tracking-tight text-primary">
            {t('app.title', displayMode)}
          </h1>
          <StepNav />
        </div>

        <div className="flex items-center gap-4 text-sm">
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

          <button
            onClick={() => setDisplayMode('boardroom')}
            className={`px-3 py-1.5 rounded-l-md border transition-colors ${
              displayMode === 'boardroom'
                ? 'bg-primary text-white border-primary'
                : 'bg-canvas text-secondary border-surface hover:border-secondary'
            }`}
          >
            Boardroom
          </button>
          <button
            onClick={() => setDisplayMode('lab')}
            className={`px-3 py-1.5 rounded-r-md border transition-colors ${
              displayMode === 'lab'
                ? 'bg-primary text-white border-primary'
                : 'bg-canvas text-secondary border-surface hover:border-secondary'
            }`}
          >
            Lab
          </button>
        </div>
      </header>

      <main className="px-8 py-6">{children}</main>
    </div>
  )
}
