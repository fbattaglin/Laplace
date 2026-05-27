import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, TrendingUp, BarChart2, Calculator, ChevronRight, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { runDiagnostics, cleanData, type DiagnosticsRequest, type DiagnosticsResponse } from '../lib/api';
import clsx from 'clsx';
import { useMode } from '../context/ModeContext';

export default function Diagnostics() {
  const { isLab } = useMode();
  const [config, setConfig] = useState<DiagnosticsRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  
  const [isDataPrepOpen, setIsDataPrepOpen] = useState(false);
  const [isAnomalyOpen, setIsAnomalyOpen] = useState(false);

  const [outlierMethod, setOutlierMethod] = useState("off");
  const [smoothingMethod, setSmoothingMethod] = useState("off");
  const [varianceMethod, setVarianceMethod] = useState("off");
  const [missingMethod, setMissingMethod] = useState("off");
  const [cleanPreviewData, setCleanPreviewData] = useState<number[] | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [excludedAnomalies, setExcludedAnomalies] = useState<number[]>([]);
  const [activeCovariates, setActiveCovariates] = useState<string[]>([]);

  const handleApplyTransforms = async () => {
    if (!config) return;
    setCleaning(true);
    try {
      const steps = [];
      if (missingMethod !== "off") steps.push({ type: "missing", method: missingMethod });
      if (outlierMethod !== "off") steps.push({ type: "outlier", method: outlierMethod, threshold: 1.5 });
      if (smoothingMethod !== "off") steps.push({ type: "smooth", method: smoothingMethod, window: 5 });
      if (varianceMethod !== "off") steps.push({ type: "variance", method: varianceMethod });

      const res = await cleanData({
        dataset_type: config.dataset_type,
        dataset_name: config.dataset_name,
        date_col: config.date_col,
        target_col: config.target_col,
        config: steps,
        excluded_anomalies: excludedAnomalies
      });
      setCleanPreviewData(res.cleaned_data);
      localStorage.setItem('laplace_clean_config', JSON.stringify(steps));
    } catch (e) {
      console.error(e);
    } finally {
      setCleaning(false);
    }
  };

  const handleResetTransforms = () => {
    setOutlierMethod("off");
    setSmoothingMethod("off");
    setVarianceMethod("off");
    setMissingMethod("off");
    setExcludedAnomalies([]);
    setCleanPreviewData(null);
    localStorage.removeItem('laplace_clean_config');
    localStorage.removeItem('laplace_excluded_anomalies');
  };

  const renderBtn = (curr: string, set: any, val: string, lbl: string) => (
    <button 
      onClick={() => set(val)}
      className={clsx(
        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
        curr === val ? "bg-white shadow-sm text-base-primary" : "text-base-secondary hover:text-base-primary"
      )}
    >
      {lbl}
    </button>
  );

  useEffect(() => {
    const saved = localStorage.getItem('laplace_dataset');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
        loadDiagnostics(parsed);
        if (parsed.covariate_cols) {
          setActiveCovariates(parsed.covariate_cols);
        }
      } catch (e) {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }

    const savedExclusions = localStorage.getItem('laplace_excluded_anomalies');
    if (savedExclusions) {
      try {
        setExcludedAnomalies(JSON.parse(savedExclusions));
      } catch (e) {}
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

  const handleToggleCovariate = (columnName: string) => {
    setActiveCovariates(prev => {
      const next = prev.includes(columnName)
        ? prev.filter(c => c !== columnName)
        : [...prev, columnName];
        
      // Sync back to localstorage 'laplace_dataset'
      const saved = localStorage.getItem('laplace_dataset');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          parsed.covariate_cols = next;
          localStorage.setItem('laplace_dataset', JSON.stringify(parsed));
          setConfig(parsed);
        } catch (e) {
          console.error(e);
        }
      }
      return next;
    });
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
    anomaly: data.anomalies.some((a: any) => a.index === i) ? data.stl.observed[i] : null
  }));

  const acfData = data.acf.map((val, i) => ({ lag: i, value: val }));
  const pacfData = data.pacf.map((val, i) => ({ lag: i, value: val }));

  const previewChartData = data.dates.map((date, i) => ({
    date,
    original: data.stl.observed[i],
    cleaned: cleanPreviewData ? cleanPreviewData[i] : null
  }));

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-accent-pulse";
    if (score >= 40) return "text-accent-warning";
    return "text-accent-alert";
  };

  const statCards = [
    { label: "Start Date", value: data.stats.start_date },
    { label: "End Date", value: data.stats.end_date },
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

      <div className="p-6 bg-white border border-base-secondary/20 rounded-2xl h-[400px] flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={20} className="text-base-secondary" />
          <h2 className="text-lg font-semibold">Original Time Series (Observed)</h2>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stlData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
            <XAxis dataKey="date" tick={{fontSize: 10, fill: '#6E6E73'}} axisLine={false} tickLine={false} minTickGap={30} />
            <YAxis tick={{fontSize: 10, fill: '#6E6E73'}} axisLine={false} tickLine={false} domain={['auto', 'auto']} width={40} />
            <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Line type="monotone" dataKey="observed" stroke="#111111" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
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
              <h2 className="text-xl font-bold">
                {isLab ? "Information Purity & Entropy Index" : "Forecast Predictability Index"}
              </h2>
            </div>
            <p className="text-lg font-medium text-base-primary mb-2">{data.forecastability.label}</p>
            <p className="text-sm text-base-secondary mb-4 leading-relaxed max-w-2xl">
              {isLab ? (
                <span>
                  <strong>Signal-to-Noise Purity:</strong> Evaluates the relative variance of decomposition components. A higher score signifies strong covariance stationarity, low statistical entropy, and highly visible model convergence criteria.
                </span>
              ) : (
                <span>
                  <strong>Predictability Score:</strong> A business-friendly rating of how clean, structured, and easy-to-forecast your time series is. Higher ratings mean the future is highly visible, allowing for extremely confident budget planning.
                </span>
              )}
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

        {/* Stationarity Analysis Card */}
        <div className="p-6 bg-white border border-base-secondary/20 rounded-2xl flex flex-col justify-center animate-in fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-base-secondary" />
            <h3 className="font-semibold">
              {isLab ? "ADF Stationarity Analysis" : "Baseline Stability Analysis"}
            </h3>
          </div>
          <div className="flex flex-col items-center justify-center text-center mb-6">
            {data.adf_test.is_stationary ? (
              <CheckCircle className="text-accent-success mb-2" size={32} />
            ) : (
              <XCircle className="text-accent-alert mb-2" size={32} />
            )}
            <div className="text-lg font-bold">
              {data.adf_test.is_stationary ? "Stationary (Stable)" : "Non-Stationary"}
            </div>
            <div className="text-xs text-base-secondary mt-1 max-w-[200px]">
              {isLab ? (
                data.adf_test.is_stationary 
                  ? "Reject H₀. The series is covariance stationary with time-invariant mean and variance. Ideal for ARIMA estimators."
                  : "Fail to reject H₀. Series exhibits a unit root (non-stationary). Differencing (d >= 1) is statistically required."
              ) : (
                data.adf_test.is_stationary 
                  ? "Stable baseline. The baseline sales level does not shift randomly or drift over time. This makes forecasting much simpler!"
                  : "Drifting baseline. Your baseline sales levels grow or shrink over time. Laplace will automatically adapt to capture this trend."
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-auto">
            <div className="p-3 bg-base-surface rounded-lg border border-base-secondary/10">
              <div className="text-xs text-base-secondary mb-1">
                {isLab ? "ADF p-value" : "Confidence Level"}
              </div>
              <div className={clsx("font-medium text-sm", data.adf_test.p_value < 0.05 ? "text-accent-success" : "text-accent-alert")}>
                {isLab ? data.adf_test.p_value : (data.adf_test.p_value < 0.05 ? "95%+ (Strong)" : "Low Confidence")}
              </div>
            </div>
            <div className="p-3 bg-base-surface rounded-lg border border-base-secondary/10">
              <div className="text-xs text-base-secondary mb-1">
                {isLab ? "Test Statistic" : "Stability Class"}
              </div>
              <div className="font-medium text-sm">
                {isLab ? data.adf_test.test_statistic : (data.adf_test.is_stationary ? "High Stability" : "Active Trend")}
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
          <div className="grid grid-cols-2 gap-2 overflow-auto max-h-[300px] pr-2">
            {statCards.map((stat, i) => (
              <div key={i} className="p-2 bg-base-surface rounded-lg border border-base-secondary/10 flex flex-col">
                <div className="text-[10px] text-base-secondary mb-0.5 uppercase tracking-wider">{stat.label}</div>
                <div className="font-medium text-xs truncate" title={String(stat.value)}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Covariates Correlation Dashboard */}
      {data.covariates && data.covariates.length > 0 && (
        <div className="p-6 bg-white border border-base-secondary/20 rounded-2xl space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 size={22} className="text-[#6366F1]" />
              <h2 className="text-xl font-bold tracking-tight">
                {isLab ? "Exogenous Covariate Cross-Correlation" : "External Factors & Drivers Analysis"}
              </h2>
            </div>
            <span className="px-3 py-1 bg-[#6366F1]/10 text-[#6366F1] rounded-full text-xs font-bold uppercase tracking-wider">
              {data.covariates.length} Drivers Found
            </span>
          </div>

          <p className="text-sm text-base-secondary leading-relaxed">
            {isLab ? (
              "Calculates Pearson product-moment correlation coefficients (r) between exogenous covariates and the target series. Promising covariate candidates are classified by seasonal dynamics."
            ) : (
              "These external factors (like marketing spend, events, or weather) have been detected in your dataset. Laplace automatically checks how closely they influence your sales to improve predictions."
            )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.covariates.map((cov: any, idx: number) => {
              const absCorr = Math.abs(cov.correlation);
              const isPositive = cov.correlation > 0.1;
              const isActive = activeCovariates.includes(cov.column);
              const isWeak = absCorr < 0.2;
              
              let relationshipLabel = "Neutral / Weak";
              let relationshipColor = "bg-gray-100 text-gray-700";
              if (absCorr > 0.6) {
                relationshipLabel = isPositive ? "Strong Positive Driver" : "Strong Negative Driver";
                relationshipColor = isPositive ? "bg-accent-pulse/10 text-accent-pulse" : "bg-accent-alert/10 text-accent-alert";
              } else if (absCorr > 0.25) {
                relationshipLabel = isPositive ? "Moderate Positive" : "Moderate Negative";
                relationshipColor = isPositive ? "bg-[#34A853]/10 text-[#34A853]" : "bg-accent-warning/10 text-accent-warning";
              }

              return (
                <div key={idx} className={clsx(
                  "p-5 border rounded-xl flex flex-col justify-between hover:shadow-md transition-all",
                  isActive ? "bg-base-surface/40 border-base-secondary/15" : "bg-gray-50/50 border-gray-200/60 opacity-80"
                )}>
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="truncate">
                        <span className="text-xs font-bold text-base-secondary uppercase tracking-wider block mb-1">Factor Name</span>
                        <span className={clsx(
                          "font-bold text-md truncate block", 
                          isActive ? "text-base-primary" : "text-gray-400 line-through"
                        )} title={cov.column}>{cov.column}</span>
                      </div>
                      <span className={clsx("px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0", relationshipColor)}>
                        {relationshipLabel}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-base-secondary">Pearson Correlation (r)</span>
                        <span className={clsx("font-bold", cov.correlation > 0 ? "text-[#34A853]" : "text-accent-alert")}>
                          {cov.correlation > 0 ? `+${cov.correlation}` : cov.correlation}
                        </span>
                      </div>
                      {/* Visual correlation bar */}
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden relative">
                        <div 
                          className={clsx("h-full absolute top-0 rounded-full", cov.correlation > 0 ? "bg-[#34A853]" : "bg-accent-alert")}
                          style={{
                            left: cov.correlation > 0 ? '50%' : `${50 + cov.correlation * 50}%`,
                            width: `${absCorr * 50}%`
                          }}
                        />
                        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-gray-300" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-base-secondary/10 mt-auto space-y-3">
                    <span className="text-[10px] font-bold text-base-secondary uppercase tracking-wider block">
                      {isLab ? "Estimator Alignment" : "How we use this"}
                    </span>
                    <p className="text-xs text-base-secondary leading-relaxed">
                      {isLab ? (
                        <span>
                          Classified as <strong className="text-base-primary">{cov.suggested_type}</strong> exogenous series. Autoregressive models will ingest this via lagged covariates transfer functions.
                        </span>
                      ) : (
                        <span>
                          {absCorr > 0.25 ? (
                            <span>
                              Has a <strong className="text-base-primary">meaningful impact</strong> on target. Chronos-2 will ingest this to align sales forecasts with your upcoming promotional plans.
                            </span>
                          ) : (
                            <span>
                              Has a <strong className="text-base-primary">minor correlation</strong>. Checked past relationships to isolate baseline seasonality from pure coincidences.
                            </span>
                          )}
                        </span>
                      )}
                    </p>

                    {/* Proactive recommendation alert */}
                    {isWeak && isActive && (
                      <div className="p-2.5 bg-accent-warning/10 text-accent-warning border border-accent-warning/20 rounded-lg text-xs flex items-start gap-2 animate-in fade-in duration-300">
                        <span className="text-md shrink-0">⚠️</span>
                        <div>
                          <strong className="block mb-0.5">{isLab ? "High Noise Entropy" : "Low Predictability Signal"}</strong>
                          <span>{isLab ? "Pearson correlation is statistically negligible. Risk of training overfitting." : "This factor shows a very weak relationship. Keeping it might add noise to your forecast."}</span>
                        </div>
                      </div>
                    )}

                    {/* Active ignore / include button */}
                    <button 
                      onClick={() => handleToggleCovariate(cov.column)}
                      className={clsx(
                        "w-full py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 border",
                        isActive 
                          ? (isWeak 
                            ? "bg-accent-warning/5 border-accent-warning/30 text-accent-warning hover:bg-accent-warning/10" 
                            : "bg-[#6366F1]/5 border-[#6366F1]/20 text-[#6366F1] hover:bg-[#6366F1]/10")
                          : "bg-gray-100 hover:bg-gray-200 border-transparent text-gray-500 line-through"
                      )}
                    >
                      {isActive ? (
                        <>
                          <span>✓</span>
                          <span>{isLab ? "Active Exogenous Driver" : "Active in Model"}</span>
                        </>
                      ) : (
                        <>
                          <span>✕</span>
                          <span>{isLab ? "Omitted Exogenous Factor" : "Ignored / Excluded"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* STL Decomposition Plots */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} className="text-base-secondary" />
            <h2 className="text-lg font-semibold">
              {isLab ? "LOESS STL Signal Decomposition" : "Core Business Drivers (Decomposition)"}
            </h2>
          </div>
          <p className="text-sm text-base-secondary mb-4">
            {isLab ? (
              "Additive decomposition: Y_t = T_t + S_t + R_t. Red indicators represent Isolation Forest anomaly contamination. Vertical dashed lines denote ruptures/trend changepoints."
            ) : (
              "We split your history into three clear forces: long-term Momentum (Trend), regular weekly/monthly Calendar Cycles (Seasonality), and random Noise (Residuals). Red dots represent unexpected outlier events."
            )}
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
              { key: 'trend', label: isLab ? 'Trend' : 'Momentum & Trend (Long-term Direction)', color: '#0066FF' },
              { key: 'seasonal', label: isLab ? 'Seasonal' : 'Calendar Cycles (Weekly/Monthly Patterns)', color: '#FF6B00' },
              { key: 'resid', label: isLab ? 'Residuals (Noise)' : 'Random Noise & Anomalies', color: '#6E6E73' }
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

        {/* Data Prep & Anomaly Panels (Visible in both modes!) */}
        {true && (
          <div className="space-y-4">
            {/* Panel 1: Data Prep */}
            <div className="border-l-[3px] border-[#6366F1] bg-[#6366F1]/5 rounded-r-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => setIsDataPrepOpen(!isDataPrepOpen)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#6366F1]/10 transition-colors"
              >
                <div>
                  <h3 className="font-bold flex items-center gap-2 text-base-primary">
                    <span className="text-xl">🧹</span> {isLab ? "DATA PREP PIPELINE" : "DATA CLEANING & PREPARATION"}
                  </h3>
                  <p className="text-sm text-base-secondary mt-1">
                    {isLab 
                      ? `${outlierMethod !== "off" || smoothingMethod !== "off" || varianceMethod !== "off" || missingMethod !== "off" ? "Active transforms" : "No transforms applied"} · ${data.anomalies?.length || 0} outliers detected` 
                      : "Adjust for outliers, dampen random noise, and stabilize large data swings"}
                  </p>
                </div>
                <ChevronDown className={clsx("text-base-secondary transition-transform duration-300", isDataPrepOpen ? "rotate-180" : "")} />
              </button>
              
              <div className={clsx(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isDataPrepOpen ? "max-h-[800px] opacity-100 border-t border-[#6366F1]/10" : "max-h-0 opacity-0"
              )}>
                <div className="p-5 bg-white">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{isLab ? "Outlier Removal" : "Dampen Spikes & Dips"}</span>
                        <div className="flex items-center bg-base-surface rounded-lg p-1">
                          {renderBtn(outlierMethod, setOutlierMethod, "off", "Off")}
                          {renderBtn(outlierMethod, setOutlierMethod, "iqr", isLab ? "IQR" : "IQR (Auto)")}
                          {renderBtn(outlierMethod, setOutlierMethod, "zscore", isLab ? "Z-Score" : "Z-Score")}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{isLab ? "Smoothing" : "Dampen Random Noise"}</span>
                        <div className="flex items-center bg-base-surface rounded-lg p-1">
                          {renderBtn(smoothingMethod, setSmoothingMethod, "off", "Off")}
                          {renderBtn(smoothingMethod, setSmoothingMethod, "sma", isLab ? "SMA" : "Moving Avg")}
                          {renderBtn(smoothingMethod, setSmoothingMethod, "ewm", isLab ? "EWM" : "Weighted")}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{isLab ? "Variance Transform" : "Stabilize Wild Volatility"}</span>
                        <div className="flex items-center bg-base-surface rounded-lg p-1">
                          {renderBtn(varianceMethod, setVarianceMethod, "off", "Off")}
                          {renderBtn(varianceMethod, setVarianceMethod, "log", isLab ? "Log" : "Log (Dampen)")}
                          {renderBtn(varianceMethod, setVarianceMethod, "boxcox", isLab ? "Box-Cox" : "Box-Cox (Advanced)")}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{isLab ? "Missing Values" : "Interpolate Blank Gaps"}</span>
                        <div className="flex items-center bg-base-surface rounded-lg p-1">
                          {renderBtn(missingMethod, setMissingMethod, "off", "Off")}
                          {renderBtn(missingMethod, setMissingMethod, "linear", isLab ? "Linear" : "Linear Fill")}
                          {renderBtn(missingMethod, setMissingMethod, "zero", isLab ? "Zero" : "Fill Zeros")}
                        </div>
                      </div>
                    </div>
                    
                    <div className="border border-base-secondary/20 rounded-xl p-4 bg-base-surface/30 flex flex-col h-64">
                      {cleanPreviewData ? (
                        <>
                          <h4 className="text-xs font-semibold text-base-secondary uppercase tracking-wider mb-2">Transformed Preview</h4>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={previewChartData}>
                              <XAxis dataKey="date" hide />
                              <YAxis hide domain={['auto', 'auto']} />
                              <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Line type="monotone" dataKey="original" stroke="#6E6E73" strokeDasharray="3 3" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Original" />
                              <Line type="monotone" dataKey="cleaned" stroke="#0066FF" strokeWidth={2} dot={false} isAnimationActive={false} name="Transformed" />
                            </LineChart>
                          </ResponsiveContainer>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-sm text-base-secondary">Select methods and click Apply to preview</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-base-surface">
                    <button onClick={handleResetTransforms} className="px-4 py-2 text-sm font-medium text-base-secondary hover:text-base-primary transition-colors">Reset to Raw</button>
                    <button 
                      onClick={handleApplyTransforms} 
                      disabled={cleaning}
                      className="px-4 py-2 text-sm font-medium bg-[#6366F1] text-white rounded-lg shadow-sm hover:bg-[#6366F1]/90 transition-colors disabled:opacity-50"
                    >
                      {cleaning ? "Applying..." : "Apply Transforms"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 2: Anomaly Inspector */}
            <div className="border-l-[3px] border-[#6366F1] bg-[#6366F1]/5 rounded-r-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => setIsAnomalyOpen(!isAnomalyOpen)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#6366F1]/10 transition-colors"
              >
                <div>
                  <h3 className="font-bold flex items-center gap-2 text-base-primary">
                    <span className="text-xl">🔍</span> {isLab ? "ANOMALY DETECTOR" : "OUTLIER & EVENT ADJUSTER"}
                  </h3>
                  <p className="text-sm text-base-secondary mt-1">
                    {data.anomalies?.length || 0} {isLab ? "anomalies detected (Isolation Forest)" : "unusual spikes or shocks detected"}
                  </p>
                </div>
                <ChevronDown className={clsx("text-base-secondary transition-transform duration-300", isAnomalyOpen ? "rotate-180" : "")} />
              </button>
              
              <div className={clsx(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isAnomalyOpen ? "max-h-[500px] opacity-100 border-t border-[#6366F1]/10" : "max-h-0 opacity-0"
              )}>
                <div className="p-5 bg-white">
                  <div className="h-32 mb-4 border border-base-secondary/20 rounded-xl bg-base-surface/30 flex flex-col items-center justify-center p-4 text-center">
                    <span className="text-xl mb-1">🛡️</span>
                    <span className="text-sm font-semibold text-base-primary mb-1">
                      {isLab ? "Rigorous Isolation Forest Filtering" : "Outlier Adjustment Engine"}
                    </span>
                    <span className="text-xs text-base-secondary max-w-md">
                      {isLab 
                        ? "Identifies records situated in low-density subspaces of the R¹ projection, using a contamination factor of 0.05."
                        : "Outliers are major anomalies (like unexpected discount events) that could throw off forecasting algorithms."}
                    </span>
                  </div>
                  
                  <div className="border border-base-secondary/20 rounded-xl overflow-hidden">
                    <div className="bg-base-surface px-4 py-2 border-b border-base-secondary/20 flex text-xs font-bold text-base-secondary uppercase tracking-wider">
                      <div className="w-1/4">Date</div>
                      <div className="w-1/4">Value</div>
                      <div className="w-1/4">{isLab ? "Anomaly Score" : "Impact Score"}</div>
                      <div className="w-1/4 text-right">Action</div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {data.anomalies && data.anomalies.length > 0 ? (
                        data.anomalies.map((a: any, i: number) => (
                          <div key={i} className="px-4 py-3 border-b border-base-secondary/10 flex items-center text-sm last:border-0 hover:bg-base-surface/50">
                            <div className="w-1/4 font-medium">{data.dates[a.index]}</div>
                            <div className="w-1/4">{Number(a.value).toFixed(2)}</div>
                            <div className="w-1/4 flex items-center gap-2">
                              {a.score.toFixed(2)}
                              <span className={clsx(
                                "w-2 h-2 rounded-full",
                                a.severity === "high" ? "bg-accent-alert" : "bg-accent-warning"
                              )} />
                            </div>
                            <div className="w-1/4 text-right">
                              <label className="flex items-center justify-end gap-2 cursor-pointer text-base-secondary hover:text-base-primary">
                                <input 
                                  type="checkbox" 
                                  className="accent-[#6366F1] w-4 h-4" 
                                  checked={excludedAnomalies.includes(a.index)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setExcludedAnomalies(prev => {
                                      const next = checked 
                                        ? [...prev, a.index] 
                                        : prev.filter(idx => idx !== a.index);
                                      localStorage.setItem('laplace_excluded_anomalies', JSON.stringify(next));
                                      return next;
                                    });
                                  }}
                                />
                                <span className="text-xs">Exclude</span>
                              </label>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-base-secondary italic">No anomalies detected.</div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-base-secondary mt-3">
                    {isLab 
                      ? "Excluded coordinates will be replaced via local linear interpolation prior to estimator fitting."
                      : "Checked anomalies are excluded from training, auto-replacing them with smooth estimates to protect your baseline trend."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACF / PACF Plots */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={20} className="text-base-secondary" />
            <h2 className="text-lg font-semibold">
              {isLab ? "Autocorrelation & Memory Lags" : "Historical Calendar Repeatability"}
            </h2>
          </div>
          <p className="text-sm text-base-secondary mb-4">
            {isLab ? (
              "Autocorrelation (ACF) and Partial Autocorrelation (PACF) coefficients showing statistical memory across lags."
            ) : (
              "Visualizes if your sales have strong recurring patterns (weekly, monthly or seasonal memory)."
            )}
          </p>

          <div className="grid grid-cols-1 gap-6">
            <div className="p-6 bg-white border border-base-secondary/20 rounded-2xl h-[300px]">
              <h3 className="text-xs font-semibold text-base-secondary uppercase tracking-wider mb-4">
                {isLab ? "ACF (Autocorrelation Function)" : "Direct Sales Patterns (ACF)"}
              </h3>
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
              <h3 className="text-xs font-semibold text-base-secondary uppercase tracking-wider mb-4">
                {isLab ? "PACF (Partial Autocorrelation Function)" : "Indirect Sales Cycles (PACF)"}
              </h3>
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
      
      <div className="flex justify-end pt-8 pb-4">
        <button 
          onClick={() => window.location.href = '/validation'}
          className="flex items-center gap-2 px-8 py-4 bg-accent-success text-white rounded-xl font-bold text-lg hover:bg-accent-success/90 hover:-translate-y-0.5 transition-all shadow-lg shadow-accent-success/20 active:translate-y-0"
        >
          Run Validation Engine (Step 3)
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}
