import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Database, CheckCircle, LineChart, Download, Check, RotateCcw } from 'lucide-react';
import { useState, useEffect } from 'react';
import clsx from 'clsx';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [hasDataset, setHasDataset] = useState(false);
  const [hasWinner, setHasWinner] = useState(false);

  // Sync state with localStorage on route change
  useEffect(() => {
    setHasDataset(!!localStorage.getItem('laplace_dataset'));
    setHasWinner(!!localStorage.getItem('laplace_winner'));
  }, [location.pathname]);

  const steps = [
    { num: 1, to: "/input", label: "Data Input", icon: Database, isClickable: true },
    { num: 2, to: "/diagnostics", label: "Diagnostics", icon: Activity, isClickable: hasDataset },
    { num: 3, to: "/validation", label: "Validation", icon: CheckCircle, isClickable: hasDataset },
    { num: 4, to: "/forecast", label: "Forecast", icon: LineChart, isClickable: hasWinner },
    { num: 5, to: "/export", label: "Export Studio", icon: Download, isClickable: hasWinner },
  ];

  const currentStepIndex = steps.findIndex(s => location.pathname.startsWith(s.to));

  const handleReset = () => {
    if (window.confirm("WARNING: This will clear your current dataset, models, and forecasts. Do you want to start a new project?")) {
      localStorage.removeItem('laplace_dataset');
      localStorage.removeItem('laplace_winner');
      localStorage.removeItem('laplace_recommended_winner');
      localStorage.removeItem('laplace_winner_is_override');
      localStorage.removeItem('laplace_validation_metrics');
      localStorage.removeItem('laplace_horizon');
      sessionStorage.removeItem('laplace_forecast_data');
      navigate('/input');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-base-canvas text-base-primary">
      {/* Header / Nav */}
      <header className="border-b border-base-surface/50 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-32 flex items-center justify-between">
          {/* Logo Zone */}
          <div className="flex items-center flex-shrink-0">
            <img 
              src="/logo-header.png" 
              alt="Laplace Logo" 
              className="h-28 w-auto object-contain hover:scale-105 transition-transform duration-300 cursor-pointer" 
              onClick={() => navigate('/input')} 
            />
          </div>
          
          {/* Stepper Zone */}
          <div className="flex-1 max-w-4xl px-8 mt-2">
            <div className="flex items-center justify-between relative">
              {/* Progress Line Background */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-base-secondary/20 -translate-y-1/2 z-0" />
              
              {/* Steps */}
              {steps.map((step, index) => {
                const isActive = currentStepIndex === index;
                const isPast = currentStepIndex > index;
                const disabled = !step.isClickable && !isActive && !isPast;
                
                return (
                  <button
                    key={step.to}
                    disabled={disabled}
                    onClick={() => navigate(step.to)}
                    className={clsx(
                      "relative z-10 flex flex-col items-center gap-2 group transition-all duration-300",
                      disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                    )}
                  >
                    {/* Circle */}
                    <div 
                      className={clsx(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-sm",
                        isActive ? "bg-accent-pulse border-accent-pulse text-white scale-110" :
                        isPast ? "bg-accent-success border-accent-success text-white" :
                        "bg-white border-base-secondary/30 text-base-secondary group-hover:border-base-secondary"
                      )}
                    >
                      {isPast ? <Check size={18} strokeWidth={3} /> : <step.icon size={18} />}
                    </div>
                    {/* Label */}
                    <div 
                      className={clsx(
                        "text-[11px] font-semibold uppercase tracking-wider transition-colors",
                        isActive ? "text-accent-pulse" :
                        isPast ? "text-base-primary" :
                        "text-base-secondary"
                      )}
                    >
                      Step {step.num}: {step.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions Zone */}
          <div className="flex items-center justify-end flex-shrink-0 w-32 mt-2">
            <button
              onClick={handleReset}
              title="Start New Project / Clear Data"
              className="p-3 text-base-secondary hover:text-accent-alert hover:bg-accent-alert/10 rounded-full transition-colors flex items-center gap-2"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
