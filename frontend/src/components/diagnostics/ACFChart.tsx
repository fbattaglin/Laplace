import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { ACFResult } from '../../types'
import { useAppStore } from '../../stores/useAppStore'

interface Props {
  acfData: ACFResult
}

function ACFBarChart({
  values,
  lags,
  ciUpper,
  ciLower,
  title,
}: {
  values: number[]
  lags: number[]
  ciUpper: number
  ciLower: number
  title: string
}) {
  const data = lags.slice(1).map((lag, i) => ({
    lag,
    value: values[i + 1],
  }))

  return (
    <div className="flex-1">
      <p className="text-xs font-medium text-secondary mb-1">{title}</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F7" />
          <XAxis
            dataKey="lag"
            tick={{ fontSize: 10, fill: '#6E6E73' }}
            label={{ value: 'Lag', position: 'bottom', fontSize: 10, fill: '#6E6E73' }}
          />
          <YAxis
            width={40}
            tick={{ fontSize: 10, fill: '#6E6E73' }}
            domain={[-1, 1]}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value) => [Number(value).toFixed(3), title]}
          />
          <ReferenceLine y={ciUpper} stroke="#FF6B00" strokeDasharray="4 4" />
          <ReferenceLine y={ciLower} stroke="#FF6B00" strokeDasharray="4 4" />
          <ReferenceLine y={0} stroke="#111111" strokeWidth={0.5} />
          <Bar dataKey="value" fill="#0066FF" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ACFChart({ acfData }: Props) {
  const { displayMode } = useAppStore()

  return (
    <div className="bg-surface rounded-xl p-6">
      <div className="mb-4">
        <h3 className="font-medium text-primary">
          {displayMode === 'boardroom' ? 'Memory in the Data' : 'ACF / PACF'}
        </h3>
        <p className="text-xs text-secondary mt-1">
          {displayMode === 'boardroom'
            ? 'Shows how strongly past values predict future ones. Tall bars at regular intervals mean seasonal patterns.'
            : 'Autocorrelation and Partial Autocorrelation. Orange dashed lines = 95% significance bounds.'}
        </p>
      </div>
      <div className="flex gap-4">
        <ACFBarChart
          values={acfData.acf_values}
          lags={acfData.lags}
          ciUpper={acfData.ci_upper}
          ciLower={acfData.ci_lower}
          title="ACF"
        />
        <ACFBarChart
          values={acfData.pacf_values}
          lags={acfData.lags.slice(0, acfData.pacf_values.length)}
          ciUpper={acfData.ci_upper}
          ciLower={acfData.ci_lower}
          title="PACF"
        />
      </div>
    </div>
  )
}
