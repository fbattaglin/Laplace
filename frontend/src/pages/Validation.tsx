import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, AlertTriangle, CheckCircle, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { runValidation, type ValidationRequest, type ValidationResponse } from '../lib/api';
import clsx from 'clsx';

const MODEL_COLORS: Record<string, string> = {
  'Chronos-Bolt-Small': '#0066FF',
  'ETS': '#FF6B00',
  'Theta': '#FFC700',
  'SeasonalNaive': '#FF2A3A'
};

export default function Validation() {
  const [config, setConfig] = useState<ValidationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ValidationResponse | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('laplace_dataset');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig({ ...parsed, horizon: 12 });
        loadValidation({ ...parsed, horizon: 12 });
      } catch (e) {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const loadValidation = async (req: ValidationRequest) => {
    try {
      setLoading(true);
      const res = await runValidation(req);
      setData(res);
      // Save winner for next phase
      if (res.metrics.length > 0) {
        localStorage.setItem('laplace_winner', res.metrics[0].model);
      }
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
        <h3 className="font-medium">Running Backtest Engine...</h3>
        <p className="text-sm text-base-secondary">Evaluating Foundation Models vs Classical Baselines</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-accent-alert/10 text-accent-alert rounded-xl border border-accent-alert/20">
        <h3 className="font-bold mb-2">Validation Failed</h3>
        <p>{error}</p>
        <button onClick={() => loadValidation(config)} className="mt-4 px-4 py-2 bg-white text-accent-alert rounded-md font-medium text-sm">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  // Prepare chart data combining history and predictions
  // We take the last 48 points of history for visual clarity
  const historyLen = data.history.dates.length;
  const cutoff = Math.max(0, historyLen - 48);
  
  const chartData: any[] = [];
  
  // 1. History part
  for (let i = cutoff; i < historyLen; i++) {
    chartData.push({
      date: data.history.dates[i],
      actual: data.history.actual[i],
      isHistory: true
    });
  }
  
  // 2. Prediction part (holdout)
  const h = data.horizon;
  for (let i = 0; i < h; i++) {
    const point: any = {
      date: data.predictions.dates[i],
      actual: data.predictions.actual[i],
      isHistory: false
    };
    data.metrics.forEach(m => {
      const preds = data.predictions[m.model] as number[];
      if (preds) {
        point[m.model] = preds[i];
      }
    });
    chartData.push(point);
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Validation (Backtest)</h1>
          <p className="text-base-secondary max-w-2xl">
            Comparing models using rolling-origin cross-validation over a holdout of {data.horizon} steps.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Metrics Table */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={20} className="text-base-secondary" />
            <h2 className="text-lg font-semibold">Model Leaderboard</h2>
          </div>
          
          <div className="space-y-3">
            {data.metrics.map((m, idx) => {
              const isWinner = idx === 0;
              const color = MODEL_COLORS[m.model] || '#111111';
              
              return (
                <div 
                  key={m.model} 
                  className={clsx(
                    "p-4 rounded-xl border relative overflow-hidden transition-all",
                    isWinner ? "border-accent-pulse bg-white shadow-sm" : "border-base-secondary/20 bg-white"
                  )}
                >
                  {isWinner && (
                    <div className="absolute top-0 right-0 w-16 h-16 bg-accent-pulse/10 rounded-bl-full flex items-start justify-end p-2">
                      <Trophy size={16} className="text-accent-pulse" />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <h3 className="font-bold text-base-primary">{m.model}</h3>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs text-base-secondary uppercase">sMAPE</span>
                      <span className={clsx("font-semibold", isWinner ? "text-accent-pulse" : "text-base-primary")}>
                        {m.sMAPE}%
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-base-secondary uppercase">MASE</span>
                      <span className="font-semibold">{m.MASE.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-base-secondary uppercase">RMSE</span>
                      <span className="font-semibold">{m.RMSE.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overlay Chart */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={20} className="text-base-secondary" />
            <h2 className="text-lg font-semibold">Holdout Overlay</h2>
          </div>
          
          <div className="p-6 bg-white border border-base-secondary/20 rounded-2xl h-[450px] flex flex-col">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
                <XAxis 
                  dataKey="date" 
                  tick={{fontSize: 10, fill: '#6E6E73'}} 
                  axisLine={false}
                  tickLine={false}
                  minTickGap={30}
                />
                <YAxis 
                  tick={{fontSize: 10, fill: '#6E6E73'}} 
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  width={40}
                />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#111111' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                
                {/* Ground Truth */}
                <Line 
                  name="Observed (History)"
                  type="monotone" 
                  dataKey={(d) => d.isHistory ? d.actual : null} 
                  stroke="#111111" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={false}
                />
                
                <Line 
                  name="Observed (Holdout)"
                  type="monotone" 
                  dataKey={(d) => !d.isHistory ? d.actual : null} 
                  stroke="#111111" 
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />

                {/* Models */}
                {data.metrics.map(m => (
                  <Line 
                    key={m.model}
                    name={m.model}
                    type="monotone" 
                    dataKey={m.model} 
                    stroke={MODEL_COLORS[m.model] || '#6E6E73'} 
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
