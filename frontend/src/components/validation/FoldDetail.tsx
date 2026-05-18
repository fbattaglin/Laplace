import type { FoldResult } from '../../types'
import { modelColorMap } from '../../lib/colors'

interface Props {
  folds: FoldResult[]
  winner: string
}

export function FoldDetail({ folds, winner }: Props) {
  if (!folds || folds.length === 0) return null

  // Collect all model names from the first fold
  const modelNames = Object.keys(folds[0].metrics)

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-surface">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-surface bg-canvas">
            <th className="px-3 py-2.5 text-left font-medium text-secondary">Fold</th>
            <th className="px-3 py-2.5 text-left font-medium text-secondary">Train ends at</th>
            {modelNames.map((name) => (
              <th key={name} className="px-3 py-2.5 text-right font-medium text-secondary">
                <span className="flex items-center justify-end gap-1">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: modelColorMap[name] || '#999' }}
                  />
                  {name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {folds.map((fold) => {
            // Find the best model for this fold (lowest sMAPE)
            const foldBest = modelNames.reduce((best, name) => {
              const smape = fold.metrics[name]?.smape ?? Infinity
              const bestSmape = fold.metrics[best]?.smape ?? Infinity
              return smape < bestSmape ? name : best
            }, modelNames[0])

            return (
              <tr key={fold.fold} className="border-b border-surface last:border-0 hover:bg-surface/40 transition-colors">
                <td className="px-3 py-2 font-mono text-secondary">#{fold.fold}</td>
                <td className="px-3 py-2 text-secondary">idx {fold.train_end_idx}</td>
                {modelNames.map((name) => {
                  const m = fold.metrics[name]
                  const smape = m?.smape
                  const isBest = name === foldBest

                  return (
                    <td key={name} className="px-3 py-2 text-right">
                      <span
                        className={`font-mono ${
                          isBest
                            ? 'font-semibold text-primary'
                            : 'text-secondary'
                        }`}
                      >
                        {smape != null ? (
                          <>
                            {smape.toFixed(2)}%
                            {isBest && (
                              <span
                                className="ml-1 text-[9px] px-1 py-0.5 rounded text-white"
                                style={{ backgroundColor: modelColorMap[name] || '#666' }}
                              >
                                ✓
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-secondary/40">—</span>
                        )}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>

        {/* Aggregate row */}
        <tfoot>
          <tr className="border-t border-surface bg-surface/30">
            <td className="px-3 py-2.5 text-xs font-medium text-secondary" colSpan={2}>
              Overall winner
            </td>
            {modelNames.map((name) => (
              <td key={name} className="px-3 py-2.5 text-right">
                {name === winner && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-medium text-white"
                    style={{ backgroundColor: modelColorMap[name] || '#666' }}
                  >
                    BEST
                  </span>
                )}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
