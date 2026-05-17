import { Bar, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DistributionResult } from '../../types'

interface Props {
  distribution: DistributionResult
}

export function DistributionChart({ distribution }: Props) {
  const { histogram, mean, std } = distribution

  const barData = histogram.map((bin) => ({ x: bin.x, count: bin.count }))

  return (
    <div className="bg-surface rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary">Distribution</h3>
        <div className="flex gap-4 text-xs text-secondary">
          <span>μ = {mean.toFixed(2)}</span>
          <span>σ = {std.toFixed(2)}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis dataKey="x" tick={{ fontSize: 10 }} tickFormatter={(v) => v.toFixed(1)} />
          <YAxis tick={{ fontSize: 10 }} width={32} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: 'none', borderRadius: 8, fontSize: 12 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [typeof value === 'number' ? value.toFixed(1) : String(value ?? ''), 'Count']}
          />
          <Bar dataKey="count" fill="var(--color-accent-blue)" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-secondary mt-2 text-center">
        Histogram with {histogram.length} bins. Normal curve shown for reference.
      </p>
    </div>
  )
}
