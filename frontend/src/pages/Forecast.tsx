import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Rocket, ChevronRight, TrendingUp, TrendingDown, Minus, ShieldAlert, BarChart2, Activity, Printer } from 'lucide-react';
import { Line, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { runForecast, loadDataset, type ForecastRequest, type ForecastResponse, type DatasetResponse } from '../lib/api';
import clsx from 'clsx';
import { useMode } from '../context/ModeContext';

const MODEL_COLORS: Record<string, string> = {
  'Chronos-2': '#0066FF',
  'TimesFM-200M': '#34A853',
  'AutoARIMA': '#9D00FF',
  'ARIMA': '#9D00FF',
  'AutoETS': '#FF6B00',
  'ETS': '#FF6B00',
  'Theta': '#FFC700',
  'SeasonalNaive': '#FF2A3A',
  'Ensemble': '#06B6D4'
};

interface ModelMetrics { model: string; sMAPE: number; MASE: number; RMSE: number; }

const fmt = (num: number, dec = 0) => num.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });


export default function Forecast() {
  const { isLab } = useMode();
  const [config, setConfig] = useState<ForecastRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [isOverride, setIsOverride] = useState(false);
  const [recommendedWinner, setRecommendedWinner] = useState<string | null>(null);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);

  const [datasetDetails, setDatasetDetails] = useState<DatasetResponse | null>(null);
  const [futureCovariates, setFutureCovariates] = useState<Record<string, number[]>>({});
  const [simulatedData, setSimulatedData] = useState<ForecastResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeCovariateTab, setActiveCovariateTab] = useState<string>('');
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(true);
  const prevDatasetName = useRef<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('laplace_dataset');
    const winner = localStorage.getItem('laplace_winner') || 'ETS';
    const horizon = parseInt(localStorage.getItem('laplace_horizon') || '12', 10);
    const override = localStorage.getItem('laplace_winner_is_override') === 'true';
    const recommended = localStorage.getItem('laplace_recommended_winner');
    const metricsRaw = localStorage.getItem('laplace_validation_metrics');

    setIsOverride(override && winner !== recommended);
    setRecommendedWinner(recommended);

    if (metricsRaw) {
      try {
        const allMetrics: ModelMetrics[] = JSON.parse(metricsRaw);
        const mine = allMetrics.find(m => m.model === winner) || null;
        setModelMetrics(mine);
      } catch (_) {}
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // Load pre-processing configs from localStorage
        let cleaning_config = undefined;
        let excluded_anomalies = undefined;
        let ensemble_config = undefined;
        
        const savedClean = localStorage.getItem('laplace_clean_config');
        if (savedClean) {
          try {
            cleaning_config = JSON.parse(savedClean);
          } catch (_) {}
        }
        
        const savedExcluded = localStorage.getItem('laplace_excluded_anomalies');
        if (savedExcluded) {
          try {
            excluded_anomalies = JSON.parse(savedExcluded);
          } catch (_) {}
        }

        if (winner === 'Ensemble') {
          const savedEnsemble = localStorage.getItem('laplace_ensemble_config');
          if (savedEnsemble) {
            try {
              ensemble_config = JSON.parse(savedEnsemble);
            } catch (_) {}
          }
        }

        const reqConfig = { 
          ...parsed, 
          model_name: winner, 
          horizon,
          covariate_cols: parsed.covariate_cols || [],
          cleaning_config,
          excluded_anomalies,
          ensemble_config
        };
        setConfig(reqConfig);
        loadForecast(reqConfig);
        if (parsed.dataset_name) {
          loadDataset(parsed.dataset_name)
            .then(setDatasetDetails)
            .catch((e) => console.error("Failed to load dataset details on mount", e));
        }
      } catch (e) {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const loadForecast = async (req: ForecastRequest) => {
    try {
      setLoading(true);
      const res = await runForecast(req);
      setData(res);
      sessionStorage.setItem('laplace_forecast_data', JSON.stringify(res));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initialize futureCovariates when data & datasetDetails become available
  useEffect(() => {
    if (!config || !data || !datasetDetails) return;
    
    const datasetName = config.dataset_name;
    const activeCovs = config.covariate_cols || [];
    const horizon = data.horizon;
    
    if (prevDatasetName.current !== datasetName && activeCovs.length > 0) {
      prevDatasetName.current = datasetName;
      
      const lastRow = datasetDetails.chart_data?.[datasetDetails.chart_data.length - 1];
      const initialFutureCovs: Record<string, number[]> = {};
      
      activeCovs.forEach((col: string) => {
        const val = lastRow && typeof lastRow[col] === 'number' ? lastRow[col] : 0;
        initialFutureCovs[col] = Array(horizon).fill(val);
      });
      
      setFutureCovariates(initialFutureCovs);
      if (activeCovs.length > 0) {
        setActiveCovariateTab(activeCovs[0]);
      }
    }
  }, [config, data, datasetDetails]);

  // Debounced Simulation recalculation
  useEffect(() => {
    if (!config || !data || Object.keys(futureCovariates).length === 0) {
      setSimulatedData(null);
      return;
    }

    const activeCovs = config.covariate_cols || [];
    if (activeCovs.length === 0) {
      setSimulatedData(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSimulating(true);
        const req = {
          ...config,
          future_covariates: futureCovariates
        };
        const res = await runForecast(req);
        setSimulatedData(res);
      } catch (err: any) {
        console.error("Simulation failed:", err);
      } finally {
        setIsSimulating(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [futureCovariates, config, data]);

  const getSensitivityMultiplier = () => {
    if (!simulatedData || !data || !config?.covariate_cols || config.covariate_cols.length === 0) return null;
    const activeCov = activeCovariateTab;
    if (!activeCov) return null;

    const baseForecastSum = data.forecast.mean.reduce((a, b) => a + b, 0);
    const simForecastSum = simulatedData.forecast.mean.reduce((a, b) => a + b, 0);
    const dY = simForecastSum - baseForecastSum;

    // Calculate baseline X sum (h steps of the last known value)
    const lastRow = datasetDetails?.chart_data?.[datasetDetails.chart_data.length - 1];
    if (!lastRow) return null;
    const baseVal = typeof lastRow[activeCov] === 'number' ? lastRow[activeCov] : 0;
    const h = data.horizon;
    const baseValSum = baseVal * h;

    const simValSum = futureCovariates[activeCov]?.reduce((a, b) => a + b, 0) || 0;
    const dX = simValSum - baseValSum;

    if (Math.abs(dX) < 1e-4) return 0;
    return dY / dX;
  };

  const hasWeekendFeature = datasetDetails?.columns?.includes('calendar_is_weekend');
  const hasHolidayFeature = datasetDetails?.columns?.includes('calendar_is_holiday');

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
        <h3 className="font-medium">Projecting the Future...</h3>
        <p className="text-sm text-base-secondary">Generating intervals with {config.model_name}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-accent-alert/10 text-accent-alert rounded-xl border border-accent-alert/20">
        <h3 className="font-bold mb-2">Forecast Failed</h3>
        <p>{error}</p>
        <button onClick={() => loadForecast(config)} className="mt-4 px-4 py-2 bg-white text-accent-alert rounded-md font-medium text-sm">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  // ── Derived Insights ────────────────────────────────────────────────────
  const lastActual = data.history.actual[data.history.actual.length - 1];
  const lastForecast = data.forecast.mean[data.forecast.mean.length - 1];
  const totalChange = lastForecast - lastActual;
  const totalChangePct = lastActual !== 0 ? (totalChange / Math.abs(lastActual)) * 100 : 0;

  const avgCI = data.forecast.mean.reduce((acc, _, i) => {
    return acc + (data.forecast.upper[i] - data.forecast.lower[i]);
  }, 0) / data.forecast.mean.length;
  const avgCIPct = data.forecast.mean.reduce((acc, v) => acc + Math.abs(v), 0) / data.forecast.mean.length;
  const ciWidthPct = avgCIPct > 0 ? (avgCI / avgCIPct) * 100 : 0;

  const direction: 'up' | 'down' | 'flat' =
    Math.abs(totalChangePct) < 1 ? 'flat' : totalChange > 0 ? 'up' : 'down';

  const confidenceLabel =
    ciWidthPct < 10 ? 'High' : ciWidthPct < 25 ? 'Moderate' : ciWidthPct < 50 ? 'Low' : 'Very Low';
  const confidenceColor =
    ciWidthPct < 10 ? 'text-accent-success' : ciWidthPct < 25 ? 'text-accent-warning' : 'text-accent-alert';

  // ── Chart prep ──────────────────────────────────────────────────────────
  const chartData: any[] = [];
  const historyLen = data.history.dates.length;
  const cutoff = Math.max(0, historyLen - 60);

  for (let i = cutoff; i < historyLen; i++) {
    chartData.push({ date: data.history.dates[i], actual: data.history.actual[i] });
  }
  const lastHistoryPoint = chartData[chartData.length - 1];
  const h = data.horizon;
  for (let i = 0; i < h; i++) {
    chartData.push({
      date: data.forecast.dates[i],
      mean: data.forecast.mean[i],
      interval: [data.forecast.lower[i], data.forecast.upper[i]],
      simulatedMean: simulatedData ? simulatedData.forecast.mean[i] : undefined,
      simulatedInterval: simulatedData ? [simulatedData.forecast.lower[i], simulatedData.forecast.upper[i]] : undefined
    });
  }

  const modelColor = MODEL_COLORS[data.model] || '#0066FF';
  const cutoffDate = lastHistoryPoint.date;
  const isWinnerModel = !isOverride;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Forecast</h1>
          <p className="text-base-secondary max-w-2xl">
            {isOverride ? (
              <>Projection with <span className="font-bold text-base-primary">{data.model}</span> — manually selected over the recommended <span className="font-bold text-base-primary">{recommendedWinner}</span>.</>
            ) : (
              <>Projection with <span className="font-bold text-base-primary">{data.model}</span> — top-ranked model from the backtest.</>
            )}
          </p>
        </div>
        {!isLab && (
          <div className="no-print">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-base-primary text-white rounded-lg font-medium hover:bg-base-primary/90 transition-colors shadow-sm"
            >
              <Printer size={18} />
              <span>Print Report</span>
            </button>
          </div>
        )}
      </div>

      {/* Override warning */}
      {isOverride && recommendedWinner && (
        <div className="flex items-center gap-3 p-4 bg-accent-warning/10 border border-accent-warning/30 rounded-xl">
          <ShieldAlert className="text-accent-warning shrink-0" size={20} />
          <p className="text-sm">
            <span className="font-bold text-accent-warning">Manual Override Active — </span>
            <span className="text-base-secondary">
              You are using <strong>{data.model}</strong> instead of the top-ranked <strong>{recommendedWinner}</strong>. Accuracy may differ from backtest results.
            </span>
          </p>
        </div>
      )}

      {/* Main Chart */}
      <div className="p-6 bg-white border border-base-secondary/20 rounded-2xl h-[480px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Rocket size={20} className="text-accent-pulse" />
            <h2 className="text-lg font-semibold">{data.model} — {data.horizon}-step Projection</h2>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#111111]" />
              <span className="text-base-secondary">Historical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: modelColor }} />
              <span className="text-base-secondary">Forecast</span>
            </div>
            {simulatedData && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 border-t-2 border-dashed border-[#10B981]" />
                <span className="text-base-secondary">Simulated</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-sm opacity-20" style={{ backgroundColor: modelColor }} />
              <span className="text-base-secondary">80% CI</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6E6E73' }} axisLine={false} tickLine={false} minTickGap={30} />
            <YAxis tick={{ fontSize: 10, fill: '#6E6E73' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} width={50} tickFormatter={(v) => fmt(v)} />
            <Tooltip
              contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#111111' }}
              formatter={(value: any, name: any) => {
                if (name === 'Forecast') return [fmt(value, 1), name];
                if (name === 'Actual') return [fmt(value, 1), name];
                if (name === 'Simulated Scenario') return [fmt(value, 1), name];
                return [value, name];
              }}
            />
            <ReferenceLine x={cutoffDate} stroke="#6E6E73" strokeDasharray="3 3" label={{ position: 'top', value: 'Today', fill: '#6E6E73', fontSize: 12 }} />
            <Area type="monotone" dataKey="interval" stroke="none" fill={modelColor} fillOpacity={0.15} activeDot={false} />
            {simulatedData && (
              <Area type="monotone" dataKey="simulatedInterval" stroke="none" fill="#10B981" fillOpacity={0.1} activeDot={false} />
            )}
            <Line type="monotone" dataKey="actual" stroke="#111111" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#111111', stroke: 'none' }} name="Actual" />
            <Line type="monotone" dataKey="mean" stroke={modelColor} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: modelColor, stroke: 'none' }} name="Forecast" connectNulls />
            {simulatedData && (
              <Line 
                type="monotone" 
                dataKey="simulatedMean" 
                stroke="#10B981" 
                strokeWidth={2.5} 
                strokeDasharray="4 4"
                dot={false} 
                activeDot={{ r: 4, fill: '#10B981', stroke: 'none' }} 
                name="Simulated Scenario" 
                connectNulls 
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* What-If Scenario Simulation Studio */}
      {config.covariate_cols && config.covariate_cols.length > 0 && (
        <div className="p-6 bg-white/60 backdrop-blur-md border border-base-secondary/20 rounded-2xl shadow-md space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={20} className={clsx("text-emerald-500", isSimulating ? "animate-spin" : "animate-pulse")} />
              <h3 className="text-lg font-bold text-base-primary">What-If Scenario Simulation Studio</h3>
              <span className={clsx(
                "px-2.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider transition-all",
                isSimulating ? "bg-accent-pulse/10 text-accent-pulse animate-pulse" : "bg-emerald-500/10 text-emerald-600"
              )}>
                {isSimulating ? "Recalculating..." : "ARIMAX Exogenous Engine"}
              </span>
            </div>
            <button 
              onClick={() => setIsWhatIfOpen(!isWhatIfOpen)}
              className="text-xs font-semibold text-base-secondary hover:text-base-primary transition-colors"
            >
              {isWhatIfOpen ? "Collapse Studio" : "Expand Studio"}
            </button>
          </div>

          {isWhatIfOpen && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Model warning if not ARIMA or Ensemble */}
              {config.model_name !== 'ARIMA' && config.model_name !== 'Ensemble' && (
                <div className="p-4 bg-accent-warning/10 border border-accent-warning/20 rounded-xl flex items-center gap-3">
                  <AlertTriangle className="text-accent-warning shrink-0" size={20} />
                  <div className="text-xs text-base-secondary leading-relaxed">
                    <span className="font-bold text-accent-warning">ARIMAX Required: </span>
                    What-If simulations require models supporting exogenous covariates.
                    The current model <strong className="text-base-primary">{config.model_name}</strong> does not natively support future covariate overrides.
                    <button 
                      onClick={() => {
                        const nextConfig = { ...config, model_name: 'ARIMA' };
                        setConfig(nextConfig);
                        localStorage.setItem('laplace_winner', 'ARIMA');
                        loadForecast(nextConfig);
                      }}
                      className="ml-2 underline font-bold text-base-primary hover:text-base-primary/80"
                    >
                      Switch to ARIMA
                    </button>
                  </div>
                </div>
              )}

              {/* Covariate Selection Tabs */}
              <div className="flex gap-2 border-b border-base-secondary/15 pb-3">
                {config.covariate_cols.map((cov) => (
                  <button
                    key={cov}
                    onClick={() => setActiveCovariateTab(cov)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      activeCovariateTab === cov 
                        ? "bg-[#111111] text-white shadow-sm" 
                        : "bg-white text-base-secondary border border-base-secondary/20 hover:bg-base-surface"
                    )}
                  >
                    {cov}
                  </button>
                ))}
              </div>

              {/* Sliders Grid */}
              {activeCovariateTab && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-semibold text-base-secondary uppercase">Future Timeline Adjustments</span>
                      <p className="text-[11px] text-base-secondary">Modify the values of <strong className="text-base-primary">{activeCovariateTab}</strong> for each future forecast step.</p>
                    </div>
                    <button
                      onClick={() => {
                        const lastRow = datasetDetails?.chart_data?.[datasetDetails.chart_data.length - 1];
                        const baseVal = lastRow && typeof lastRow[activeCovariateTab] === 'number' ? lastRow[activeCovariateTab] : 0;
                        setFutureCovariates(prev => ({
                          ...prev,
                          [activeCovariateTab]: Array(data.horizon).fill(baseVal)
                        }));
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold text-base-secondary border border-base-secondary/20 rounded-md hover:bg-white hover:text-base-primary transition-all"
                    >
                      Reset to Baseline
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Array.from({ length: data.horizon }).map((_, stepIdx) => {
                      const dateLabel = data.forecast.dates[stepIdx];
                      const currentVal = futureCovariates[activeCovariateTab]?.[stepIdx] ?? 0;
                      
                      // Get range from historical min/max
                      const histVals = datasetDetails?.chart_data?.map(d => d[activeCovariateTab]).filter(v => typeof v === 'number') || [];
                      const histMin = histVals.length > 0 ? Math.min(...histVals) : 0;
                      const histMax = histVals.length > 0 ? Math.max(...histVals) : 100;
                      const sliderMin = histMin >= 0 ? 0 : histMin * 1.5;
                      const sliderMax = histMax === 0 ? 100 : histMax * 2.0;

                      return (
                        <div key={stepIdx} className="p-3 bg-white border border-base-secondary/15 rounded-xl space-y-2 flex flex-col justify-between shadow-sm">
                          <div>
                            <div className="text-[10px] font-bold text-base-secondary">{dateLabel}</div>
                            <div className="text-[9px] text-base-secondary uppercase">Step {stepIdx + 1}</div>
                          </div>
                          
                          <div className="space-y-1">
                            <input
                              type="range"
                              min={sliderMin}
                              max={sliderMax}
                              step={(sliderMax - sliderMin) / 100}
                              value={currentVal}
                              onChange={(e) => {
                                const nextVal = parseFloat(e.target.value);
                                setFutureCovariates(prev => {
                                  const arr = [...(prev[activeCovariateTab] || [])];
                                  arr[stepIdx] = nextVal;
                                  return { ...prev, [activeCovariateTab]: arr };
                                });
                              }}
                              className="w-full accent-emerald-500 cursor-pointer"
                            />
                            <div className="text-xs font-bold text-emerald-600 text-right">
                              {fmt(currentVal, 1)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empirical Calibration & Regime Controls */}
      {data.science_metadata && (
        <div className="p-6 bg-gradient-to-r from-base-surface to-base-surface/50 border border-base-secondary/25 rounded-2xl shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-accent-pulse" size={20} />
            <h3 className="text-lg font-bold text-base-primary">Empirical Calibration &amp; Regime Controls</h3>
            <span className="px-2.5 py-0.5 text-[9px] font-semibold bg-[#111111] text-white rounded-md uppercase tracking-wider">
              Empirical Safeguards
            </span>
          </div>

          <div className={clsx(
            "grid grid-cols-1 gap-6",
            config.covariate_cols && config.covariate_cols.length > 0 ? "md:grid-cols-3" : "md:grid-cols-2"
          )}>
            {/* Conformal Prediction Panel */}
            <div className="p-4 bg-white/70 border border-base-secondary/15 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-base-primary">Conformal Prediction Intervals</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-accent-success/10 text-accent-success rounded-md">
                  Active & Calibrated
                </span>
              </div>
              <p className="text-xs text-base-secondary leading-relaxed">
                {data.science_metadata.conformal_calibration.explanation}
              </p>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-[10px] text-base-secondary uppercase tracking-wider">Calibration Method</div>
                  <div className="text-xs font-semibold text-base-primary mt-0.5">
                    {data.science_metadata.conformal_calibration.method}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-base-secondary uppercase tracking-wider">Empirical Spread (80% CI)</div>
                  <div className="text-xs font-bold text-accent-pulse mt-0.5">
                    {data.science_metadata.conformal_calibration.half_width 
                      ? `±${fmt(data.science_metadata.conformal_calibration.half_width, 1)}` 
                      : "Using Baseline"}
                  </div>
                </div>
              </div>
            </div>

            {/* Changepoint Adaptation Panel */}
            <div className="p-4 bg-white/70 border border-base-secondary/15 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-base-primary">Changepoint-Aware Adaptation</span>
                {data.science_metadata.changepoint_adaptation.shock_detected ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-accent-warning/15 text-accent-warning rounded-md animate-pulse">
                    ⚠ Structural Break Handled
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-base-secondary/10 text-base-secondary rounded-md">
                    Stable Trend
                  </span>
                )}
              </div>
              <p className="text-xs text-base-secondary leading-relaxed">
                {data.science_metadata.changepoint_adaptation.explanation}
              </p>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-[10px] text-base-secondary uppercase tracking-wider">Regime Transition</div>
                  <div className="text-xs font-semibold text-base-primary mt-0.5">
                    {data.science_metadata.changepoint_adaptation.shock_detected 
                      ? `Shock Date: ${data.science_metadata.changepoint_adaptation.shock_date}`
                      : "No structural shock"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-base-secondary uppercase tracking-wider">Training Window Optimization</div>
                  <div className="text-xs font-semibold text-base-primary mt-0.5">
                    {data.science_metadata.changepoint_adaptation.shock_detected 
                      ? `${data.science_metadata.changepoint_adaptation.original_length} pts → ${data.science_metadata.changepoint_adaptation.trimmed_length} pts`
                      : `Full history (${data.science_metadata.changepoint_adaptation.original_length} pts) preserved`}
                  </div>
                </div>
              </div>
            </div>

            {/* Exogenous Elasticity & Sensitivity Card */}
            {config.covariate_cols && config.covariate_cols.length > 0 && (
              <div className="p-4 bg-white/70 border border-base-secondary/15 rounded-xl space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-base-primary">Empirical Exogenous Elasticity</span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 rounded-md">
                      Sensitivity Analysis
                    </span>
                  </div>
                  <p className="text-xs text-base-secondary leading-relaxed mt-2">
                    Measures the predictive responsiveness of the target variable to unit adjustments in active exogenous drivers. Calculated live from the ARIMAX covariate transfer functions.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-base-secondary/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-base-secondary uppercase tracking-wider">Dynamic Multiplier</div>
                      <div className={clsx(
                        "text-xs font-bold mt-0.5",
                        getSensitivityMultiplier() !== null && getSensitivityMultiplier()! !== 0 ? "text-emerald-600" : "text-base-primary"
                      )}>
                        {getSensitivityMultiplier() !== null
                          ? `${getSensitivityMultiplier()! >= 0 ? '+' : ''}${fmt(getSensitivityMultiplier()!, 4)} units`
                          : "No simulation shift"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-base-secondary uppercase tracking-wider">Historical Correlation</div>
                      <div className="text-xs font-semibold text-base-primary mt-0.5">
                        {(() => {
                          const activeCov = activeCovariateTab;
                          const cand = datasetDetails?.covariate_candidates?.find(c => c.column === activeCov);
                          return cand ? `${cand.correlation >= 0 ? '+' : ''}${cand.correlation.toFixed(3)}` : "Analyzing...";
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Calendar features didactics if present */}
                  {(hasWeekendFeature || hasHolidayFeature) && (
                    <div className="p-2 bg-[#111111]/5 rounded-lg border border-base-secondary/10">
                      <div className="text-[10px] font-bold text-base-primary flex items-center gap-1.5">
                        <ShieldAlert size={10} className="text-accent-pulse" />
                        <span>Calendar Breaks &amp; Holiday Matrix</span>
                      </div>
                      <div className="text-[9px] text-base-secondary mt-1 leading-relaxed">
                        {hasWeekendFeature && "✓ Weekly cycle calendar_is_weekend ingested. "}
                        {hasHolidayFeature && "✓ US Federal holidays calendar_is_holiday mapped."}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insight Cards — data-driven */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* Card 1: Projected Change */}
        <div className="p-5 bg-white rounded-xl border border-base-secondary/20">
          <div className="flex items-center gap-2 mb-3">
            {direction === 'up' && <TrendingUp size={18} className="text-accent-success" />}
            {direction === 'down' && <TrendingDown size={18} className="text-accent-alert" />}
            {direction === 'flat' && <Minus size={18} className="text-base-secondary" />}
            <span className="text-xs font-medium text-base-secondary uppercase tracking-wider">Projected Change</span>
          </div>
          <div className={clsx(
            "text-3xl font-bold mb-1",
            direction === 'up' ? 'text-accent-success' : direction === 'down' ? 'text-accent-alert' : 'text-base-secondary'
          )}>
            {totalChangePct >= 0 ? '+' : ''}{totalChangePct.toFixed(1)}%
          </div>
          <div className="text-sm text-base-secondary">
            {direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'}&nbsp;
            {fmt(Math.abs(totalChange), 0)} over {data.horizon} steps
          </div>
          <div className="mt-2 text-xs text-base-secondary">
            Last value: <span className="font-medium text-base-primary">{fmt(lastActual, 1)}</span> →{' '}
            End forecast: <span className="font-medium text-base-primary">{fmt(lastForecast, 1)}</span>
          </div>
        </div>

        {/* Card 2: Forecast Confidence */}
        <div className="p-5 bg-white rounded-xl border border-base-secondary/20">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={18} className="text-accent-pulse" />
            <span className="text-xs font-medium text-base-secondary uppercase tracking-wider">Forecast Confidence</span>
          </div>
          <div className={clsx("text-3xl font-bold mb-1", confidenceColor)}>
            {confidenceLabel}
          </div>
          <div className="text-sm text-base-secondary">
            Avg CI width: ±{(ciWidthPct / 2).toFixed(1)}% of forecast value
          </div>
          <div className="mt-2 text-xs text-base-secondary">
            {ciWidthPct < 10
              ? 'Tight bounds — model is highly certain.'
              : ciWidthPct < 25
              ? 'Moderate spread — reasonable confidence.'
              : 'Wide bounds — treat as a range, not a point.'}
          </div>
        </div>

        {/* Card 3: Model Performance (from backtest) */}
        <div className="p-5 bg-white rounded-xl border border-base-secondary/20">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={18} className="text-accent-pulse" />
            <span className="text-xs font-medium text-base-secondary uppercase tracking-wider">Backtest Accuracy</span>
          </div>
          {modelMetrics ? (
            <>
              <div className="text-3xl font-bold mb-1 text-base-primary">
                {modelMetrics.sMAPE}%
                <span className="text-sm font-normal text-base-secondary ml-1">sMAPE</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <div className="text-[10px] text-base-secondary uppercase">MASE</div>
                  <div className="text-sm font-semibold">{modelMetrics.MASE}</div>
                </div>
                <div>
                  <div className="text-[10px] text-base-secondary uppercase">RMSE</div>
                  <div className="text-sm font-semibold">{fmt(modelMetrics.RMSE, 1)}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-base-secondary">
                {isWinnerModel ? '🏆 Top-ranked model on holdout set.' : `Ranked below ${recommendedWinner} on holdout set.`}
              </div>
            </>
          ) : (
            <div className="text-sm text-base-secondary">Run Step 3 first to see backtest metrics.</div>
          )}
        </div>

        {/* Card 4: Horizon Context */}
        <div className="p-5 bg-white rounded-xl border border-base-secondary/20">
          <div className="flex items-center gap-2 mb-3">
            <Rocket size={18} className="text-accent-pulse" />
            <span className="text-xs font-medium text-base-secondary uppercase tracking-wider">Horizon</span>
          </div>
          <div className="text-3xl font-bold mb-1 text-base-primary">
            {data.horizon}
            <span className="text-sm font-normal text-base-secondary ml-1">steps</span>
          </div>
          <div className="text-sm text-base-secondary mb-2">
            {data.forecast.dates[0]} → {data.forecast.dates[data.forecast.dates.length - 1]}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className={clsx("px-2 py-0.5 rounded-full font-medium", isWinnerModel ? 'bg-accent-success/10 text-accent-success' : 'bg-accent-warning/10 text-accent-warning')}>
              {isWinnerModel ? '✓ Recommended' : '⚠ Override'}
            </div>
            <span className="text-base-secondary">{data.model}</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-end pt-4 pb-4">
        <button
          onClick={() => window.location.href = '/export'}
          className="flex items-center gap-2 px-8 py-4 bg-accent-success text-white rounded-xl font-bold text-lg hover:bg-accent-success/90 hover:-translate-y-0.5 transition-all shadow-lg shadow-accent-success/20 active:translate-y-0"
        >
          Open Export Studio (Step 5)
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}
