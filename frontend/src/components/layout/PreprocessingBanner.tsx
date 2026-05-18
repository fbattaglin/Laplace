import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../../stores/useAppStore'

export function PreprocessingBanner() {
  const { preprocessedData, resetPreprocessing } = useAppStore()
  const queryClient = useQueryClient()

  if (!preprocessedData) return null

  const labels = preprocessedData.log.map((s) => s.description).join(' · ')

  function handleReset() {
    resetPreprocessing()
    queryClient.invalidateQueries({ queryKey: ['diagnostics'] })
    queryClient.invalidateQueries({ queryKey: ['backtest'] })
  }

  return (
    <div className="flex items-center justify-between px-8 py-2 bg-accent-blue/5 border-b border-accent-blue/10 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-blue shrink-0" />
        <span className="text-secondary shrink-0">Preprocessing active —</span>
        <span className="text-primary font-medium truncate">{labels}</span>
      </div>
      <button
        onClick={handleReset}
        className="ml-4 shrink-0 text-secondary hover:text-accent-red transition-colors"
      >
        × Reset
      </button>
    </div>
  )
}
