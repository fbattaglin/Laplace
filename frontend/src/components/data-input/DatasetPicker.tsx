import { useDatasets, useLoadDataset } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'

export function DatasetPicker() {
  const { displayMode } = useAppStore()
  const { data: datasets, isLoading } = useDatasets()
  const loadDataset = useLoadDataset()

  if (isLoading) {
    return <div className="text-secondary">Loading datasets...</div>
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-secondary uppercase tracking-wide mb-3">
        {displayMode === 'boardroom' ? 'Sample Datasets' : 'Preloaded Reference Datasets'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {datasets?.map((ds) => (
          <button
            key={ds.name}
            onClick={() => loadDataset.mutate(ds.name)}
            disabled={loadDataset.isPending}
            className="text-left bg-surface rounded-xl p-5 hover:ring-2 hover:ring-accent-blue/30 transition-all disabled:opacity-50"
          >
            <p className="font-medium text-primary mb-1">{ds.name.replace(/_/g, ' ')}</p>
            <p className="text-sm text-secondary mb-3">{ds.description}</p>
            <div className="flex gap-3 text-xs text-secondary">
              <span className="bg-canvas px-2 py-0.5 rounded">{ds.frequency}</span>
              <span className="bg-canvas px-2 py-0.5 rounded">{ds.n_rows} points</span>
            </div>
          </button>
        ))}
      </div>
      {loadDataset.isError && (
        <p className="mt-3 text-sm text-accent-red">
          Failed to load dataset: {loadDataset.error.message}
        </p>
      )}
    </div>
  )
}
