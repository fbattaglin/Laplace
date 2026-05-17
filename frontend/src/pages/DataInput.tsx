import { useState, useEffect } from 'react';
import { Upload, Database, ChevronRight, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchDatasets, loadDataset, uploadDataset, type DatasetResponse, type DatasetInfo } from '../lib/api';
import clsx from 'clsx';

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
  const text = `> "An intellect which at a certain moment would know all forces that set nature in motion, and all positions of all items of which nature is composed... for such an intellect nothing would be uncertain and the future just like the past would be present before its eyes."\n> initializing forecasting engine...\n> tensors calibrated.`;
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

  return (
    <div className="mb-8 p-4 bg-[#111111] rounded-xl border border-white/10 font-mono text-[12px] leading-relaxed text-[#00FF41] shadow-inner">
      <div className="flex items-center gap-2 mb-3 opacity-50">
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]"></div>
        <span className="ml-2 text-white font-sans text-[10px] tracking-wider uppercase opacity-70">daemon.log</span>
      </div>
      <div className="whitespace-pre-wrap">{displayedText}<span className="animate-pulse font-bold text-white">_</span></div>
    </div>
  );
};

export default function DataInput() {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DatasetResponse | null>(null);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  const [funMessage, setFunMessage] = useState("");

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <LaplaceConsole />

      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Data Input</h1>
        <p className="text-base-secondary">
          Upload your time series dataset or select a reference dataset to begin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reference Datasets */}
        <div className="p-6 bg-base-surface rounded-2xl border border-base-secondary/20">
          <div className="flex items-center gap-2 mb-4">
            <Database className="text-accent-pulse" size={20} />
            <h2 className="font-semibold text-lg">Reference Datasets</h2>
          </div>
          <p className="text-sm text-base-secondary mb-4">
            Start quickly with standard benchmarking datasets.
          </p>
          <div className="space-y-3">
            {datasets.map(ds => (
              <button
                key={ds.name}
                onClick={() => handleLoadReference(ds.name)}
                className={clsx(
                  "w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group",
                  activeDataset === ds.name 
                    ? "border-accent-pulse bg-white shadow-sm" 
                    : "border-base-secondary/20 bg-white hover:border-base-secondary/50"
                )}
              >
                <div>
                  <div className="font-medium capitalize text-base-primary flex items-center gap-2">
                    {ds.name.replace('_', ' ')}
                  </div>
                  
                  {ds.tags && ds.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                      {ds.tags.map(tag => (
                        <span key={tag} className={clsx("text-[10px] px-2 py-0.5 rounded-full border font-medium", getBadgeColor(tag))}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-base-secondary mt-1">{ds.description}</div>
                  
                  {ds.problem_statement && (
                    <div className="text-[11px] text-accent-pulse mt-2 font-medium italic border-l-2 border-accent-pulse pl-2">
                      {ds.problem_statement}
                    </div>
                  )}
                </div>
                {activeDataset === ds.name 
                  ? <CheckCircle size={20} className="text-accent-success flex-shrink-0 ml-4" />
                  : <ChevronRight size={18} className="text-base-secondary group-hover:text-base-primary transition-colors flex-shrink-0 ml-4" />
                }
              </button>
            ))}
          </div>
        </div>

        {/* Upload Zone */}
        <div className="p-6 bg-base-surface rounded-2xl border border-base-secondary/20 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="text-accent-pulse" size={20} />
            <h2 className="font-semibold text-lg">Upload Data</h2>
          </div>
          <p className="text-sm text-base-secondary mb-4">
            Upload your own CSV or Excel file. We will attempt to auto-detect the temporal and target columns.
          </p>
          
          <label className={clsx("flex-1 flex flex-col items-center justify-center border-2 rounded-xl transition-colors cursor-pointer group p-8 text-center min-h-[200px]", 
              activeDataset && !datasets.find(d => d.name === activeDataset) 
              ? "border-accent-success bg-accent-success/5 border-solid" 
              : "border-dashed border-base-secondary/30 bg-white hover:bg-base-surface/50")}>
            <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
            
            {activeDataset && !datasets.find(d => d.name === activeDataset) ? (
              <>
                <div className="w-16 h-16 rounded-full bg-accent-success/10 flex items-center justify-center mb-4">
                  <CheckCircle className="text-accent-success" size={32} />
                </div>
                <div className="font-bold text-lg mb-1">{activeDataset}</div>
                <div className="text-xs text-accent-success font-medium">Successfully Loaded</div>
                <div className="text-[10px] text-base-secondary mt-4 bg-white px-3 py-1 rounded-full border border-base-secondary/20 hover:border-base-secondary transition-colors">
                  Click to upload a different file
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-base-surface flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="text-base-secondary" size={24} />
                </div>
                <div className="font-medium mb-1">Click to browse or drag file here</div>
                <div className="text-xs text-base-secondary">CSV or XLSX up to 50MB</div>
                <div className="text-[10px] text-base-secondary mt-4 bg-base-surface px-3 py-1 rounded-full border border-base-secondary/20">
                  Hint: Try our <b>sample_datasets/</b> folder
                </div>
              </>
            )}
          </label>
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
                <span className="font-medium px-2 py-1 bg-base-surface rounded-md border border-base-secondary/20 shadow-sm">{data.suggested_date_col || 'Not detected'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base-secondary">Target Col:</span>
                <span className="font-medium px-2 py-1 bg-base-surface rounded-md border border-base-secondary/20 shadow-sm text-accent-pulse">{data.suggested_target_col || 'Not detected'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base-secondary">Rows:</span>
                <span className="font-medium px-2 py-1 bg-base-surface rounded-md border border-base-secondary/20 shadow-sm">{data.total_rows}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart */}
            <div className="lg:col-span-2 p-6 border border-base-secondary/20 rounded-2xl bg-white h-[400px]">
              <h3 className="text-sm font-medium text-base-secondary mb-4 uppercase tracking-wider">Target Preview</h3>
              <div className="w-full h-[300px]">
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
                        tick={{fontSize: 12, fill: '#6E6E73'}} 
                        axisLine={false}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey={data.suggested_target_col} 
                        stroke="#111111" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#0066FF' }}
                      />
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
