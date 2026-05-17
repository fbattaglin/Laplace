import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { STLResult } from '../../types'
import { useAppStore } from '../../stores/useAppStore'

interface Props {
  stl: STLResult
  dates: string[]
}

function MiniPanel({
  data,
  label,
  color,
  dates,
}: {
  data: number[]
  label: string
  color: string
  dates: string[]
}) {
  const chartData = data.map((v, i) => ({ index: i, value: v, date: dates[i] }))

  return (
    <div>
      <p className="text-xs font-medium text-secondary mb-1">{label}</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F7" />
          <XAxis dataKey="index" hide />
          <YAxis width={50} tick={{ fontSize: 10, fill: '#6E6E73' }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value) => [Number(value).toFixed(2), label]}
            labelFormatter={(idx) => dates[Number(idx)] || `Index ${idx}`}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function STLChart({ stl, dates }: Props) {
  const { displayMode } = useAppStore()

  return (
    <div className="bg-surface rounded-xl p-6">
      <div className="mb-4">
        <h3 className="font-medium text-primary">
          {displayMode === 'boardroom' ? 'Pattern Breakdown' : 'STL Decomposition'}
        </h3>
        <p className="text-xs text-secondary mt-1">
          {displayMode === 'boardroom'
            ? 'Your data separated into its core components: overall direction, recurring cycles, and random noise.'
            : 'Seasonal-Trend decomposition using LOESS. Observed = Trend + Seasonal + Residual.'}
        </p>
      </div>
      <div className="space-y-2">
        <MiniPanel data={stl.observed} label="Observed" color="#111111" dates={dates} />
        <MiniPanel data={stl.trend} label="Trend" color="#0066FF" dates={dates} />
        <MiniPanel data={stl.seasonal} label="Seasonal" color="#FF6B00" dates={dates} />
        <MiniPanel data={stl.residual} label="Residual" color="#6E6E73" dates={dates} />
      </div>
    </div>
  )
}
