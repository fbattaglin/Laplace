import { useState } from 'react'
import { useRunHistory } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'
import { modelColorMap } from '../../lib/colors'

type SortField = 'timestamp' | 'dataset' | 'model' | 'smape' | 'forecastability_score'
type SortDir = 'asc' | 'desc'

interface RunEntry {
  timestamp?: string
  dataset?: string
  model?: string
  smape?: string
  mae?: string
  rmse?: string
  forecastability_score?: string
  n_observations?: string
  frequency?: string
  horizon?: string
  [key: string]: string | undefined
}

function parseNum(v: string | undefined): number {
  if (!v) return 0
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

function sortEntries(entries: RunEntry[], field: SortField, dir: SortDir): RunEntry[] {
  const sorted = [...entries]
  sorted.sort((a, b) => {
    let cmp = 0
    if (field === 'timestamp' || field === 'dataset' || field === 'model') {
      cmp = (a[field] || '').localeCompare(b[field] || '')
    } else {
      cmp = parseNum(a[field]) - parseNum(b[field])
    }
    return dir === 'asc' ? cmp : -cmp
  })
  return sorted
}

// ─── Model Win Rate Analytics ────────────────────────────────────────────────

interface WinRate {
  model: string
  wins: number
  total: number
  pct: number
}

function computeWinRates(entries: RunEntry[]): WinRate[] {
  const counts: Record<string, number> = {}
  for (const entry of entries) {
    const model = entry.model
    if (!model) continue
    counts[model] = (counts[model] || 0) + 1
  }

  const total = entries.length
  return Object.entries(counts)
    .map(([model, wins]) => ({ model, wins, total, pct: (wins / total) * 100 }))
    .sort((a, b) => b.wins - a.wins)
}

function WinRateBar({ data }: { data: WinRate[] }) {
  if (data.length === 0) return null

  const maxWins = Math.max(...data.map((d) => d.wins))

  return (
    <div className="bg-surface rounded-xl p-5">
      <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
        Model Win Rate
      </h4>
      <div className="space-y-2.5">
        {data.map((d) => (
          <div key={d.model} className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 w-28 shrink-0">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: modelColorMap[d.model] || '#999' }}
              />
              <span className="text-xs font-medium text-primary truncate">{d.model}</span>
            </div>
            <div className="flex-1 h-5 bg-canvas rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(d.wins / maxWins) * 100}%`,
                  backgroundColor: modelColorMap[d.model] || '#999',
                  opacity: 0.6,
                }}
              />
            </div>
            <span className="text-xs font-mono text-secondary w-20 text-right shrink-0">
              {d.wins} win{d.wins !== 1 ? 's' : ''} ({d.pct.toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-secondary/60 mt-3">
        Based on {data[0]?.total || 0} saved run{(data[0]?.total || 0) !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

// ─── Sort Header ────────────────────────────────────────────────────────────

function SortHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  align = 'left',
}: {
  label: string
  field: SortField
  currentField: SortField
  currentDir: SortDir
  onSort: (field: SortField) => void
  align?: 'left' | 'right'
}) {
  const isActive = currentField === field
  return (
    <th
      className={`text-${align} font-medium pb-2 pr-4 cursor-pointer select-none hover:text-primary transition-colors ${
        isActive ? 'text-primary' : 'text-secondary'
      }`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {isActive && (
          <span className="text-[9px]">{currentDir === 'asc' ? '▲' : '▼'}</span>
        )}
      </span>
    </th>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function RunHistory() {
  const { data, isLoading } = useRunHistory()
  const { displayMode } = useAppStore()
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const entries = (data?.entries || []) as RunEntry[]

  if (isLoading) return null
  if (entries.length === 0) {
    return (
      <div className="bg-surface rounded-xl p-6">
        <h3 className="font-medium text-primary mb-2">Run History</h3>
        <p className="text-sm text-secondary">No saved runs yet. Click "Save to Log" after completing an analysis.</p>
      </div>
    )
  }

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'smape' || field === 'forecastability_score' ? 'desc' : 'asc')
    }
  }

  const sorted = sortEntries(entries, sortField, sortDir)
  const winRates = entries.length >= 2 ? computeWinRates(entries) : []

  return (
    <div className="space-y-4">
      {/* Model win rate analytics (shown when ≥2 entries) */}
      {displayMode === 'lab' && winRates.length > 0 && (
        <WinRateBar data={winRates} />
      )}

      {/* Sortable run history table */}
      <div className="bg-surface rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-primary">Run History</h3>
          <span className="text-[10px] text-secondary/60">
            {entries.length} run{entries.length !== 1 ? 's' : ''} saved
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-canvas">
                <SortHeader label="Date" field="timestamp" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Dataset" field="dataset" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Model" field="model" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="sMAPE" field="smape" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="right" />
                <SortHeader label="Score" field="forecastability_score" currentField={sortField} currentDir={sortDir} onSort={handleSort} align="right" />
                <th className="text-right text-secondary font-medium pb-2">n</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, i) => {
                const score = parseNum(entry.forecastability_score)
                const scoreColor =
                  score >= 70
                    ? 'text-green-500'
                    : score >= 45
                    ? 'text-amber-500'
                    : score > 0
                    ? 'text-red-400'
                    : 'text-secondary'

                return (
                  <tr key={i} className="border-b border-canvas/50 hover:bg-canvas/50 transition-colors">
                    <td className="py-2 pr-4 text-secondary font-mono">
                      {entry.timestamp?.slice(0, 10) || '—'}
                    </td>
                    <td className="py-2 pr-4 text-primary font-medium max-w-[140px] truncate">
                      {entry.dataset?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: modelColorMap[entry.model || ''] || '#999' }}
                        />
                        <span className="text-secondary">{entry.model || '—'}</span>
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">
                      {entry.smape ? `${parseFloat(entry.smape).toFixed(2)}%` : '—'}
                    </td>
                    <td className={`py-2 pr-4 text-right font-mono font-medium ${scoreColor}`}>
                      {entry.forecastability_score
                        ? parseFloat(entry.forecastability_score).toFixed(0)
                        : '—'}
                    </td>
                    <td className="py-2 text-right font-mono text-secondary">
                      {entry.n_observations || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
