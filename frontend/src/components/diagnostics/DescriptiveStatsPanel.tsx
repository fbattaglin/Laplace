import type { DescriptiveStats } from '../../types'

interface Props {
  stats: DescriptiveStats
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas rounded-lg p-3">
      <p className="text-[11px] text-secondary uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-semibold text-primary font-mono">{value}</p>
    </div>
  )
}

function fmt(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1e6) return n.toExponential(2)
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function DescriptiveStatsPanel({ stats }: Props) {
  return (
    <div className="bg-surface rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-primary mb-4">Descriptive Statistics</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <StatCell label="Count" value={stats.count.toLocaleString()} />
        <StatCell label="Mean" value={fmt(stats.mean)} />
        <StatCell label="Std Dev" value={fmt(stats.std)} />
        <StatCell label="Min" value={fmt(stats.min)} />
        <StatCell label="Q1 (25%)" value={fmt(stats.q1)} />
        <StatCell label="Median" value={fmt(stats.median)} />
        <StatCell label="Q3 (75%)" value={fmt(stats.q3)} />
        <StatCell label="Max" value={fmt(stats.max)} />
        <StatCell label="Skewness" value={fmt(stats.skewness, 3)} />
        <StatCell label="Kurtosis" value={fmt(stats.kurtosis, 3)} />
        <StatCell label="CV" value={fmt(stats.cv, 3)} />
      </div>
    </div>
  )
}
