import { useState } from 'react'

import type { Metrics } from '../../types'
import { useAppStore } from '../../stores/useAppStore'
import { modelColorMap } from '../../lib/colors'

interface Props {
  metrics: Record<string, Metrics>
  winner: string
}

type SortKey = 'model' | 'mae' | 'rmse' | 'mape' | 'smape' | 'mase'

export function MetricsTable({ metrics, winner }: Props) {
  const { displayMode } = useAppStore()
  const [sortKey, setSortKey] = useState<SortKey>('smape')
  const [sortAsc, setSortAsc] = useState(true)

  const models = Object.entries(metrics).sort((a, b) => {
    if (sortKey === 'model') {
      return sortAsc ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])
    }
    const aVal = a[1][sortKey] ?? Infinity
    const bVal = b[1][sortKey] ?? Infinity
    return sortAsc ? aVal - bVal : bVal - aVal
  })

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (column !== sortKey) return <span className="text-secondary/40 ml-1">↕</span>
    return <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>
  }

  return (
    <div className="bg-surface rounded-xl p-6">
      <div className="mb-4">
        <h3 className="font-medium text-primary">
          {displayMode === 'boardroom' ? 'Model Comparison' : 'Aggregate Metrics'}
        </h3>
        <p className="text-xs text-secondary mt-1">
          {displayMode === 'boardroom'
            ? 'Lower values are better. The highlighted row is the best-performing model.'
            : 'Mean metrics across all CV folds. Winner selected by lowest sMAPE.'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-primary/10">
              <th
                className="text-left py-2 px-3 font-medium cursor-pointer hover:text-accent-blue"
                onClick={() => handleSort('model')}
              >
                Model <SortIcon column="model" />
              </th>
              <th
                className="text-right py-2 px-3 font-medium cursor-pointer hover:text-accent-blue"
                onClick={() => handleSort('smape')}
              >
                sMAPE (%) <SortIcon column="smape" />
              </th>
              <th
                className="text-right py-2 px-3 font-medium cursor-pointer hover:text-accent-blue"
                onClick={() => handleSort('mae')}
              >
                MAE <SortIcon column="mae" />
              </th>
              <th
                className="text-right py-2 px-3 font-medium cursor-pointer hover:text-accent-blue"
                onClick={() => handleSort('rmse')}
              >
                RMSE <SortIcon column="rmse" />
              </th>
              <th
                className="text-right py-2 px-3 font-medium cursor-pointer hover:text-accent-blue"
                onClick={() => handleSort('mape')}
              >
                MAPE (%) <SortIcon column="mape" />
              </th>
              <th
                className="text-right py-2 px-3 font-medium cursor-pointer hover:text-accent-blue"
                onClick={() => handleSort('mase')}
              >
                MASE <SortIcon column="mase" />
              </th>
            </tr>
          </thead>
          <tbody>
            {models.map(([name, m]) => {
              const isWinner = name === winner
              const color = modelColorMap[name]
              return (
                <tr
                  key={name}
                  className={`border-b border-primary/5 ${isWinner ? 'bg-accent-blue/5' : ''}`}
                >
                  <td className="py-2 px-3 flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className={isWinner ? 'font-semibold' : ''}>{name}</span>
                    {isWinner && (
                      <span className="text-[10px] bg-accent-blue text-white px-1.5 py-0.5 rounded font-medium">
                        BEST
                      </span>
                    )}
                  </td>
                  <td className="text-right py-2 px-3 font-mono">{m.smape.toFixed(2)}</td>
                  <td className="text-right py-2 px-3 font-mono">{m.mae.toFixed(2)}</td>
                  <td className="text-right py-2 px-3 font-mono">{m.rmse.toFixed(2)}</td>
                  <td className="text-right py-2 px-3 font-mono">
                    {m.mape !== null ? m.mape.toFixed(2) : '—'}
                  </td>
                  <td className="text-right py-2 px-3 font-mono">{m.mase.toFixed(3)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
