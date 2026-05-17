import { Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { OutlierResult } from '../../types'

interface Props {
  outliers: OutlierResult
  values: number[]
  dates: string[]
}

export function OutlierHighlight({ outliers, values, dates }: Props) {
  const { lower_bound, upper_bound, outlier_indices, n_outliers } = outliers

  const chartData = values.map((v, i) => ({
    label: dates[i] ? dates[i].slice(0, 10) : String(i),
    value: v,
    isOutlier: outlier_indices.includes(i),
  }))

  const stride = Math.max(1, Math.floor(chartData.length / 8))

  return (
    <div className="bg-surface rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary">Outlier Detection</h3>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${n_outliers > 0 ? 'bg-accent-red/15 text-accent-red' : 'bg-canvas text-secondary'}`}>
          {n_outliers} outlier{n_outliers !== 1 ? 's' : ''} (IQR method)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
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
          <ReferenceLine y={upper_bound} stroke="var(--color-accent-red)" strokeDasharray="4 3" strokeWidth={1} />
          <ReferenceLine y={lower_bound} stroke="var(--color-accent-red)" strokeDasharray="4 3" strokeWidth={1} />
          <Line type="monotone" dataKey="value" stroke="var(--color-accent-blue)" dot={false} strokeWidth={1.5} />
          {outlier_indices.map((idx) => (
            <ReferenceDot key={idx} x={chartData[idx]?.label} y={values[idx]} r={4} fill="var(--color-accent-red)" stroke="none" />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-xs text-secondary">
        <span>IQR bounds: [{lower_bound.toFixed(2)}, {upper_bound.toFixed(2)}]</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-accent-red" /> outlier</span>
      </div>
    </div>
  )
}
