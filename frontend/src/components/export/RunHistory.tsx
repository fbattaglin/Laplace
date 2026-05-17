import { useRunHistory } from '../../hooks/useApi'

export function RunHistory() {
  const { data, isLoading } = useRunHistory()
  const entries = data?.entries || []

  if (isLoading) return null
  if (entries.length === 0) {
    return (
      <div className="bg-surface rounded-xl p-6">
        <h3 className="font-medium text-primary mb-2">Run History</h3>
        <p className="text-sm text-secondary">No saved runs yet. Click "Save to Log" after completing an analysis.</p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl p-6">
      <h3 className="font-medium text-primary mb-4">Run History</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-canvas">
              <th className="text-left text-secondary font-medium pb-2 pr-4">Date</th>
              <th className="text-left text-secondary font-medium pb-2 pr-4">Dataset</th>
              <th className="text-left text-secondary font-medium pb-2 pr-4">Model</th>
              <th className="text-right text-secondary font-medium pb-2 pr-4">sMAPE</th>
              <th className="text-right text-secondary font-medium pb-2 pr-4">Score</th>
              <th className="text-right text-secondary font-medium pb-2">n</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice().reverse().map((entry, i) => (
              <tr key={i} className="border-b border-canvas/50 hover:bg-canvas/50 transition-colors">
                <td className="py-2 pr-4 text-secondary font-mono">{entry.timestamp?.slice(0, 10) || '—'}</td>
                <td className="py-2 pr-4 text-primary font-medium max-w-[120px] truncate">{entry.dataset || '—'}</td>
                <td className="py-2 pr-4 text-secondary">{entry.model || '—'}</td>
                <td className="py-2 pr-4 text-right font-mono">
                  {entry.smape ? `${parseFloat(entry.smape).toFixed(2)}%` : '—'}
                </td>
                <td className="py-2 pr-4 text-right font-mono">
                  {entry.forecastability_score ? parseFloat(entry.forecastability_score).toFixed(0) : '—'}
                </td>
                <td className="py-2 text-right font-mono text-secondary">{entry.n_observations || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
