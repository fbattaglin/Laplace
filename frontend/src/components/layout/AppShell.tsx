import { useAppStore } from '../../stores/useAppStore'
import { t } from '../../lib/copy'
import { StepNav } from './StepNav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { displayMode, setDisplayMode } = useAppStore()

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-surface px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-semibold tracking-tight text-primary">
            {t('app.title', displayMode)}
          </h1>
          <StepNav />
        </div>

        <div className="flex items-center gap-2 text-sm">
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
