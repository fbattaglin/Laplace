import { useAppStore } from '../../stores/useAppStore'

interface Props {
  count: number
  features: string[]
}

export function LabNudge({ count, features }: Props) {
  const { displayMode, setDisplayMode } = useAppStore()

  if (displayMode === 'lab') return null

  return (
    <button
      onClick={() => setDisplayMode('lab')}
      className="w-full flex items-center justify-between px-4 py-2.5
                 bg-accent-purple/5 border border-accent-purple/15 rounded-xl
                 text-xs text-secondary hover:bg-accent-purple/10 transition-colors group"
    >
      <span className="flex items-center gap-2">
        <span className="text-accent-purple">⚗</span>
        <span>
          Lab adds{' '}
          <span className="font-semibold text-accent-purple">
            {count} more tool{count !== 1 ? 's' : ''}
          </span>{' '}
          on this screen
          <span className="text-secondary/50 ml-1.5">· {features.join(' · ')}</span>
        </span>
      </span>
      <span className="text-accent-purple shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        Switch →
      </span>
    </button>
  )
}
