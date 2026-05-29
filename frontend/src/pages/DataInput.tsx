import { useState, useEffect } from 'react';
import { Upload, Database, ChevronRight, FileSpreadsheet, CheckCircle, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchDatasets, loadDataset, uploadDataset, type DatasetResponse, type DatasetInfo } from '../lib/api';
import clsx from 'clsx';
import { useMode } from '../context/ModeContext';

const getBadgeColor = (tag: string) => {
  const t = tag.toLowerCase();
  if (['economics', 'retail', 'demand'].includes(t)) return 'bg-accent-pulse/10 text-accent-pulse border-accent-pulse/30';
  if (['seasonal', 'dual-seasonality'].includes(t)) return 'bg-accent-flare/10 text-accent-flare border-accent-flare/30';
  if (['high-noise', 'random-walk'].includes(t)) return 'bg-accent-alert/10 text-accent-alert border-accent-alert/30';
  if (['mean-reverting'].includes(t)) return 'bg-accent-warning/10 text-accent-warning border-accent-warning/30';
  if (['trend', 'stable', 'intermittent'].includes(t)) return 'bg-accent-success/10 text-accent-success border-accent-success/30';
  return 'bg-base-secondary/10 text-base-secondary border-base-secondary/30';
};

const LaplaceConsole = () => {
  const text = `> "We may regard the present state of the universe as the effect of its past and the cause of its future. An intellect which at a certain moment would know all forces that set nature in motion, and all positions of all items of which nature is composed, if this intellect were also vast enough to submit these data to analysis, it would embrace in a single formula the movements of the greatest bodies of the universe and those of the tiniest atom; for such an intellect nothing would be uncertain and the future just like the past could be present before its eyes."\n> initializing forecasting engine...\n> tensors calibrated.`;
  const [displayedText, setDisplayedText] = useState("");
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.substring(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 15);
    return () => clearInterval(interval);
  }, []);

  // Render with indigo-accented prompt lines
  const lines = displayedText.split('\n');

  return (
    <div className="mb-8 p-4 bg-[#1C1C1E] rounded-xl border border-white/8 font-mono text-[12px] leading-relaxed shadow-lg">
      <div className="flex items-center gap-2 mb-3 opacity-60">
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
        <span className="ml-2 text-[#F5F5F7] font-sans text-[10px] tracking-wider uppercase opacity-70">daemon.log</span>
      </div>
      <div className="whitespace-pre-wrap">
        {lines.map((line, idx) => {
          const isPrompt = line.startsWith('>');
          return (
            <div key={idx}>
              {isPrompt ? (
                <span>
                  <span className="text-[#6366F1] font-semibold">&gt;</span>
                  <span className="text-[#F5F5F7]">{line.slice(1)}</span>
                </span>
              ) : (
                <span className="text-[#F5F5F7]">{line}</span>
              )}
            </div>
          );
        })}
        <span className="animate-pulse font-bold text-[#6366F1]">_</span>
      </div>
    </div>
  );
};


export default function DataInput() {
  const { isLab } = useMode();
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DatasetResponse | null>(null);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  const [funMessage, setFunMessage] = useState("");
  const [isCovariatesOpen, setIsCovariatesOpen] = useState(false);
  const [selectedCovariates, setSelectedCovariates] = useState<string[]>([]);
  const [previewedCovariate, setPreviewedCovariate] = useState<string | null>(null);

  useEffect(() => {
    // Sync covariates to localStorage when they change
    const datasetInfo = localStorage.getItem('laplace_dataset');
    if (datasetInfo) {
      try {
        const parsed = JSON.parse(datasetInfo);
        parsed.covariate_cols = selectedCovariates;
        localStorage.setItem('laplace_dataset', JSON.stringify(parsed));
      } catch (e) {
        console.error("Failed to update covariates in localStorage", e);
      }
    }
  }, [selectedCovariates]);

  useEffect(() => {
    fetchDatasets().then(setDatasets).catch(e => console.error("Failed to load datasets", e));
  }, []);

  const triggerFunMessage = () => {
    const messages = [
      "Awakening the Demon...",
      "Calibrating quantum tensors...",
      "Extracting signal from noise...",
      "Summoning foundation models...",
      "Looking into the future..."
    ];
    setFunMessage(messages[Math.floor(Math.random() * messages.length)]);
  };

  const resetWorkspaceState = () => {
    localStorage.removeItem('laplace_dataset');
    localStorage.removeItem('laplace_winner');
    sessionStorage.removeItem('laplace_forecast_data');
  };

  const handleLoadReference = async (name: string) => {
    try {
      triggerFunMessage();
      setLoading(true);
      setError(null);
      setActiveDataset(name);
      
      const res = await loadDataset(name);
      setData(res);
      
      resetWorkspaceState();
      
      if (res.suggested_date_col && res.suggested_target_col) {
        localStorage.setItem('laplace_dataset', JSON.stringify({
          dataset_type: 'reference',
          dataset_name: name,
          date_col: res.suggested_date_col,
          target_col: res.suggested_target_col
        }));
      } else {
        setError("Warning: Could not automatically detect Date or Target columns. Diagnostics may fail.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      triggerFunMessage();
      setLoading(true);
      setError(null);
      setActiveDataset(file.name);
      
      const res = await uploadDataset(file);
      setData(res);
      
      resetWorkspaceState();
      
      if (res.suggested_date_col && res.suggested_target_col) {
        localStorage.setItem('laplace_dataset', JSON.stringify({
          dataset_type: 'upload',
          dataset_name: file.name,
          date_col: res.suggested_date_col,
          target_col: res.suggested_target_col
        }));
      } else {
        setError("Warning: Could not automatically detect Date or Target columns. Diagnostics may fail.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDateColChange = (newCol: string) => {
    if (!data) return;
    const updatedData = { ...data, suggested_date_col: newCol };
    setData(updatedData);
    
    const saved = localStorage.getItem('laplace_dataset');
    let parsed = saved ? JSON.parse(saved) : {};
    parsed.date_col = newCol;
    parsed.dataset_type = parsed.dataset_type || (activeDataset?.endsWith('.csv') || activeDataset?.endsWith('.xlsx') ? 'upload' : 'reference');
    parsed.dataset_name = parsed.dataset_name || activeDataset;
    parsed.target_col = parsed.target_col || data.suggested_target_col;
    
    localStorage.setItem('laplace_dataset', JSON.stringify(parsed));
  };

  const handleTargetColChange = (newCol: string) => {
    if (!data) return;
    const updatedData = { ...data, suggested_target_col: newCol };
    setData(updatedData);
    
    const saved = localStorage.getItem('laplace_dataset');
    let parsed = saved ? JSON.parse(saved) : {};
    parsed.target_col = newCol;
    parsed.dataset_type = parsed.dataset_type || (activeDataset?.endsWith('.csv') || activeDataset?.endsWith('.xlsx') ? 'upload' : 'reference');
    parsed.dataset_name = parsed.dataset_name || activeDataset;
    parsed.date_col = parsed.date_col || data.suggested_date_col;
    
    localStorage.setItem('laplace_dataset', JSON.stringify(parsed));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <LaplaceConsole />

      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Data Input</h1>
        <p className="text-base-secondary">
          Upload your time series dataset or select a reference dataset to begin.
        </p>
      </div>

      <div className="space-y-6">
        {/* Sleek Upload Zone */}
        <div className="bg-base-surface rounded-2xl border border-base-secondary/20 overflow-hidden flex items-center p-4">
          <div className="flex items-center gap-3 px-4 border-r border-base-secondary/20 min-w-max">
            <div className="w-10 h-10 rounded-full bg-accent-pulse/10 flex items-center justify-center">
              <Upload className="text-accent-pulse" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Upload Custom Data</h2>
              <div className="text-xs text-base-secondary">CSV or XLSX (max 50MB)</div>
            </div>
          </div>
          
          <label className={clsx(
              "flex-1 flex items-center justify-between px-6 py-2 ml-4 rounded-xl border border-dashed transition-colors cursor-pointer group", 
              activeDataset && !datasets.find(d => d.name === activeDataset) 
              ? "border-accent-success bg-accent-success/5" 
              : "border-base-secondary/30 bg-white hover:bg-base-surface hover:border-base-secondary/50"
            )}>
            <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
            
            {activeDataset && !datasets.find(d => d.name === activeDataset) ? (
              <div className="flex items-center gap-3 w-full">
                <CheckCircle className="text-accent-success flex-shrink-0" size={20} />
                <div className="flex-1">
                  <div className="font-bold text-sm text-base-primary">{activeDataset}</div>
                  <div className="text-[10px] text-accent-success font-medium">Successfully Loaded</div>
                </div>
                <div className="text-[10px] text-base-secondary bg-white px-3 py-1.5 rounded-full border border-base-secondary/20 group-hover:border-base-secondary transition-colors whitespace-nowrap">
                  Upload different file
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="text-base-secondary group-hover:text-base-primary transition-colors" size={20} />
                  <span className="text-sm font-medium text-base-secondary group-hover:text-base-primary transition-colors">
                    Drag and drop your file here or click to browse
                  </span>
                </div>
                <div className="text-[10px] bg-base-surface px-3 py-1.5 rounded-full border border-base-secondary/20 font-medium whitespace-nowrap">
                  Auto-detects temporal & target columns
                </div>
              </div>
            )}
          </label>
        </div>

        {/* Reference Datasets Horizontal Carousel */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Database className="text-accent-pulse" size={18} />
            <h2 className="font-semibold text-base">Reference Library</h2>
            <span className="text-xs text-base-secondary ml-2">Scroll horizontally to explore benchmarks</span>
          </div>
          
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 hide-scrollbar -mx-2 px-2">
            {datasets.map(ds => (
              <button
                key={ds.name}
                onClick={() => handleLoadReference(ds.name)}
                className={clsx(
                  "snap-start flex-none w-[280px] text-left p-4 rounded-xl border transition-all flex flex-col justify-between group h-[160px]",
                  activeDataset === ds.name 
                    ? "border-accent-pulse bg-white shadow-md ring-1 ring-accent-pulse/20" 
                    : "border-base-secondary/20 bg-base-surface hover:bg-white hover:border-base-secondary/50 hover:shadow-sm"
                )}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium capitalize text-base-primary truncate pr-2">
                      {ds.name.replace('_', ' ')}
                    </div>
                    {activeDataset === ds.name 
                      ? <CheckCircle size={18} className="text-accent-success flex-shrink-0" />
                      : <ChevronRight size={16} className="text-base-secondary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    }
                  </div>
                  
                  {ds.has_covariates && (
                    <div className="mb-2">
                      <span className="text-[9px] px-2 py-0.5 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/10 text-[#6366F1] font-bold uppercase tracking-wider">
                        🎯 Includes Covariates
                      </span>
                    </div>
                  )}

                  <div className="text-xs text-base-secondary line-clamp-2 mt-1 leading-snug">
                    {ds.description}
                  </div>
                </div>

                {ds.tags && ds.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 overflow-hidden h-[20px]">
                    {ds.tags.map(tag => (
                      <span key={tag} className={clsx("text-[9px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap", getBadgeColor(tag))}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 animate-in fade-in">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-full border-4 border-base-surface border-t-accent-pulse animate-spin" />
            <div className="text-sm text-base-secondary font-mono text-accent-pulse">{funMessage}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-accent-alert/10 text-accent-alert rounded-xl border border-accent-alert/20">
          <strong>Error:</strong> {error}
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="mb-6 p-4 bg-accent-success/10 border border-accent-success/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-accent-success" size={24} />
              <div>
                <div className="text-xs text-base-secondary font-medium uppercase tracking-wider">Currently Loaded</div>
                <div className="text-lg font-bold text-base-primary">{activeDataset}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-base-secondary/20 pb-4">
            <h2 className="text-xl font-semibold tracking-tight">Dataset Preview</h2>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-base-secondary">Date Col:</span>
                <select
                  value={data.suggested_date_col || ''}
                  onChange={(e) => handleDateColChange(e.target.value)}
                  className="font-medium px-2 py-1 bg-white text-base-primary rounded-md border border-base-secondary/20 shadow-sm focus:outline-none focus:ring-1 focus:ring-accent-pulse cursor-pointer text-xs"
                >
                  <option value="" disabled>Select Date Col</option>
                  {data.columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base-secondary">Target Col:</span>
                <select
                  value={data.suggested_target_col || ''}
                  onChange={(e) => handleTargetColChange(e.target.value)}
                  className="font-medium px-2 py-1 bg-white text-accent-pulse rounded-md border border-base-secondary/20 shadow-sm focus:outline-none focus:ring-1 focus:ring-accent-pulse cursor-pointer text-xs"
                >
                  <option value="" disabled>Select Target Col</option>
                  {data.columns.filter(col => col !== data.suggested_date_col).map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base-secondary">Rows:</span>
                <span className="font-medium px-2 py-1 bg-base-surface rounded-md border border-base-secondary/20 shadow-sm">{data.total_rows}</span>
              </div>
            </div>
          </div>

          {/* Lab-only Covariate Columns Panel */}
          {isLab && data.covariate_candidates && data.covariate_candidates.length > 0 && (
            <div className="border-l-[3px] border-[#6366F1] bg-[#6366F1]/5 rounded-r-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => setIsCovariatesOpen(!isCovariatesOpen)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#6366F1]/10 transition-colors"
              >
                <div>
                  <h3 className="font-bold flex items-center gap-2 text-base-primary">
                    <span className="text-xl">⚗️</span> COVARIATE COLUMNS
                  </h3>
                  <p className="text-sm text-base-secondary mt-1">
                    {data.covariate_candidates.length} numeric columns available as covariates
                  </p>
                </div>
                <ChevronDown className={clsx("text-base-secondary transition-transform duration-300", isCovariatesOpen ? "rotate-180" : "")} />
              </button>
              
              <div className={clsx(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isCovariatesOpen ? "max-h-[500px] opacity-100 border-t border-[#6366F1]/10" : "max-h-0 opacity-0"
              )}>
                <div className="p-5 bg-white">
                  <h4 className="text-xs font-bold text-base-secondary uppercase tracking-wider mb-3">Select covariates for exogenous regression</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {data.covariate_candidates.map((cov, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border border-base-secondary/20 rounded-lg bg-base-surface/50 hover:bg-base-surface transition-colors">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input 
                            type="checkbox" 
                            className="accent-[#6366F1] w-4 h-4"
                            checked={selectedCovariates.includes(cov.column)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCovariates([...selectedCovariates, cov.column]);
                              } else {
                                setSelectedCovariates(selectedCovariates.filter(c => c !== cov.column));
                              }
                            }}
                          />
                          <span className="font-medium">{cov.column}</span>
                          <span className="text-xs text-base-secondary">(corr: {cov.correlation.toFixed(2)} with target)</span>
                        </label>
                        <select 
                          className="text-xs bg-white border border-base-secondary/30 rounded-md px-2 py-1 outline-none focus:border-[#6366F1] text-base-secondary"
                          defaultValue={cov.suggested_type}
                        >
                          <option value="past_only">Past-only</option>
                          <option value="known_future">Known-future</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-base-secondary mt-4">Covariates will be used by Chronos-2 in Steps 3-4.</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart */}
            <div className="lg:col-span-2 p-6 border border-base-secondary/20 rounded-2xl bg-white h-[400px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-base-secondary uppercase tracking-wider">Target Preview</h3>
                {data.covariate_candidates && data.covariate_candidates.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                    <span className="text-[10px] uppercase font-bold text-base-secondary mr-1">Plot:</span>
                    <button 
                      onClick={() => setPreviewedCovariate(null)}
                      className={clsx(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
                        previewedCovariate === null 
                          ? "bg-[#111111] text-white border-[#111111]" 
                          : "bg-white text-base-secondary border-base-secondary/30 hover:border-[#111111]"
                      )}
                    >
                      Target Only
                    </button>
                    {data.covariate_candidates.slice(0, 3).map((cov, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setPreviewedCovariate(cov.column)}
                        className={clsx(
                          "px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap flex items-center gap-1",
                          previewedCovariate === cov.column
                            ? "bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/30" 
                            : "bg-white text-base-secondary border-base-secondary/30 hover:border-[#6366F1]/50 hover:text-[#6366F1]"
                        )}
                      >
                        <div className={clsx("w-1.5 h-1.5 rounded-full", previewedCovariate === cov.column ? "bg-[#6366F1]" : "bg-transparent")} />
                        {cov.column}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="w-full flex-1 min-h-0">
                {data.suggested_date_col && data.suggested_target_col ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
                      <XAxis 
                        dataKey={data.suggested_date_col} 
                        tick={{fontSize: 12, fill: '#6E6E73'}} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        yAxisId="left"
                        tick={{fontSize: 12, fill: '#6E6E73'}} 
                        axisLine={false}
                        tickLine={false}
                        width={40}
                      />
                      {previewedCovariate && (
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          tick={{fontSize: 12, fill: '#6366F1'}} 
                          axisLine={false}
                          tickLine={false}
                          width={40}
                        />
                      )}
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        name={data.suggested_target_col}
                        dataKey={data.suggested_target_col} 
                        stroke={previewedCovariate ? "#11111140" : "#111111"} 
                        strokeWidth={previewedCovariate ? 1.5 : 2}
                        strokeDasharray={previewedCovariate ? "4 4" : undefined}
                        dot={false}
                        activeDot={{ r: 4, fill: '#0066FF' }}
                      />
                      {previewedCovariate && (
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          name={previewedCovariate}
                          dataKey={previewedCovariate} 
                          stroke="#6366F1" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: '#6366F1' }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-base-secondary text-sm">
                    Unable to generate chart: date or target column not detected automatically.
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="lg:col-span-1 p-6 border border-base-secondary/20 rounded-2xl bg-white flex flex-col h-[400px]">
              <h3 className="text-sm font-medium text-base-secondary mb-4 uppercase tracking-wider">Sample Data</h3>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-base-secondary uppercase sticky top-0 bg-white">
                    <tr>
                      {data.columns.slice(0, 3).map(col => (
                        <th key={col} className="px-4 py-3 border-b border-base-secondary/20 font-medium">
                          {col}
                        </th>
                      ))}
                      {data.columns.length > 3 && <th className="px-4 py-3 border-b border-base-secondary/20">...</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.preview_data.slice(0, 15).map((row, i) => (
                      <tr key={i} className="border-b border-base-surface last:border-0 hover:bg-base-surface/50">
                        {data.columns.slice(0, 3).map(col => (
                          <td key={col} className="px-4 py-2 truncate max-w-[100px]" title={String(row[col])}>
                            {row[col]}
                          </td>
                        ))}
                        {data.columns.length > 3 && <td className="px-4 py-2 text-base-secondary">...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-8 pb-4">
            <button 
              onClick={() => window.location.href = '/diagnostics'}
              className="flex items-center gap-2 px-8 py-4 bg-accent-success text-white rounded-xl font-bold text-lg hover:bg-accent-success/90 hover:-translate-y-0.5 transition-all shadow-lg shadow-accent-success/20 active:translate-y-0"
            >
              Proceed to Diagnostics (Step 2)
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
