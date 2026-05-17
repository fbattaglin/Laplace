<div align="center">
  <img src="frontend/public/logo-header.png" alt="Laplace Logo" width="120" />
  <h1>Laplace V2</h1>
  <p><b>Foundation Model Forecasting for the Boardroom</b></p>
</div>

---

**Laplace** is a desktop-first, full-stack application designed to answer a single question with absolute rigor: *What is the most accurate way to predict the future of this time series?*

Named after [Laplace's Demon](https://en.wikipedia.org/wiki/Laplace%27s_demon), this app bridges the gap between hardcore data science labs and executive boardrooms. It pits zero-shot Foundation Models (**Google TimesFM, Amazon Chronos**) against battle-tested statistical baselines (**ETS, Theta, Seasonal Naive**) in a rigorous, zero-leakage backtest—all wrapped in a vibrant, minimalist, zero-friction UI.

## 🧠 Why Laplace?

Most forecasting tools are either too simple (ignoring confidence intervals and signal validation) or too complex (requiring 50 lines of Python just to see a trend). Laplace is built differently:

- **Smart Heuristics & Real-World Scenarios:** Drop a CSV or select from our hardcore benchmark suite (S&P 500, VIX, Walmart M5 Demand, National Grid). Laplace auto-detects temporal indices and targets.
- **The Principal Data Analyst Lab (EDA):** We don't just fit a model and hope for the best. The Diagnostics engine decomposes the signal (STL), calculates Autocorrelation (ACF/PACF), flags **Anomalies** (Isolation Forest), identifies **Trend Changepoints** (Ruptures), computes heavy-tailed statistics (Skewness, Kurtosis), and generates a **Forecastability Score** ($R^2$ of Trend+Seasonality over Residuals).
- **Foundation Models vs. The Classics:** Automatically backtest `google/timesfm-1.0-200m`, `amazon/chronos-bolt-base`, `AutoETS`, and `AutoTheta` using a rolling-origin validation engine. PyTorch automatically leverages Apple MPS acceleration if available.
- **Export Studio:** The winning model generates future quantiles (80% Confidence Intervals) ready for the boardroom. Customize your CSV export, include/exclude historical data, and get an instant Python Pandas snippet to reproduce the exact visualization in your Jupyter Notebook.

## 🏗 Architecture

Laplace is built on a modern, decoupled stack prioritizing speed and visual excellence:

### Engine (Backend)
- **FastAPI** — High-performance async API.
- **uv** — Lightning-fast Python package and environment manager.
- **StatsForecast** (`Nixtla`) — Blazing fast C++ implementations of classical baselines.
- **TimesFM & Chronos** (`Google/Amazon`) — Deep learning zero-shot forecasting via PyTorch/HuggingFace.
- **Scikit-Learn & Ruptures** — State-of-the-art anomaly and changepoint detection.

### Interface (Frontend)
- **React 18 + Vite** — Snappy SPA navigation.
- **Tailwind CSS** — Custom *Vibrant Minimalist* design system (High contrast, electric accents).
- **Recharts** — Performant, customized D3-based SVG charts.
- **Lucide** — Clean, modern iconography.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- [uv](https://github.com/astral-sh/uv) installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### Quick Start
To launch the entire platform (Backend + Frontend) cleanly in a single terminal:

```bash
# In the root of the project
./start.sh
```

The script will automatically:
1. Kill any stale background processes (uvicorn/vite)
2. Boot the FastAPI engine
3. Boot the React interface
4. Listen for `Ctrl+C` to gracefully shutdown both

The app will be available at `http://localhost:5173`.

## 🧪 The Workflow

1. **Input:** Select a rigorous benchmark (Economics, Demand, Supply) or upload your own chaotic dataset.
2. **Diagnostics & EDA:** Geek out. Analyze the Structural Changepoints, Isolation Forest Anomalies, and the Forecastability Score to understand the underlying signal mechanics.
3. **Validation:** Laplace splits your data, holds out a horizon, and forces Google and Amazon to compete against classical math. A Leaderboard ranks them by sMAPE.
4. **Forecast & Export Studio:** The winning architecture projects into the true future. Customize your quantiles, copy the Pandas reproducibility snippet, and download the Boardroom-Ready CSV.

## 📜 License
MIT License. Built for forecasting enthusiasts.
