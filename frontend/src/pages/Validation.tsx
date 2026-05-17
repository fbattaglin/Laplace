import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, AlertTriangle, CheckCircle, Target, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { runValidation, type ValidationRequest, type ValidationResponse } from '../lib/api';
import clsx from 'clsx';

const MODEL_COLORS: Record<string, string> = {
  'Chronos-T5-Small': '#0066FF',
  'TimesFM-200M': '#34A853',
  'ARIMA': '#9D00FF',
  'ETS': '#FF6B00',
  'Theta': '#FFC700',
  'SeasonalNaive': '#FF2A3A'
};

export default function Validation() {
  const [config, setConfig] = useState<ValidationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ValidationResponse | null>(null);
  
  const [recommendedWinner, setRecommendedWinner] = useState<string | null>(null);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);

  const [setupMode, setSetupMode] = useState(true);
  const [horizon, setHorizon] = useState(12);
  const [selectedModels, setSelectedModels] = useState<string[]>([
    'SeasonalNaive', 'AutoETS', 'AutoARIMA', 'Chronos-T5-Small', 'TimesFM-200M'
  ]);
  const [hiddenModels, setHiddenModels] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('laplace_dataset');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
      } catch (e) {
      }
    }
  }, []);

  const handleRunValidation = () => {
    if (!config) return;
    localStorage.setItem('laplace_horizon', String(horizon));
    setSetupMode(false);
    loadValidation({ ...config, horizon, selected_models: selectedModels });
  };

  const handleLegendClick = (e: any) => {
    const model = e.dataKey;
    if (model === "Observed (History)" || model === "Observed (Holdout)") return;
    setHiddenModels(prev => 
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  };

  const loadValidation = async (req: ValidationRequest) => {
    try {
      setLoading(true);
      const res = await runValidation(req);
      setData(res);
      if (res.metrics.length > 0) {
        const topModel = res.metrics[0].model;
        setRecommendedWinner(topModel);
        setSelectedWinner(topModel);
        localStorage.setItem('laplace_winner', topModel);
        localStorage.setItem('laplace_recommended_winner', topModel);
        localStorage.setItem('laplace_winner_is_override', 'false');
        // Save the full metrics for Step 4 to use
        localStorage.setItem('laplace_validation_metrics', JSON.stringify(res.metrics));
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

  if (setupMode && config) {
    const ALL_MODELS = [
      { id: 'AutoARIMA', label: 'AutoARIMA (SOTA Classic)', type: 'statistical' },
      { id: 'AutoETS', label: 'AutoETS (Exponential Smoothing)', type: 'statistical' },
      { id: 'SeasonalNaive', label: 'Seasonal Naive (Baseline)', type: 'statistical' },
      { id: 'Chronos-T5-Small', label: 'Chronos-T5-Small (Amazon FM)', type: 'foundation' },
      { id: 'TimesFM-200M', label: 'TimesFM-200M (Google FM)', type: 'foundation' }
    ];

    const toggleModel = (id: string) => {
      setSelectedModels(prev => 
        prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
      );
    };

    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-12 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Validation Setup</h1>
          <p className="text-base-secondary">Configure the parameters for the backtesting engine.</p>
        </div>

        <div className="p-8 bg-base-surface border border-base-secondary/20 rounded-2xl space-y-8">
          <div>
            <h3 className="text-lg font-bold mb-4">1. Forecast Horizon (Holdout Size)</h3>
            <div className="flex items-center gap-4">
              <input 
                type="number" 
                value={horizon}
                onChange={(e) => setHorizon(parseInt(e.target.value) || 12)}
                className="px-4 py-2 border border-base-secondary/30 rounded-lg bg-white w-32 font-medium"
                min={1}
              />
              <span className="text-sm text-base-secondary">Number of future steps to withhold for validation testing.</span>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">2. Select Models for the Arena</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALL_MODELS.map(m => (
                <label 
                  key={m.id} 
                  className={clsx(
                    "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors",
                    selectedModels.includes(m.id) ? "border-accent-pulse bg-white shadow-sm" : "border-base-secondary/20 bg-base-surface opacity-60 hover:opacity-100"
                  )}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedModels.includes(m.id)}
                    onChange={() => toggleModel(m.id)}
                    className="mt-1 accent-accent-pulse w-4 h-4"
                  />
                  <div>
                    <div className="font-bold text-base-primary">{m.label}</div>
                    <div className="text-xs text-base-secondary uppercase mt-1">{m.type} model</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-base-secondary/20 flex justify-end">
            <button 
              onClick={handleRunValidation}
              disabled={selectedModels.length === 0 || horizon < 1}
              className="px-8 py-3 bg-base-primary text-white font-bold rounded-xl hover:bg-base-primary/90 disabled:opacity-50 transition-colors"
            >
              Run Validation Engine
            </button>
          </div>
        </div>
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
                    <div className="absolute top-2 right-10 pointer-events-none">
                      <Trophy size={14} className="text-accent-pulse" />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <h3 className="font-bold text-base-primary">{m.model}</h3>
                    </div>
                    <input 
                      type="radio"
                      name="winner-selection"
                      className="accent-accent-pulse w-4 h-4 cursor-pointer relative z-10"
                      checked={selectedWinner === m.model}
                      onChange={() => {
                        setSelectedWinner(m.model);
                        localStorage.setItem('laplace_winner', m.model);
                        localStorage.setItem('laplace_winner_is_override', 
                          m.model !== recommendedWinner ? 'true' : 'false'
                        );
                      }}
                    />
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
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', cursor: 'pointer' }} onClick={handleLegendClick} />
                
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
                  strokeWidth={3}
                  strokeDasharray="0"
                  dot={{ r: 4, fill: '#111111', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
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
                    hide={hiddenModels.includes(m.model)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end pt-8 pb-4">
        {selectedWinner && recommendedWinner && selectedWinner !== recommendedWinner && (
          <div className="mb-4 flex items-center gap-3 p-4 bg-accent-warning/10 border border-accent-warning/30 rounded-xl max-w-2xl w-full">
            <AlertTriangle className="text-accent-warning shrink-0" size={24} />
            <div className="text-sm">
              <span className="font-bold text-accent-warning block mb-0.5">Recommendation Overridden</span>
              <span className="text-base-secondary">You have selected <span className="font-bold text-base-primary">{selectedWinner}</span> instead of the system recommended <span className="font-bold text-base-primary">{recommendedWinner}</span>. This model will be used in the Export Studio.</span>
            </div>
          </div>
        )}
        <button 
          onClick={() => window.location.href = '/forecast'}
          className="flex items-center gap-2 px-8 py-4 bg-accent-success text-white rounded-xl font-bold text-lg hover:bg-accent-success/90 hover:-translate-y-0.5 transition-all shadow-lg shadow-accent-success/20 active:translate-y-0"
        >
          Generate Forecast (Step 4)
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}
