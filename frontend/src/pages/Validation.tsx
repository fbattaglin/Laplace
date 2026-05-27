import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Trophy, AlertTriangle, CheckCircle, Target, ChevronRight, ChevronDown, 
  Clock, Cpu, Sliders, X, Zap, HelpCircle, Activity, ShieldAlert
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { runValidation, type ValidationRequest, type ValidationResponse } from '../lib/api';
import clsx from 'clsx';
import { useMode } from '../context/ModeContext';

const MODEL_COLORS: Record<string, string> = {
  'Chronos-2': '#0066FF',
  'TimesFM-200M': '#34A853',
  'ARIMA': '#9D00FF',
  'ETS': '#FF6B00',
  'Theta': '#FFC700',
  'SeasonalNaive': '#EF4444',
  'Drift': '#EC4899',
  'HistoricAverage': '#8E8E93',
  'Ensemble': '#06B6D4'
};

const MODEL_SPECS: Record<string, any> = {
  'Chronos-2': {
    name: 'Amazon Chronos-2 (Base)',
    arch: 'T5 Transformer-based Architecture',
    params: '80 Million Parameters',
    context: '1024 history steps',
    features: 'Supports past & known-future covariates. Categorical exogenous mappings. Quantized tokenization (1000 bins).',
    device: 'Apple MPS/CUDA PyTorch Core'
  },
  'TimesFM-200M': {
    name: 'Google TimesFM-200M',
    arch: 'Decoder-Only GPT-Style Transformer',
    params: '200 Million Parameters',
    context: '512 history steps (hard limit)',
    features: 'Zero-shot patch-based temporal tokenization (patch size 32, stride 32). Highly accurate multi-step trends.',
    device: 'PyTorch CPU / Local MPS Engine'
  },
  'ARIMA': {
    name: 'AutoARIMA (Nixtla SOTA)',
    arch: 'State-Space Autoregressive Integrated Moving Average',
    params: 'Dynamic parameters (p, d, q) auto-fitted via MLE',
    context: 'Unbounded history (memory decays exponentially)',
    features: 'Automatic unit root test differencing. Fits trend, drift, and seasonal lags.',
    device: 'Nixtla C++ Accelerated Backend'
  },
  'ETS': {
    name: 'AutoETS (Nixtla)',
    arch: 'Error, Trend, Seasonal Exponential Smoothing',
    params: 'Dynamic selection of additive/multiplicative terms',
    context: 'Weighted historical average focusing on recent inputs',
    features: 'Fast analytical optimization. Exceptional for short seasonal business demands.',
    device: 'StatsForecast Core C++'
  },
  'Theta': {
    name: 'AutoTheta (Theta Method)',
    arch: 'Decomposed Theta-Line Forecasting Method',
    params: 'Double theta-line projection (Theta=0, Theta=2)',
    context: 'Full history (best for long trends)',
    features: 'Winner of the M3 forecasting competition. Decomposes trend and seasonally adjusts data mathematically.',
    device: 'StatsForecast Core'
  },
  'SeasonalNaive': {
    name: 'Seasonal Naive (Classical)',
    arch: 'Baseline Laggard Projection',
    params: 'Zero parameters (lag-based)',
    context: 'Matches period lag exactly (e.g. y[t - 12])',
    features: 'Non-parametric. Predicts the value from the exact previous seasonal cycle. Heavy benchmark baseline.',
    device: 'Python NumPy Array Shift'
  },
  'Drift': {
    name: 'Random Walk with Drift',
    arch: 'Linear Trend Baseline Projection',
    params: '1 parameter (Drift coefficient)',
    context: 'Unbounded history (computes average historical change)',
    features: 'Drifts predictions upwards or downwards based on overall history. The industry standard baseline for financial random walks.',
    device: 'StatsForecast Core'
  },
  'HistoricAverage': {
    name: 'Historical Mean Baseline',
    arch: 'Simple Flat Mean Projection',
    params: '1 parameter (Overall historical average)',
    context: 'Entire available training series',
    features: 'Forecasts a completely flat line matching the historical mean. Standard baseline to test if ML adds any predictive signals.',
    device: 'StatsForecast Core'
  },
  'Ensemble': {
    name: 'Dynamic Weighted Average',
    arch: 'Multi-Model Combiner Strategy',
    params: 'Customizable weights across top-N architectures',
    context: 'Inherited from component models',
    features: 'Reduces model bias and variance by averaging uncorrelated errors. Dynamically re-weighted.',
    device: 'Laplace Local Ensemble Matrix Engine'
  }
};

// fmt helper removed

export default function Validation() {
  const { isLab } = useMode();
  const [config, setConfig] = useState<ValidationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ValidationResponse | null>(null);
  
  // Interactive Selection States
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [recommendedWinner, setRecommendedWinner] = useState<string | null>(null);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [selectedModelSpecs, setSelectedModelSpecs] = useState<string | null>(null);
  
  // Backtest Config States
  const [setupMode, setSetupMode] = useState(true);
  const [horizon, setHorizon] = useState(12);
  const [validationType, setValidationType] = useState<'holdout' | 'walk_forward'>('holdout');
  const [numSplits, setNumSplits] = useState(3);
  
  // Ensemble Config States
  const [isEnsembleConfigOpen, setIsEnsembleConfigOpen] = useState(false);
  const [ensembleStrategy, setEnsembleStrategy] = useState<'inverse_smape' | 'equal' | 'custom'>('inverse_smape');
  const [ensembleWeights, setEnsembleWeights] = useState<Record<string, number>>({});
  
  const [selectedModels, setSelectedModels] = useState<string[]>([
    'Chronos-2',
    'TimesFM-200M',
    'AutoARIMA',
    'AutoETS',
    'AutoTheta',
    'SeasonalNaive',
    'RandomWalkWithDrift',
    'HistoricAverage'
  ]);

  useEffect(() => {
    const saved = localStorage.getItem('laplace_dataset');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
      } catch (e) {}
    }
  }, []);

  const handleRunValidation = (customEnsemble?: { strategy: string, custom_weights: Record<string, number> }) => {
    if (!config) return;
    
    let cleaning_config = undefined;
    let excluded_anomalies = undefined;
    
    const savedClean = localStorage.getItem('laplace_clean_config');
    if (savedClean) {
      try { cleaning_config = JSON.parse(savedClean); } catch (_) {}
    }
    
    const savedExcluded = localStorage.getItem('laplace_excluded_anomalies');
    if (savedExcluded) {
      try { excluded_anomalies = JSON.parse(savedExcluded); } catch (_) {}
    }

    localStorage.setItem('laplace_horizon', String(horizon));
    
    // Construct request
    const payload: ValidationRequest = {
      ...config, 
      horizon, 
      selected_models: selectedModels,
      covariate_cols: config.covariate_cols || [],
      cleaning_config,
      excluded_anomalies,
      validation_type: validationType,
      num_splits: validationType === 'walk_forward' ? numSplits : 1
    };

    if (customEnsemble) {
      payload.ensemble_config = customEnsemble;
    } else {
      payload.ensemble_config = {
        strategy: ensembleStrategy,
        custom_weights: ensembleStrategy === 'custom' ? ensembleWeights : undefined
      };
    }

    setSetupMode(false);
    loadValidation(payload);
  };

  const loadValidation = async (req: ValidationRequest) => {
    try {
      setLoading(true);
      setError(null);
      const res = await runValidation(req);
      setData(res);
      
      if (res.metrics.length > 0) {
        // Exclude Ensemble itself if user overrides it, or find top model
        const topModel = res.metrics[0].model;
        setRecommendedWinner(topModel);
        setSelectedWinner(topModel);
        localStorage.setItem('laplace_winner', topModel);
        localStorage.setItem('laplace_recommended_winner', topModel);
        localStorage.setItem('laplace_winner_is_override', 'false');
        localStorage.setItem('laplace_validation_metrics', JSON.stringify(res.metrics));
        
        // Save ensemble strategy & custom weights configuration
        const ensModel = res.metrics.find(m => m.model === 'Ensemble');
        if (ensModel && ensModel.weights) {
          setEnsembleWeights(ensModel.weights);
          setEnsembleStrategy((ensModel.strategy as any) || 'inverse_smape');
          localStorage.setItem('laplace_ensemble_config', JSON.stringify({
            strategy: ensModel.strategy || 'inverse_smape',
            custom_weights: ensModel.weights
          }));
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Custom Weight Normalizer (Sum-to-100%)
  const handleWeightChange = (model: string, newVal: number) => {
    const activeComponents = Object.keys(ensembleWeights);
    if (activeComponents.length <= 1) return;

    const currentWeights = { ...ensembleWeights };
    const oldVal = currentWeights[model] || 0;
    
    // Safety clamp
    const targetVal = Math.min(Math.max(newVal, 0), 1);
    currentWeights[model] = targetVal;
    
    const remainder = 1.0 - targetVal;
    const oldRemainder = 1.0 - oldVal;
    
    if (oldRemainder > 0) {
      // Scale others proportionally
      activeComponents.forEach(m => {
        if (m !== model) {
          currentWeights[m] = (currentWeights[m] / oldRemainder) * remainder;
        }
      });
    } else {
      // Equal distribution for others if previous remainder was zero
      const othersCount = activeComponents.length - 1;
      activeComponents.forEach(m => {
        if (m !== model) {
          currentWeights[m] = remainder / othersCount;
        }
      });
    }
    
    setEnsembleWeights(currentWeights);
  };

  const applyCustomWeights = () => {
    handleRunValidation({
      strategy: 'custom',
      custom_weights: ensembleWeights
    });
  };

// handleLegendClick removed

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
        <AlertTriangle className="text-accent-warning mb-4" size={48} />
        <h2 className="text-2xl font-bold mb-2">No Dataset Selected</h2>
        <p className="text-base-secondary mb-6">Please go back to Data Input and load a dataset first.</p>
        <Link to="/input" className="px-6 py-2 bg-[#6366F1] text-white rounded-lg font-medium hover:bg-[#6366F1]/90 transition-colors">
          Go to Data Input
        </Link>
      </div>
    );
  }

  // RENDER SETUP MODE
  if (setupMode && config) {
    const ALL_MODELS = [
      { id: 'AutoARIMA', label: 'AutoARIMA (SOTA Classic)', type: 'statistical' },
      { id: 'AutoETS', label: 'AutoETS (Exponential Smoothing)', type: 'statistical' },
      { id: 'AutoTheta', label: 'AutoTheta (Theta Method)', type: 'statistical' },
      { id: 'RandomWalkWithDrift', label: 'Random Walk with Drift (Drift)', type: 'statistical' },
      { id: 'HistoricAverage', label: 'Historical Mean (Base)', type: 'statistical' },
      { id: 'SeasonalNaive', label: 'Seasonal Naive (Baseline)', type: 'statistical' },
      { id: 'Chronos-2', label: 'Chronos-2 (Amazon Deep FM)', type: 'foundation' },
      { id: 'TimesFM-200M', label: 'TimesFM-200M (Google FM)', type: 'foundation' }
    ];

    const toggleModel = (id: string) => {
      setSelectedModels(prev => 
        prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
      );
    };

    // Calculate splits visually
    
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-12 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Validation Setup</h1>
          <p className="text-base-secondary">Configure parameter boundaries for the backtesting engine.</p>
        </div>

        <div className="p-8 bg-base-surface border border-base-secondary/20 rounded-2xl space-y-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left: Model Checklist & Horizon */}
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-base-primary text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Sliders size={16} className="text-[#6366F1]" />
                  Select Validation Candidates
                </h3>
                <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-2">
                  {ALL_MODELS.map(m => {
                    const isChecked = selectedModels.includes(m.id);
                    return (
                      <label 
                        key={m.id}
                        onClick={() => toggleModel(m.id)}
                        className={clsx(
                          "flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer select-none transition-all",
                          isChecked ? "border-[#6366F1] bg-[#6366F1]/5 font-semibold text-base-primary" : "border-base-secondary/10 hover:bg-base-surface/50 text-base-secondary"
                        )}
                      >
                        <input 
                          type="checkbox"
                          className="accent-[#6366F1]"
                          checked={isChecked}
                          onChange={() => {}}
                        />
                        <div className="flex-1 flex justify-between items-center">
                          <span>{m.label}</span>
                          <span className={clsx(
                            "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
                            m.type === 'foundation' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          )}>
                            {m.type}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-base-primary">Holdout Horizon</h3>
                  <span className="text-[#6366F1] font-mono font-bold text-sm bg-[#6366F1]/10 px-2.5 py-0.5 rounded-md">
                    {horizon} steps
                  </span>
                </div>
                <input 
                  type="range"
                  min="4"
                  max="36"
                  className="w-full accent-[#6366F1] cursor-pointer"
                  value={horizon}
                  onChange={(e) => setHorizon(parseInt(e.target.value))}
                />
                <p className="text-xs text-base-secondary mt-1">Number of steps held out for error comparison. Usually matches 1 full seasonal period.</p>
              </div>
            </div>

            {/* Right: Validation Methodology Selector */}
            <div className="space-y-6 border-t md:border-t-0 md:border-l border-base-secondary/15 md:pl-8">
              <div>
                <h3 className="font-semibold text-sm uppercase tracking-wider text-base-primary mb-3">Validation Methodology</h3>
                <div className="grid grid-cols-1 gap-3">
                  
                  {/* Option 1: Holdout */}
                  <label 
                    onClick={() => setValidationType('holdout')}
                    className={clsx(
                      "p-4 rounded-xl border cursor-pointer select-none transition-all flex items-start gap-3",
                      validationType === 'holdout' ? "border-[#6366F1] bg-[#6366F1]/5" : "border-base-secondary/10 text-base-secondary"
                    )}
                  >
                    <input 
                      type="radio" 
                      name="val-type" 
                      className="accent-[#6366F1] mt-1" 
                      checked={validationType === 'holdout'}
                      onChange={() => {}}
                    />
                    <div>
                      <span className="font-bold text-sm block text-base-primary">Single Split (Fast Holdout)</span>
                      <span className="text-xs text-base-secondary mt-1 block">A single train/test split at the very end. Fastest execution, best for quick parameter sweeps.</span>
                    </div>
                  </label>

                  {/* Option 2: Walk Forward */}
                  <label 
                    onClick={() => setValidationType('walk_forward')}
                    className={clsx(
                      "p-4 rounded-xl border cursor-pointer select-none transition-all flex items-start gap-3",
                      validationType === 'walk_forward' ? "border-[#6366F1] bg-[#6366F1]/5" : "border-base-secondary/10 text-base-secondary"
                    )}
                  >
                    <input 
                      type="radio" 
                      name="val-type" 
                      className="accent-[#6366F1] mt-1" 
                      checked={validationType === 'walk_forward'}
                      onChange={() => {}}
                    />
                    <div>
                      <span className="font-bold text-sm block text-base-primary">Rolling-Origin Cross-Validation</span>
                      <span className="text-xs text-base-secondary mt-1 block">Standard walk-forward cross-validation. Highly robust, averages performance across multiple periods to block seasonality bias.</span>
                    </div>
                  </label>

                </div>
              </div>

              {/* If Walk Forward, show Splits slider */}
              {validationType === 'walk_forward' && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-base-primary">Backtest Rigor (splits)</span>
                    <span className="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                      {numSplits} windows
                    </span>
                  </div>
                  <div className="flex gap-4">
                    {[2, 3, 5].map(s => (
                      <button
                        key={s}
                        onClick={() => setNumSplits(s)}
                        className={clsx(
                          "flex-1 py-2 text-xs rounded-lg border font-medium transition-all",
                          numSplits === s ? "border-purple-600 bg-purple-50 text-purple-700 font-bold" : "border-base-secondary/15 hover:bg-base-surface"
                        )}
                      >
                        {s} Windows {s === 3 ? '(Optimum)' : s === 5 ? '(Hardcore)' : ''}
                      </button>
                    ))}
                  </div>

                  {/* Window timeline Splits visualizer */}
                  <div className="p-3 bg-base-surface/50 border border-base-secondary/10 rounded-xl space-y-2">
                    <span className="text-[10px] text-base-secondary uppercase font-bold tracking-wider block mb-1">
                      Rolling Origin Visual Schema
                    </span>
                    {Array.from({ length: numSplits }).map((_, idx) => {
                      // Visual representation of splits
                      const testWidth = 15;
                      const trainWidth = 85 - (numSplits - 1 - idx) * 8;
                      const ignoredWidth = 100 - trainWidth - testWidth;
                      
                      return (
                        <div key={idx} className="flex items-center gap-2 text-[10px]">
                          <span className="w-12 text-base-secondary font-mono">Split {idx+1}:</span>
                          <div className="flex-1 h-3 rounded bg-base-secondary/10 overflow-hidden flex font-mono text-[8px] text-white">
                            <div className="bg-[#6366F1]/70 flex items-center justify-center font-bold" style={{ width: `${trainWidth}%` }}>Train</div>
                            <div className="bg-red-500/80 flex items-center justify-center font-bold" style={{ width: `${testWidth}%` }}>Test</div>
                            {ignoredWidth > 0 && <div className="bg-base-secondary/15" style={{ width: `${ignoredWidth}%` }}></div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="pt-6 border-t border-base-secondary/10 flex justify-end">
            <button
              onClick={() => handleRunValidation()}
              disabled={selectedModels.length === 0}
              className={clsx(
                "flex items-center gap-2 px-8 py-4 text-white rounded-xl font-bold text-lg hover:-translate-y-0.5 transition-all shadow-lg active:translate-y-0",
                selectedModels.length > 0 ? "bg-[#6366F1] hover:bg-[#6366F1]/90 shadow-[#6366F1]/20" : "bg-base-secondary/35 cursor-not-allowed"
              )}
            >
              Run Backtest Validation
              <ChevronRight size={20} />
            </button>
          </div>

        </div>
      </div>
    );
  }

  // RENDER LOADING STATE
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
        <Activity className="text-[#6366F1] animate-spin mb-4" size={48} />
        <h2 className="text-2xl font-bold mb-2">Engaging Backtesting Core</h2>
        <p className="text-base-secondary max-w-sm">
          {validationType === 'walk_forward' 
            ? `Running rolling walk-forward backtests over ${numSplits} splits. Processing neural and classical inferences in CPU/MPS core...`
            : "Executing single-split holdout. Aligning historical context window and evaluating model residuals..."}
        </p>
        
        {/* Animated Loading Skeletons */}
        <div className="mt-12 w-full max-w-2xl bg-base-surface border border-base-secondary/20 p-6 rounded-2xl space-y-4 animate-pulse">
          <div className="h-6 bg-base-secondary/15 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-base-secondary/10 rounded-xl"></div>
            <div className="h-20 bg-base-secondary/10 rounded-xl"></div>
            <div className="h-20 bg-base-secondary/10 rounded-xl"></div>
          </div>
          <div className="h-[250px] bg-base-secondary/10 rounded-2xl w-full"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
        <AlertTriangle className="text-red-500 mb-4" size={48} />
        <h2 className="text-2xl font-bold mb-2">Validation Failure</h2>
        <p className="text-red-600/80 mb-6 max-w-lg">{error || "No response payload received from the API."}</p>
        <button 
          onClick={() => setSetupMode(true)}
          className="px-6 py-2 bg-base-primary text-white rounded-lg font-medium hover:bg-base-primary/90 transition-colors"
        >
          Adjust Settings & Retry
        </button>
      </div>
    );
  }

  // RENDER METRICS & OVERLAY CHART (DONE RUNNING)
  const chartData: any[] = [];
  const histDates = data.history.dates;
  const histActual = data.history.actual;

  // 1. History
  for (let i = 0; i < histDates.length; i++) {
    chartData.push({
      date: histDates[i],
      actual: histActual[i],
      isHistory: true
    });
  }

  // 2. Holdout split
  const testDates = data.predictions.dates;
  const testActual = data.predictions.actual;
  for (let i = 0; i < testDates.length; i++) {
    const point: any = {
      date: testDates[i],
      actual: testActual[i],
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

  // Prepare Scatter Chart Data (Accuracy vs Latency Bubble Chart)
  const scatterData = data.metrics.map(m => ({
    name: m.model,
    sMAPE: m.sMAPE,
    latency: m.latency || 0.05,
    zSize: 100
  }));

  // Diebold-Mariano Text Mappings
  const pValue = data.dm_p_value ?? 1.0;
  const isSignificant = pValue < 0.05;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Validation (Backtest)</h1>
          <p className="text-base-secondary max-w-2xl text-sm">
            {data.validation_type === 'walk_forward' 
              ? `Comparing models using rolling-origin walk-forward cross-validation across ${data.actual_splits} splits (${horizon}-step holdouts).`
              : `Comparing models using a single-split holdout validation of ${horizon} steps.`}
          </p>
        </div>
        <button
          onClick={() => setSetupMode(true)}
          className="px-4 py-2 border border-base-secondary/20 hover:bg-base-surface text-base-primary rounded-xl text-xs font-semibold transition-colors flex items-center gap-2"
        >
          <Sliders size={14} />
          Adjust Backtest Setup
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Model Leaderboard */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={18} className="text-base-secondary" />
            <h2 className="text-base font-semibold">Model Leaderboard</h2>
          </div>
          
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {data.metrics.map((m, idx) => {
              const isWinner = idx === 0;
              const color = MODEL_COLORS[m.model] || '#111111';
              const isEnsemble = m.model === 'Ensemble';
              const isHovered = hoveredModel === m.model;
              
              return (
                <div 
                  key={m.model} 
                  onMouseEnter={() => setHoveredModel(m.model)}
                  onMouseLeave={() => setHoveredModel(null)}
                  onClick={() => setSelectedModelSpecs(m.model)}
                  className={clsx(
                    "p-4 rounded-xl border relative overflow-hidden transition-all duration-200 cursor-pointer",
                    isWinner ? "border-accent-pulse bg-white shadow-sm ring-1 ring-accent-pulse/30" : 
                    isEnsemble ? "border-cyan-400/50 bg-cyan-50/20 border-dashed hover:bg-cyan-50/40" :
                    "border-base-secondary/20 bg-white hover:bg-base-surface/40",
                    isHovered && "scale-[1.01] shadow-md border-base-primary/30"
                  )}
                >
                  {isWinner && (
                    <div className="absolute top-2 right-10 pointer-events-none">
                      <Trophy size={14} className="text-accent-pulse" />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <h3 className="font-bold text-sm text-base-primary">{m.model}</h3>
                      {isEnsemble && (
                        <span className="text-[8px] uppercase tracking-wider font-bold text-cyan-600 bg-cyan-100 px-1.5 py-0.5 rounded-full">
                          Ensembled
                        </span>
                      )}
                    </div>
                    
                    <input 
                      type="radio"
                      name="winner-selection"
                      className="accent-[#6366F1] w-4 h-4 cursor-pointer relative z-10"
                      checked={selectedWinner === m.model}
                      onClick={(e) => e.stopPropagation()} // stop specs modal open
                      onChange={() => {
                        setSelectedWinner(m.model);
                        localStorage.setItem('laplace_winner', m.model);
                        localStorage.setItem('laplace_winner_is_override', 
                          m.model !== recommendedWinner ? 'true' : 'false'
                        );
                      }}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-left">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-base-secondary uppercase">sMAPE</span>
                      <span className={clsx("font-bold text-xs", isWinner ? "text-accent-pulse" : "text-base-primary")}>
                        {m.sMAPE}% {m.sMAPE_std ? `(±${m.sMAPE_std}%)` : ''}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-base-secondary uppercase">MASE</span>
                      <span className="font-semibold text-xs text-base-primary">{m.MASE.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-base-secondary uppercase">Latency</span>
                      <span className="font-mono text-[10px] text-base-secondary flex items-center gap-1">
                        <Clock size={8} />
                        {m.latency ? `${m.latency.toFixed(2)}s` : '0.01s'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Statistical Significance DM-Test Card */}
          <div className="p-5 bg-base-surface/40 border border-base-secondary/15 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-primary flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-[#6366F1]" />
              Statistical Significance Audit
            </h3>
            
            {/* Boardroom copy */}
            {!isLab ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    "px-2.5 py-0.5 rounded-full text-[9px] uppercase font-bold",
                    isSignificant ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"
                  )}>
                    {isSignificant ? "Confidence: High" : "Confidence: Low"}
                  </span>
                </div>
                <p className="text-xs text-base-secondary leading-relaxed">
                  {isSignificant 
                    ? `The superior accuracy of the leading model (${recommendedWinner}) is mathematically proven to be a true business signal (95% confidence). It is highly unlikely to be random noise.`
                    : `The leading model (${recommendedWinner}) and classical naive baselines are statistically indistinguishable. The patterns are highly random, so simple classical baseline predictions carry equivalent value.`
                  }
                </p>
              </div>
            ) : (
              // Lab copy (Geek-out)
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-base-secondary">Test Type:</span>
                  <span className="text-base-primary">Diebold-Mariano (Absolute Loss)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-secondary">Null Hypothesis H₀:</span>
                  <span className="text-base-primary">Errors are equivalent</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-secondary">p-value:</span>
                  <span className={clsx("font-bold", isSignificant ? "text-emerald-600" : "text-yellow-600")}>
                    {pValue.toFixed(5)}
                  </span>
                </div>
                <div className="text-[10px] text-base-secondary leading-relaxed pt-2 border-t border-base-secondary/10">
                  {isSignificant 
                    ? `Verdict: Reject H₀ ($p < 0.05$). The loss differential between ${recommendedWinner} and ${data.dm_comparison_model} is statistically significant.`
                    : `Verdict: Fail to reject H₀ ($p \\ge 0.05$). Accuracy difference is statistically indistinguishable.`
                  }
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right side: Charts & Config */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Overlay Chart */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={18} className="text-base-secondary" />
              <h2 className="text-base font-semibold">Holdout Overlay (Visual Evaluation)</h2>
            </div>
            
            <div className="p-6 bg-white border border-base-secondary/20 rounded-2xl h-[420px] flex flex-col shadow-sm">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
                  <XAxis 
                    dataKey="date" 
                    tick={{fontSize: 9, fill: '#6E6E73'}} 
                    axisLine={false}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis 
                    tick={{fontSize: 9, fill: '#6E6E73'}} 
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#111111' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  
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
                    dot={{ r: 3, fill: '#111111', stroke: '#ffffff', strokeWidth: 1.5 }}
                    activeDot={{ r: 5 }}
                  />

                  {/* Models */}
                  {data.metrics.map(m => {
                    const isHovered = hoveredModel === m.model;
                    return (
                      <Line 
                        key={m.model}
                        name={m.model}
                        type="monotone" 
                        dataKey={m.model} 
                        stroke={MODEL_COLORS[m.model] || '#6E6E73'} 
                        strokeWidth={isHovered ? 4.5 : 1.5}
                        strokeOpacity={hoveredModel && !isHovered ? 0.25 : 1.0}
                        dot={false}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Accuracy vs Latency Bubble Chart (Lab Mode Only) */}
          {isLab && (
            <div className="space-y-4 animate-in fade-in duration-500">
              <div className="flex items-center gap-2">
                <Cpu size={18} className="text-base-secondary" />
                <h2 className="text-base font-semibold">Model Efficiency Frontier (Accuracy vs. Speed)</h2>
              </div>
              <div className="p-6 bg-white border border-base-secondary/20 rounded-2xl h-[320px] flex flex-col shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
                    <XAxis 
                      type="number" 
                      dataKey="latency" 
                      name="Inference Latency" 
                      unit="s"
                      scale="log"
                      domain={[0.005, 5]}
                      tick={{fontSize: 9, fill: '#6E6E73'}}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="sMAPE" 
                      name="sMAPE Error" 
                      unit="%"
                      domain={['auto', 'auto']}
                      tick={{fontSize: 9, fill: '#6E6E73'}}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ZAxis type="number" dataKey="zSize" range={[150, 150]} />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={() => "Efficiency Node"}
                    />
                    <Scatter name="Model Nodes" data={scatterData}>
                      {scatterData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={MODEL_COLORS[entry.name] || '#111111'} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="text-[10px] text-base-secondary text-center italic mt-1">
                  Optimal region is **bottom-left** (uncompromising accuracy, instantaneous speed). Bubble positions highlight efficiency trade-offs.
                </div>
              </div>
            </div>
          )}

          {/* Interactive Ensemble Weights Config Panel (Lab Mode Only) */}
          {isLab && (
            <div className="w-full">
              <div className="border-l-[3px] border-[#6366F1] bg-[#6366F1]/5 rounded-r-2xl overflow-hidden shadow-sm">
                <button 
                  onClick={() => setIsEnsembleConfigOpen(!isEnsembleConfigOpen)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#6366F1]/10 transition-colors"
                >
                  <div>
                    <h3 className="font-bold flex items-center gap-2 text-sm text-base-primary">
                      <span className="text-base">📊</span> ENSEMBLE CONFIGURATION
                    </h3>
                    <p className="text-xs text-base-secondary mt-1">
                      Ensemble strategy: **{ensembleStrategy === 'inverse_smape' ? 'Auto (Inverse sMAPE)' : ensembleStrategy === 'equal' ? 'Top 3 Equal' : 'Custom Weights'}**
                    </p>
                  </div>
                  <ChevronDown 
                    className={clsx("text-base-secondary transition-transform duration-300", isEnsembleConfigOpen ? "rotate-180" : "")} 
                    size={20}
                  />
                </button>
                
                <div 
                  className={clsx(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isEnsembleConfigOpen ? "max-h-[600px] opacity-100 border-t border-[#6366F1]/10" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="p-5 bg-white space-y-6">
                    <div>
                      <h4 className="text-xs font-bold text-base-secondary uppercase tracking-wider mb-4">Select Combination Strategy</h4>
                      <div className="flex bg-base-surface rounded-xl p-1 w-fit border border-base-secondary/10">
                        <button 
                          onClick={() => {
                            setEnsembleStrategy('inverse_smape');
                            handleRunValidation({ strategy: 'inverse_smape', custom_weights: {} });
                          }}
                          className={clsx("px-4 py-2 text-xs font-medium rounded-lg transition-all", ensembleStrategy === 'inverse_smape' ? "bg-white shadow-sm font-bold text-[#6366F1]" : "text-base-secondary hover:text-base-primary")}
                        >
                          Auto (Inverse-sMAPE)
                        </button>
                        <button 
                          onClick={() => {
                            setEnsembleStrategy('equal');
                            handleRunValidation({ strategy: 'equal', custom_weights: {} });
                          }}
                          className={clsx("px-4 py-2 text-xs font-medium rounded-lg transition-all", ensembleStrategy === 'equal' ? "bg-white shadow-sm font-bold text-[#6366F1]" : "text-base-secondary hover:text-base-primary")}
                        >
                          Top 3 Equal
                        </button>
                        <button 
                          onClick={() => setEnsembleStrategy('custom')}
                          className={clsx("px-4 py-2 text-xs font-medium rounded-lg transition-all", ensembleStrategy === 'custom' ? "bg-white shadow-sm font-bold text-[#6366F1]" : "text-base-secondary hover:text-base-primary")}
                        >
                          Custom Sliders
                        </button>
                      </div>
                    </div>

                    {/* Weight Sliders - Custom Strategy Only */}
                    {ensembleStrategy === 'custom' && (
                      <div className="space-y-4 animate-in slide-in-from-top-3 duration-200">
                        <h4 className="text-xs font-bold text-base-secondary uppercase tracking-wider">Drag & Tune Weights (Autobalanced)</h4>
                        <div className="space-y-3.5 max-w-xl">
                          {Object.entries(ensembleWeights).map(([model, weight]) => {
                            const valPercentage = weight * 100;
                            return (
                              <div key={model} className="space-y-1 text-xs">
                                <div className="flex justify-between items-center font-semibold text-base-primary">
                                  <span>{model}</span>
                                  <span className="font-mono text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                                    {valPercentage.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <input 
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    className="flex-1 accent-purple-600 h-1.5 bg-base-secondary/15 rounded-lg cursor-pointer"
                                    value={weight}
                                    onChange={(e) => handleWeightChange(model, parseFloat(e.target.value))}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-3">
                          <button
                            onClick={applyCustomWeights}
                            className="px-5 py-2.5 bg-[#6366F1] text-white text-xs font-bold rounded-xl shadow hover:bg-[#6366F1]/90 transition-all flex items-center gap-2"
                          >
                            <Zap size={14} />
                            Deploy Custom Weights & Re-Evaluate
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Weight Info - Auto & Equal */}
                    {ensembleStrategy !== 'custom' && (
                      <div className="space-y-3.5 max-w-xl">
                        <h4 className="text-xs font-bold text-base-secondary uppercase tracking-wider">Current Combination Weights</h4>
                        {Object.entries(ensembleWeights).map(([model, weight]) => (
                          <div key={model} className="flex items-center gap-4 text-xs">
                            <div className="w-28 font-semibold text-base-primary">{model}</div>
                            <div className="w-20 text-base-secondary font-mono">
                              {(weight * 100).toFixed(1)}%
                            </div>
                            <div className="flex-1 bg-base-surface border border-base-secondary/10 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-[#6366F1] h-full rounded-full" 
                                style={{ width: `${weight * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="p-3.5 bg-base-surface rounded-xl text-xs text-base-secondary flex items-start gap-2 border border-base-secondary/10">
                      <HelpCircle size={14} className="text-[#6366F1] shrink-0 mt-0.5" />
                      <p>Adjusting the ensemble configuration will dynamically rebuild the weighted average pipeline, recalculate sMAPE across splits, and immediately refresh the leaderboard rank.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trigger Step 4 */}
          <div className="flex flex-col items-end pt-4">
            {selectedWinner && recommendedWinner && selectedWinner !== recommendedWinner && (
              <div className="mb-4 flex items-center gap-3 p-4 bg-accent-warning/10 border border-accent-warning/30 rounded-xl max-w-2xl w-full">
                <AlertTriangle className="text-accent-warning shrink-0" size={24} />
                <div className="text-sm">
                  <span className="font-bold text-accent-warning block mb-0.5">Recommendation Overridden</span>
                  <span className="text-base-secondary">You have manually selected <span className="font-bold text-base-primary">{selectedWinner}</span> instead of the system recommended winner <span className="font-bold text-base-primary">{recommendedWinner}</span>. This override will carry into Step 4.</span>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => window.location.href = '/forecast'}
              className="flex items-center gap-2 px-8 py-4 bg-accent-success text-white rounded-xl font-bold text-lg hover:bg-accent-success/90 hover:-translate-y-0.5 transition-all shadow-lg shadow-accent-success/20 active:translate-y-0"
            >
              Generate True Forecast (Step 4)
              <ChevronRight size={24} />
            </button>
          </div>

        </div>
      </div>

      {/* Model Spec Card Side Drawer */}
      {selectedModelSpecs && MODEL_SPECS[selectedModelSpecs] && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-base-secondary/15 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-base-secondary/15 pb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="text-[#6366F1]" size={20} />
                  <h2 className="text-lg font-bold text-base-primary">Model Architecture Specs</h2>
                </div>
                <button 
                  onClick={() => setSelectedModelSpecs(null)}
                  className="p-1 hover:bg-base-surface text-base-secondary hover:text-base-primary rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-base-secondary uppercase font-bold tracking-wider">Model Name</label>
                  <h3 className="font-bold text-base-primary text-base">{MODEL_SPECS[selectedModelSpecs].name}</h3>
                </div>

                <div>
                  <label className="text-[10px] text-base-secondary uppercase font-bold tracking-wider">Underlying Architecture</label>
                  <p className="text-sm text-base-primary leading-relaxed">{MODEL_SPECS[selectedModelSpecs].arch}</p>
                </div>

                <div>
                  <label className="text-[10px] text-base-secondary uppercase font-bold tracking-wider">Complexity / Parameters</label>
                  <p className="text-sm text-base-primary leading-relaxed">{MODEL_SPECS[selectedModelSpecs].params}</p>
                </div>

                <div>
                  <label className="text-[10px] text-base-secondary uppercase font-bold tracking-wider">Maximum Context Window</label>
                  <p className="text-sm text-base-primary font-mono bg-base-surface px-2.5 py-1 rounded w-fit text-xs border border-base-secondary/10 mt-1">
                    {MODEL_SPECS[selectedModelSpecs].context}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] text-base-secondary uppercase font-bold tracking-wider">Special Features</label>
                  <p className="text-sm text-base-secondary leading-relaxed bg-purple-50/50 p-3 rounded-xl border border-purple-100/50 text-purple-950">
                    {MODEL_SPECS[selectedModelSpecs].features}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] text-base-secondary uppercase font-bold tracking-wider">Execution Hardware mapping</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold font-mono text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                      {MODEL_SPECS[selectedModelSpecs].device}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedModelSpecs(null)}
              className="w-full py-3.5 border border-base-secondary/20 hover:bg-base-surface text-base-primary font-semibold rounded-xl text-sm transition-colors text-center mt-6"
            >
              Close Specs Sheet
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
