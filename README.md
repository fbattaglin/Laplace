<div align="center">
  <img src="frontend/public/logo-header.png" alt="Laplace Logo" width="120" />
  <h1>Laplace V2</h1>
  <p><b>The Uncompromising Time-Series Forecasting Sandbox & Laboratory</b></p>
</div>

---

**Laplace** is a desktop-first, full-stack time-series laboratory designed to treat predictive analytics as a rigorous, empirical science. 

Named after [Laplace's Demon](https://en.wikipedia.org/wiki/Laplace%27s_demon), this application is a **forecasting sandbox** for data scientists and principal analysts. It pits zero-shot Deep Learning Foundation Models (**Google TimesFM, Amazon Chronos**) against classic statistical engines (**AutoARIMA, AutoETS, Theta, Seasonal Naive**) in a rigorous, zero-leakage backtest—fully equipped with real-time exogenous What-If simulations, conformal calibration safeguards, and structural break adaptation.

---

## 🧠 Core Laboratory Features

Most forecasting tools are either too simple (ignoring confidence intervals and signal validation) or too complex (requiring hundreds of lines of boilerplate Python). Laplace is an interactive, visual sandbox designed for rigorous scientific experimentation:

### 1. Hardcore Diagnostics & EDA (Step 2)
- **Signal Decomposition:** Break down time series into Observed, Trend, Seasonal, and Residual components using STL.
- **Statistical Moments:** Compute heavy-tailed indicators (Skewness, Kurtosis) alongside stationarity metrics (Augmented Dickey-Fuller p-values).
- **Hardcore Didactics Toggle:** Instantly switch between **Boardroom Didactics** (executive-friendly, value-oriented explanations) and **Lab Didactics** (uncompromising, peer-level mathematical formulas and proofs) across all views.
- **Temporal Changepoints:** Identify sudden structural breaks using Ruptures binary segmentation.

### 2. Preprocessing & Auto-Inversion
- **Outlier Pruning:** Interactively check and exclude anomalies detected via Isolation Forests.
- **Variance Stabilization:** Apply Logarithmic or Box-Cox transformations. 
- **Auto-Inversion Pipeline:** Preprocessing states are automatically propagated to validation and forecasting backends. Error metrics (sMAPE, MASE) and charts are rendered strictly in the original target scale by performing automatic mathematical inversion.

### 3. Exogenous Covariate Impact Analyzer
- **Correlation Mapping:** Analyze exogenous driver strength using Pearson correlation coefficients ($r$) on high-contrast sliders.
- **Dynamic Selection:** Filter out weak drivers ($|r| < 0.2$) with noise alerts, and selectively ingest relevant features.
- **Calendar & Holiday Feature Engineering:** Automatically detect Date indices on upload and engineer zero-dependency binary weekend (`calendar_is_weekend`) and national holiday (`calendar_is_holiday`) covariates using native calendar matrices.

### 4. Empirical Calibration & Regime Controls (Step 4)
- **Conformal Prediction Intervals:** Calibrates forecast boundaries to guarantee correct empirical coverage (80% level) using Quantile Absolute Residuals (EnbPI) over rolling validation splits.
- **Changepoint-Aware Adaptive Training:** Mitigates pre-shock parameter bias by automatically trimming historical training windows to focus strictly on the post-structural break regime.

### 5. Interactive What-If Scenario Simulation Studio
- **Glassmorphic Timeline Slider Deck:** Drag timeline range sliders step-by-step to customize future covariate values (e.g. Doubling Ad Spend).
- **Blazing-Fast ARIMAX Engine:** Leverages StatsForecast's `AutoARIMA` for near-instantaneous (<150ms debounced) re-forecasting.
- **Dual-Curve Visualizations:** Directly overlays the baseline forecast (solid line) with the simulated scenario (dotted emerald line, emerald-shaded confidence interval, and simulated tooltips).
- **Dynamic Elasticity Sensitivity:** Renders real-time didactics showing the live Dynamic Multiplier (calculated shift in Target per unit adjustment in Covariate).

### 6. Zero-Leakage Leaderboards & Export Studio
- **Leaderboard Rankings:** Pits zero-shot architectures against classical baselines in a rolling-origin validation split, ranking models strictly by sMAPE.
- **Export Center:** Tailor forecasts, export boardroom-ready CSVs, and copy fully reproducible Pandas/PyTorch code snippets to reconstruct the exact model parameters inside Jupyter notebooks.

---

## 🏗 Decoupled Architecture

Laplace prioritizes high-fidelity visuals and raw execution speed:

### Engine (Backend)
- **FastAPI** — High-speed asynchronous Python server.
- **uv** — Lightning-fast dependency and virtual environment manager.
- **StatsForecast** (`Nixtla`) — Blazing fast C++-optimized classical engines.
- **TimesFM & Chronos** — Zero-shot neural forecasting models via PyTorch.
- **Scikit-Learn & Ruptures** — Isolation Forest anomaly isolation and structural breakpoint segmentation.

### Interface (Frontend)
- **React 18 + Vite** — Snappy single-page architecture.
- **Tailwind CSS** — Vibrant minimalist design system utilizing high-contrast translucent elements and glassmorphic panels.
- **Recharts** — Performant, customized D3-based SVG charts.
- **Lucide** — Clean, modern developer iconography.

---

## 🚀 Running Laplace locally

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- [uv](https://github.com/astral-sh/uv) installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### Booting the Stack
To launch both the FastAPI backend and the React frontend in a single command, execute the startup script from the root directory:

```bash
./start.sh
```

The script will automatically kill any stale ports, boot the FastAPI engine, launch the Vite dev server, and orchestrate graceful shutdowns upon receiving `Ctrl+C`.

Access the sandbox at: `http://localhost:5173`.
