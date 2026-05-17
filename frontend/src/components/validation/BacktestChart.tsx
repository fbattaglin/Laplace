import { useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { BacktestResponse } from '../../types'
import { useAppStore } from '../../stores/useAppStore'
import { modelColorMap } from '../../lib/colors'

interface Props {
  backtest: BacktestResponse
  dates: string[]
  values: number[]
}

export function BacktestChart({ backtest, dates, values }: Props) {
  const { displayMode } = useAppStore()
  const modelNames = Object.keys(backtest.aggregate_metrics)
  const [visibleModels, setVisibleModels] = useState<Set<string>>(new Set(modelNames))
  const [selectedFold, setSelectedFold] = useState<number | null>(null)

  const folds = selectedFold !== null
    ? [backtest.folds[selectedFold]]
    : backtest.folds

  const chartData = values.map((v, i) => ({
    index: i,
    date: dates[i],
    historical: v,
  }))

  for (const fold of folds) {
    const startIdx = fold.train_end_idx
    for (let i = 0; i < fold.actual.length; i++) {
      const idx = startIdx + i
      if (idx < chartData.length) {
        (chartData[idx] as Record<string, unknown>)[`actual_f${fold.fold}`] = fold.actual[i]
        for (const mf of fold.forecasts) {
          if (visibleModels.has(mf.model_name)) {
            (chartData[idx] as Record<string, unknown>)[`${mf.model_name}_f${fold.fold}`] =
              mf.point_forecast[i]
          }
        }
      }
    }
  }

  function toggleModel(name: string) {
    setVisibleModels((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  return (
    <div className="bg-surface rounded-xl p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-medium text-primary">
            {displayMode === 'boardroom' ? 'Forecast Accuracy' : 'Backtest Overlay'}
          </h3>
          <p className="text-xs text-secondary mt-1">
            {displayMode === 'boardroom'
              ? 'Each colored line shows how a model predicted held-out data. Closer to the dashed line = better.'
              : `Rolling-origin CV: ${backtest.n_splits} folds, horizon=${backtest.horizon}. Dashed = actual holdout.`}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setSelectedFold(null)}
            className={`text-xs px-2 py-1 rounded ${selectedFold === null ? 'bg-primary text-white' : 'bg-primary/5 text-secondary hover:bg-primary/10'}`}
          >
            All
          </button>
          {backtest.folds.map((f, i) => (
            <button
              key={f.fold}
              onClick={() => setSelectedFold(i)}
              className={`text-xs px-2 py-1 rounded ${selectedFold === i ? 'bg-primary text-white' : 'bg-primary/5 text-secondary hover:bg-primary/10'}`}
            >
              F{f.fold}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mb-3 flex-wrap">
        {modelNames.map((name) => (
          <button
            key={name}
            onClick={() => toggleModel(name)}
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-opacity ${
              visibleModels.has(name) ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: modelColorMap[name] }}
            />
            {name}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F7" />
          <XAxis
            dataKey="index"
            tick={{ fontSize: 10, fill: '#6E6E73' }}
            tickFormatter={(idx) => dates[idx] ? dates[idx].slice(0, 7) : ''}
          />
          <YAxis width={60} tick={{ fontSize: 10, fill: '#6E6E73' }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            labelFormatter={(idx) => {
              const d = dates[Number(idx)]
              return d ? d.slice(0, 10) : `Index ${idx}`
            }}
          />

          <Line
            type="monotone"
            dataKey="historical"
            stroke="#111111"
            strokeWidth={1.5}
            dot={false}
            name="Historical"
          />

          {folds.map((fold) => (
            <Line
              key={`actual_${fold.fold}`}
              type="monotone"
              dataKey={`actual_f${fold.fold}`}
              stroke="#111111"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              name={folds.length > 1 ? `Actual F${fold.fold}` : 'Actual'}
              connectNulls={false}
            />
          ))}

          {folds.flatMap((fold) =>
            modelNames
              .filter((name) => visibleModels.has(name))
              .map((name) => (
                <Line
                  key={`${name}_f${fold.fold}`}
                  type="monotone"
                  dataKey={`${name}_f${fold.fold}`}
                  stroke={modelColorMap[name]}
                  strokeWidth={1.5}
                  dot={false}
                  name={folds.length > 1 ? `${name} F${fold.fold}` : name}
                  connectNulls={false}
                />
              ))
          )}

          {backtest.folds.map((fold) => (
            <ReferenceLine
              key={`ref_${fold.fold}`}
              x={fold.train_end_idx}
              stroke="#6E6E73"
              strokeDasharray="2 4"
              strokeWidth={0.5}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
