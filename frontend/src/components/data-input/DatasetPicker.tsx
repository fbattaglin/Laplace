import { useDatasets, useLoadDataset } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'
import type { DatasetMeta } from '../../types'

const DOMAIN_LABELS: Record<string, string> = {
  transport: 'Transport',
  science: 'Science',
  energy: 'Energy',
  retail: 'Retail',
  economics: 'Economics',
  manufacturing: 'Manufacturing',
  climate: 'Climate',
  healthcare: 'Healthcare',
  digital: 'Digital',
}

const DOMAIN_ORDER = ['transport', 'science', 'energy', 'retail', 'economics', 'manufacturing', 'climate', 'healthcare', 'digital']

function groupByCategory(datasets: DatasetMeta[]): { label: string; items: DatasetMeta[] }[] {
  const classics = datasets.filter((d) => !d.domain || ['transport', 'science'].includes(d.domain))
  const realWorld = datasets.filter((d) => d.domain && !['transport', 'science'].includes(d.domain))

  realWorld.sort((a, b) => {
    const ai = DOMAIN_ORDER.indexOf(a.domain || '')
    const bi = DOMAIN_ORDER.indexOf(b.domain || '')
    return ai - bi
  })

  const groups: { label: string; items: DatasetMeta[] }[] = []
  if (classics.length > 0) groups.push({ label: 'Classic Benchmarks', items: classics })
  if (realWorld.length > 0) groups.push({ label: 'Real-World Problems', items: realWorld })
  return groups
}

export function DatasetPicker() {
  const { displayMode } = useAppStore()
  const { data: datasets, isLoading } = useDatasets()
  const loadDataset = useLoadDataset()

  if (isLoading) {
    return <div className="text-secondary">Loading datasets...</div>
  }

  const groups = groupByCategory(datasets || [])

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="text-sm font-medium text-secondary uppercase tracking-wide mb-3">
            {displayMode === 'boardroom' ? group.label : `Preloaded — ${group.label}`}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((ds) => (
              <button
                key={ds.name}
                onClick={() => loadDataset.mutate(ds.name)}
                disabled={loadDataset.isPending}
                className="text-left bg-surface rounded-xl p-4 hover:ring-2 hover:ring-accent-blue/30 transition-all disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-primary text-sm">{ds.name.replace(/_/g, ' ')}</p>
                  {ds.domain && (
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-secondary bg-canvas px-1.5 py-0.5 rounded">
                      {DOMAIN_LABELS[ds.domain] || ds.domain}
                    </span>
                  )}
                </div>
                <p className="text-xs text-secondary mb-2 line-clamp-2">{ds.description}</p>
                <div className="flex gap-2 text-[11px] text-secondary">
                  <span className="bg-canvas px-1.5 py-0.5 rounded">{ds.frequency}</span>
                  <span className="bg-canvas px-1.5 py-0.5 rounded">{ds.n_rows} pts</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
      {loadDataset.isError && (
        <p className="mt-3 text-sm text-accent-red">
          Failed to load dataset: {loadDataset.error.message}
        </p>
      )}
    </div>
  )
}
