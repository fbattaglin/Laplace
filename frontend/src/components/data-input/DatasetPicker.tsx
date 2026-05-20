import { useDatasets, useLoadDataset } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'
import type { DatasetMeta } from '../../types'

const DOMAIN_LABELS: Record<string, string> = {
  transport:    'Transport',
  science:      'Science',
  energy:       'Energy',
  retail:       'Retail',
  economics:    'Economics',
  manufacturing:'Manufacturing',
  climate:      'Climate',
  healthcare:   'Healthcare',
  digital:      'Digital',
  finance:      'Finance',
  environment:  'Environment',
  hospitality:  'Hospitality',
  ecommerce:    'E-commerce',
}

// Color-coded domain tags — makes cards scannable at a glance
const DOMAIN_COLORS: Record<string, string> = {
  transport:    'bg-blue-500/10 text-blue-500',
  science:      'bg-indigo-500/10 text-indigo-400',
  energy:       'bg-amber-500/10 text-amber-600',
  retail:       'bg-teal-500/10 text-teal-600',
  economics:    'bg-emerald-500/10 text-emerald-600',
  manufacturing:'bg-orange-500/10 text-orange-500',
  climate:      'bg-sky-500/10 text-sky-500',
  environment:  'bg-green-600/10 text-green-600',
  healthcare:   'bg-pink-500/10 text-pink-500',
  finance:      'bg-yellow-500/10 text-yellow-600',
  digital:      'bg-violet-500/10 text-violet-500',
  hospitality:  'bg-rose-500/10 text-rose-500',
  ecommerce:    'bg-cyan-500/10 text-cyan-600',
}

const DOMAIN_ORDER = [
  'transport', 'energy', 'retail', 'hospitality', 'ecommerce',
  'economics', 'healthcare', 'finance', 'digital', 'environment',
  'manufacturing', 'climate',
]

// Classic benchmarks every forecasting practitioner knows
const CLASSIC_DATASET_NAMES = new Set([
  'airline_passengers',  // Box-Jenkins 1970 — the canonical benchmark
  'co2_atmospheric',     // Keeling Curve — iconic trend + seasonality
  'us_retail_sales',     // Macro-economics textbook standard
])

const GROUP_SUBTITLES: Record<string, string> = {
  'Classic Benchmarks': 'Textbook forecasting series — ideal for calibrating model expectations.',
  'Real-World Problems': 'Diverse domains with realistic noise, seasonality, and structural patterns.',
}

function groupByCategory(datasets: DatasetMeta[]): { label: string; items: DatasetMeta[] }[] {
  const classics = datasets.filter((d) => CLASSIC_DATASET_NAMES.has(d.name))
  const realWorld = datasets.filter((d) => !CLASSIC_DATASET_NAMES.has(d.name))

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
    return <div className="text-secondary text-sm">Loading datasets...</div>
  }

  const groups = groupByCategory(datasets || [])

  return (
    <div className="space-y-7">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-3">
            <h3 className="text-sm font-medium text-secondary uppercase tracking-wide">
              {displayMode === 'boardroom' ? group.label : `Preloaded — ${group.label}`}
            </h3>
            <p className="text-xs text-secondary/60 mt-0.5">
              {GROUP_SUBTITLES[group.label]}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((ds) => (
              <button
                key={ds.name}
                onClick={() => loadDataset.mutate(ds.name)}
                disabled={loadDataset.isPending}
                className="text-left bg-surface rounded-xl p-4 hover:ring-2 hover:ring-accent-blue/30 transition-all disabled:opacity-50 group"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-primary text-sm group-hover:text-accent-blue transition-colors">
                    {ds.name.replace(/_/g, ' ')}
                  </p>
                  {ds.domain && (
                    <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${DOMAIN_COLORS[ds.domain] || 'bg-canvas text-secondary'}`}>
                      {DOMAIN_LABELS[ds.domain] || ds.domain}
                    </span>
                  )}
                </div>
                <p className="text-xs text-secondary mb-2 line-clamp-2">{ds.description}</p>
                <div className="flex gap-2 text-[11px] text-secondary flex-wrap">
                  <span className="bg-canvas px-1.5 py-0.5 rounded">{ds.frequency}</span>
                  <span className="bg-canvas px-1.5 py-0.5 rounded">{ds.n_rows} pts</span>
                  {displayMode === 'lab' && ds.covariate_cols && ds.covariate_cols.length > 0 && (
                    <span className="bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded font-medium">
                      covariates
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
      {loadDataset.isError && (
        <p className="text-sm text-accent-red">
          Failed to load dataset: {loadDataset.error.message}
        </p>
      )}
    </div>
  )
}
