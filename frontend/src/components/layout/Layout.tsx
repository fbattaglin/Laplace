import { Outlet, NavLink } from 'react-router-dom';
import { Activity, Database, CheckCircle, LineChart, Download } from 'lucide-react';
import clsx from 'clsx';

export default function Layout() {
  const navItems = [
    { to: "/input", label: "Data Input", icon: Database },
    { to: "/diagnostics", label: "Diagnostics", icon: Activity },
    { to: "/validation", label: "Validation", icon: CheckCircle },
    { to: "/forecast", label: "Forecast", icon: LineChart },
    { to: "/export", label: "Export", icon: Download },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-base-canvas text-base-primary">
      {/* Header / Nav */}
      <header className="border-b border-base-surface/50 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-40 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <img src="/logo-header.png" alt="Laplace Logo" className="h-32 w-auto object-contain" />
            <div className="flex flex-col">
              <span className="font-bold text-4xl tracking-tight">Laplace</span>
              <button 
                onClick={() => {
                  if (window.confirm("WARNING: This will clear your current dataset, models, and forecasts. Do you want to start a new project?")) {
                    localStorage.removeItem('laplace_dataset');
                    localStorage.removeItem('laplace_winner');
                    sessionStorage.removeItem('laplace_forecast_data');
                    window.location.href = '/input';
                  }
                }}
                className="text-xs text-accent-alert font-medium mt-1 hover:underline text-left"
              >
                Reset Workspace
              </button>
            </div>
          </div>
          
          <nav className="flex items-center gap-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => clsx(
                  "flex items-center gap-2 text-sm font-medium transition-colors border-b-2 py-5",
                  isActive 
                    ? "text-accent-pulse border-accent-pulse" 
                    : "text-base-secondary border-transparent hover:text-base-primary"
                )}
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
