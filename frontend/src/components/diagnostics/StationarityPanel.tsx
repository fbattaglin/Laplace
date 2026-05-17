import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { StationarityResult } from '../../types'

interface Props {
  stationarity: StationarityResult
}

function Badge({ pass }: { pass: boolean }) {
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${pass ? 'bg-green-500/15 text-green-500' : 'bg-accent-orange/15 text-accent-orange'}`}>
      {pass ? 'pass' : 'fail'}
    </span>
  )
}

export function StationarityPanel({ stationarity }: Props) {
  const { adf_statistic, adf_pvalue, kpss_statistic, kpss_pvalue, verdict, differenced } = stationarity

  const adfPass = adf_pvalue < 0.05
  const kpssPass = kpss_pvalue > 0.05

  const diffData = differenced.map((v, i) => ({ i, value: v }))
  const stride = Math.max(1, Math.floor(diffData.length / 8))

  return (
    <div className="bg-surface rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-primary mb-4">Stationarity Tests</h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-canvas rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-secondary">ADF Test</span>
            <Badge pass={adfPass} />
          </div>
          <p className="text-xs text-secondary">Statistic: <span className="font-mono text-primary">{adf_statistic.toFixed(3)}</span></p>
          <p className="text-xs text-secondary">p-value: <span className={`font-mono font-semibold ${adfPass ? 'text-green-500' : 'text-accent-orange'}`}>{adf_pvalue.toFixed(4)}</span></p>
          <p className="text-[10px] text-secondary/60 mt-1">Rejects unit root if p &lt; 0.05</p>
        </div>
        <div className="bg-canvas rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-secondary">KPSS Test</span>
            <Badge pass={kpssPass} />
          </div>
          <p className="text-xs text-secondary">Statistic: <span className="font-mono text-primary">{kpss_statistic.toFixed(3)}</span></p>
          <p className="text-xs text-secondary">p-value: <span className={`font-mono font-semibold ${kpssPass ? 'text-green-500' : 'text-accent-orange'}`}>{kpss_pvalue.toFixed(4)}</span></p>
          <p className="text-[10px] text-secondary/60 mt-1">Stationary if p &gt; 0.05</p>
        </div>
      </div>

      <div className="bg-canvas rounded-lg px-3 py-2 mb-4">
        <p className="text-xs text-primary">{verdict}</p>
      </div>

      <div>
        <p className="text-xs text-secondary mb-2">First-differenced series</p>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={diffData} margin={{ top: 2, right: 8, bottom: 2, left: 8 }}>
            <XAxis dataKey="i" tick={{ fontSize: 9 }} interval={stride - 1} />
            <YAxis tick={{ fontSize: 9 }} width={42} tickFormatter={(v) => v.toFixed(1)} />
            <Tooltip
              contentStyle={{ background: 'var(--color-surface)', border: 'none', borderRadius: 8, fontSize: 11 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => (typeof v === 'number' ? v.toFixed(3) : String(v ?? ''))}
            />
            <Line type="monotone" dataKey="value" stroke="var(--color-accent-teal)" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
