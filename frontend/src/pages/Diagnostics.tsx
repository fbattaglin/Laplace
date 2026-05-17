import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, TrendingUp, BarChart2, Calculator } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { runDiagnostics, type DiagnosticsRequest, type DiagnosticsResponse } from '../lib/api';
import clsx from 'clsx';

export default function Diagnostics() {
  const [config, setConfig] = useState<DiagnosticsRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DiagnosticsResponse | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('laplace_dataset');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
        loadDiagnostics(parsed);
      } catch (e) {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const loadDiagnostics = async (req: DiagnosticsRequest) => {
    try {
      setLoading(true);
      const res = await runDiagnostics(req);
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
        <AlertTriangle className="text-accent-warning mb-4" size={48} />
        <h2 className="text-2xl font-bold mb-2">No Dataset Selected</h2>
        <p className="text-base-secondary mb-6">Please go back to Data Input and load a dataset first.</p>
        <Link to="/input" className="px-6 py-2 bg-base-primary text-white rounded-lg font-medium hover:bg-base-primary/90 transition-colors">
          Go to Data Input
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-in fade-in">
        <div className="w-10 h-10 border-4 border-base-surface border-t-accent-pulse rounded-full animate-spin mb-4" />
        <h3 className="font-medium">Running Diagnostics...</h3>
        <p className="text-sm text-base-secondary">Computing Stats, STL, Anomalies and Changepoints</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-accent-alert/10 text-accent-alert rounded-xl border border-accent-alert/20">
        <h3 className="font-bold mb-2">Diagnostics Failed</h3>
        <p>{error}</p>
        <button onClick={() => loadDiagnostics(config)} className="mt-4 px-4 py-2 bg-white text-accent-alert rounded-md font-medium text-sm">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const stlData = data.dates.map((date, i) => ({
    date,
    observed: data.stl.observed[i],
    trend: data.stl.trend[i],
    seasonal: data.stl.seasonal[i],
    resid: data.stl.resid[i],
    anomaly: data.anomalies.includes(i) ? data.stl.observed[i] : null
  }));

  const acfData = data.acf.map((val, i) => ({ lag: i, value: val }));
  const pacfData = data.pacf.map((val, i) => ({ lag: i, value: val }));

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-accent-pulse";
    if (score >= 40) return "text-accent-warning";
    return "text-accent-alert";
  };

  const statCards = [
    { label: "Count", value: data.stats.count },
    { label: "Mean", value: data.stats.mean },
    { label: "Std Dev", value: data.stats.std },
    { label: "Min", value: data.stats.min },
    { label: "Max", value: data.stats.max },
    { label: "Skewness", value: data.stats.skewness },
    { label: "Kurtosis", value: data.stats.kurtosis },
    { label: "Missing %", value: data.stats.missing_pct },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Diagnostics & EDA</h1>
        <p className="text-base-secondary">
          Deep-dive analysis into the structural components and statistics of <span className="font-medium text-base-primary">{config.dataset_name}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Forecastability Score Card */}
        <div className="lg:col-span-2 p-8 bg-base-surface rounded-2xl border border-base-secondary/20 flex flex-col md:flex-row gap-8 items-center">
          <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E5EA" strokeWidth="8" />
              <circle 
                cx="50" cy="50" r="45" fill="none" 
                stroke="currentColor" strokeWidth="8" 
                strokeDasharray="283" 
                strokeDashoffset={283 - (283 * data.forecastability.score) / 100} 
                className={clsx("transition-all duration-1000", getScoreColor(data.forecastability.score))}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={clsx("text-3xl font-bold tracking-tighter", getScoreColor(data.forecastability.score))}>
                {data.forecastability.score}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={20} className={getScoreColor(data.forecastability.score)} />
              <h2 className="text-xl font-bold">Forecastability Score</h2>
            </div>
            <p className="text-lg font-medium text-base-primary mb-2">{data.forecastability.label}</p>
            <p className="text-sm text-base-secondary mb-4 leading-relaxed max-w-2xl">
              This score indicates how predictable the time series is based on its signal-to-noise ratio. 
              A high score means models will likely capture strong trends and seasonal patterns.
            </p>
            <div className="flex gap-4 text-sm">
              <div className="px-3 py-1.5 bg-white border border-base-secondary/20 rounded-md">
                <span className="text-base-secondary mr-2">Trend Strength:</span>
                <span className="font-semibold">{data.forecastability.trend_strength.toFixed(2)}</span>
              </div>
              <div className="px-3 py-1.5 bg-white border border-base-secondary/20 rounded-md">
                <span className="text-base-secondary mr-2">Seasonal Strength:</span>
                <span className="font-semibold">{data.forecastability.seasonal_strength.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Basic Stats Grid */}
        <div className="p-6 bg-white border border-base-secondary/20 rounded-2xl flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4">
            <Calculator size={18} className="text-base-secondary" />
            <h3 className="font-semibold">Summary Statistics</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((stat, i) => (
              <div key={i} className="p-3 bg-base-surface rounded-lg border border-base-secondary/10">
                <div className="text-xs text-base-secondary mb-1">{stat.label}</div>
                <div className="font-medium text-sm">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* STL Decomposition Plots */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} className="text-base-secondary" />
            <h2 className="text-lg font-semibold">Signal Intelligence (STL + Anomalies)</h2>
          </div>
          <p className="text-sm text-base-secondary mb-4">
            Breaks down the series into components. Red dots are Isolation Forest anomalies. Vertical orange dashed lines are Trend Changepoints.
          </p>
          
          <div className="p-6 bg-white border border-base-secondary/20 rounded-2xl space-y-6">
            {/* Observed + Anomalies + Changepoints */}
            <div className="h-48">
              <h3 className="text-xs font-semibold text-base-secondary uppercase tracking-wider mb-2">Observed (Original)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stlData}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  {/* Changepoints */}
                  {data.changepoints.map((idx, i) => (
                    <ReferenceLine key={i} x={data.dates[idx]} stroke="#FF6B00" strokeDasharray="3 3" strokeOpacity={0.6} />
                  ))}
                  <Line type="monotone" dataKey="observed" stroke="#111111" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  {/* Anomalies */}
                  <Line type="monotone" dataKey="anomaly" stroke="transparent" dot={{ r: 3, fill: '#FF2A3A', stroke: '#FF2A3A' }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Other STL Components */}
            {[
              { key: 'trend', label: 'Trend', color: '#0066FF' },
              { key: 'seasonal', label: 'Seasonal', color: '#FF6B00' },
              { key: 'resid', label: 'Residuals (Noise)', color: '#6E6E73' }
            ].map(plot => (
              <div key={plot.key} className="h-32">
                <h3 className="text-xs font-semibold text-base-secondary uppercase tracking-wider mb-2">{plot.label}</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stlData}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Line type="monotone" dataKey={plot.key} stroke={plot.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </div>

        {/* ACF / PACF Plots */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={20} className="text-base-secondary" />
            <h2 className="text-lg font-semibold">Autocorrelation</h2>
          </div>
          <p className="text-sm text-base-secondary mb-4">Measures linear relationship between the series and its past values (lags).</p>

          <div className="grid grid-cols-1 gap-6">
            <div className="p-6 bg-white border border-base-secondary/20 rounded-2xl h-[300px]">
              <h3 className="text-xs font-semibold text-base-secondary uppercase tracking-wider mb-4">ACF (Autocorrelation Function)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={acfData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
                  <XAxis dataKey="lag" tick={{fontSize: 10, fill: '#6E6E73'}} axisLine={false} tickLine={false} />
                  <YAxis domain={[-1, 1]} tick={{fontSize: 10, fill: '#6E6E73'}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <ReferenceLine y={0} stroke="#111111" />
                  <ReferenceLine y={0.2} stroke="#FF2A3A" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={-0.2} stroke="#FF2A3A" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Bar dataKey="value" fill="#0066FF" radius={[2, 2, 0, 0]} maxBarSize={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-6 bg-white border border-base-secondary/20 rounded-2xl h-[300px]">
              <h3 className="text-xs font-semibold text-base-secondary uppercase tracking-wider mb-4">PACF (Partial Autocorrelation Function)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pacfData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
                  <XAxis dataKey="lag" tick={{fontSize: 10, fill: '#6E6E73'}} axisLine={false} tickLine={false} />
                  <YAxis domain={[-1, 1]} tick={{fontSize: 10, fill: '#6E6E73'}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <ReferenceLine y={0} stroke="#111111" />
                  <ReferenceLine y={0.2} stroke="#FF2A3A" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={-0.2} stroke="#FF2A3A" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Bar dataKey="value" fill="#FF6B00" radius={[2, 2, 0, 0]} maxBarSize={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
