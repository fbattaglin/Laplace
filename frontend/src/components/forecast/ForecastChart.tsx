import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
} from 'recharts'

import type { ModelForecast } from '../../types'
import { useAppStore } from '../../stores/useAppStore'
import { modelColorMap } from '../../lib/colors'

interface Props {
  historical: number[]
  dates: string[]
  forecast: ModelForecast
  horizon: number
}

export function ForecastChart({ historical, dates, forecast, horizon }: Props) {
  const { displayMode } = useAppStore()

  const histTail = Math.min(historical.length, horizon * 3)
  const startIdx = historical.length - histTail

  const chartData: Record<string, unknown>[] = []

  for (let i = startIdx; i < historical.length; i++) {
    chartData.push({
      label: dates[i]?.slice(0, 10) || `${i}`,
      historical: historical[i],
    })
  }

  for (let i = 0; i < horizon; i++) {
    const entry: Record<string, unknown> = {
      label: `+${i + 1}`,
      forecast: forecast.point_forecast[i],
      band90: [forecast.lo_90[i], forecast.hi_90[i]],
      band80: [forecast.lo_80[i], forecast.hi_80[i]],
    }
    chartData.push(entry)

    if (i === 0) {
      const lastHistIdx = chartData.length - 2
      if (lastHistIdx >= 0) {
        const lastVal = historical[historical.length - 1]
        chartData[lastHistIdx].forecast = lastVal
        chartData[lastHistIdx].band90 = [lastVal, lastVal]
        chartData[lastHistIdx].band80 = [lastVal, lastVal]
      }
    }
  }

  const color = modelColorMap[forecast.model_name] || '#0066FF'

  return (
    <div className="bg-surface rounded-xl p-6">
      <div className="mb-4">
        <h3 className="font-medium text-primary">
          {displayMode === 'boardroom' ? 'Future Prediction' : 'Forecast with Prediction Intervals'}
        </h3>
        <p className="text-xs text-secondary mt-1">
          {displayMode === 'boardroom'
            ? `${forecast.model_name} prediction for the next ${horizon} steps. Shaded areas show the range of likely outcomes.`
            : `${forecast.model_name}: point forecast (solid) with 80% (dark band) and 90% (light band) prediction intervals.`}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F7" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#6E6E73' }}
            interval="preserveStartEnd"
          />
          <YAxis width={60} tick={{ fontSize: 10, fill: '#6E6E73' }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value) => {
              if (Array.isArray(value)) {
                return `${Number(value[0]).toFixed(2)} – ${Number(value[1]).toFixed(2)}`
              }
              return Number(value).toFixed(2)
            }}
          />

          <Area
            type="monotone"
            dataKey="band90"
            stroke="none"
            fill={color}
            fillOpacity={0.1}
            name="90% Interval"
            connectNulls={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="band80"
            stroke="none"
            fill={color}
            fillOpacity={0.2}
            name="80% Interval"
            connectNulls={false}
            isAnimationActive={false}
          />

          <Line
            type="monotone"
            dataKey="historical"
            stroke="#111111"
            strokeWidth={1.5}
            dot={false}
            name="Historical"
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke={color}
            strokeWidth={2}
            dot={false}
            name={forecast.model_name}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
