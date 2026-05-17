import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { RollingStatsResult } from '../../types'

interface Props {
  data: RollingStatsResult
  dates: string[]
}

export function RollingStatsChart({ data, dates }: Props) {
  const { rolling_mean, rolling_std, window } = data

  const chartData = rolling_mean.map((mean, i) => {
    const std = rolling_std[i]
    const label = dates[i] ? dates[i].slice(0, 10) : String(i)
    return {
      label,
      mean: parseFloat(mean.toFixed(3)),
      upper: parseFloat((mean + std).toFixed(3)),
      lower: parseFloat((mean - std).toFixed(3)),
    }
  })

  const stride = Math.max(1, Math.floor(chartData.length / 8))

  return (
    <div className="bg-surface rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary">Rolling Statistics</h3>
        <span className="text-xs text-secondary bg-canvas px-2 py-0.5 rounded">window = {window}</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval={stride - 1}
            tickFormatter={(v) => v.slice(0, 7)}
          />
          <YAxis tick={{ fontSize: 10 }} width={50} tickFormatter={(v) => v.toFixed(1)} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: 'none', borderRadius: 8, fontSize: 12 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => (typeof v === 'number' ? v.toFixed(2) : String(v ?? ''))}
          />
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill="var(--color-accent-blue)"
            fillOpacity={0.15}
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="var(--color-surface)"
            fillOpacity={1}
          />
          <Line type="monotone" dataKey="mean" stroke="var(--color-accent-blue)" dot={false} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-secondary mt-2 text-center">
        Rolling mean (line) ± 1 std dev (band). Widening band indicates volatility regimes.
      </p>
    </div>
  )
}
