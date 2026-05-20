import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearLog, deleteLogEntry } from '../../api/client'
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
  const queryClient = useQueryClient()
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [confirmClear, setConfirmClear] = useState(false)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['run-history'] })

  const deleteMutation = useMutation({
    mutationFn: (originalIndex: number) => deleteLogEntry(originalIndex),
    onSuccess: invalidate,
  })

  const clearMutation = useMutation({
    mutationFn: clearLog,
    onSuccess: () => {
      invalidate()
      setConfirmClear(false)
    },
  })

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

  // Build sorted list with original indices so deletions map to the right row
  const indexed = entries.map((entry, originalIndex) => ({ entry, originalIndex }))
  indexed.sort((a, b) => {
    let cmp = 0
    if (sortField === 'timestamp' || sortField === 'dataset' || sortField === 'model') {
      cmp = (a.entry[sortField] || '').localeCompare(b.entry[sortField] || '')
    } else {
      cmp = parseNum(a.entry[sortField]) - parseNum(b.entry[sortField])
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

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

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-secondary/60">
              {entries.length} run{entries.length !== 1 ? 's' : ''} saved
            </span>

            {/* Clear all — with inline confirmation */}
            {confirmClear ? (
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] text-secondary">Clear all?</span>
                <button
                  onClick={() => clearMutation.mutate()}
                  disabled={clearMutation.isPending}
                  className="text-[10px] font-medium text-accent-red hover:opacity-80 transition-opacity"
                >
                  {clearMutation.isPending ? 'Clearing…' : 'Yes, clear'}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-[10px] text-secondary hover:text-primary transition-colors"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-[10px] text-secondary hover:text-accent-red transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
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
                <th className="text-right text-secondary font-medium pb-2 pr-0">n</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {indexed.map(({ entry, originalIndex }) => {
                const score = parseNum(entry.forecastability_score)
                const scoreColor =
                  score >= 70
                    ? 'text-green-500'
                    : score >= 45
                    ? 'text-amber-500'
                    : score > 0
                    ? 'text-red-400'
                    : 'text-secondary'
                const isDeleting = deleteMutation.isPending && deleteMutation.variables === originalIndex

                return (
                  <tr
                    key={originalIndex}
                    className={`border-b border-canvas/50 group transition-colors ${
                      isDeleting ? 'opacity-40' : 'hover:bg-canvas/50'
                    }`}
                  >
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
                    <td className="py-2 pr-3 text-right font-mono text-secondary">
                      {entry.n_observations || '—'}
                    </td>
                    {/* Per-row delete — visible on row hover */}
                    <td className="py-2 w-6">
                      <button
                        onClick={() => deleteMutation.mutate(originalIndex)}
                        disabled={deleteMutation.isPending}
                        title="Delete this entry"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-secondary hover:text-accent-red disabled:opacity-30 text-sm leading-none"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {deleteMutation.isError && (
          <p className="mt-2 text-xs text-accent-red">Failed to delete entry.</p>
        )}
        {clearMutation.isError && (
          <p className="mt-2 text-xs text-accent-red">Failed to clear log.</p>
        )}
      </div>
    </div>
  )
}
