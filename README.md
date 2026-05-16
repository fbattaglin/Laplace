<div align="center">
  <img src="frontend/public/logo-header.png" alt="Laplace Logo" width="120" />
  <h1>Laplace</h1>
  <p><b>Foundation Model Forecasting for the Boardroom</b></p>
</div>

---

**Laplace** is a desktop-first, full-stack application designed to answer a single question with absolute rigor: *What is the most accurate way to predict the future of this time series?*

Named after [Laplace's Demon](https://en.wikipedia.org/wiki/Laplace%27s_demon), this app bridges the gap between hardcore data science labs and executive boardrooms. It pits zero-shot Foundation Models (**Amazon Chronos**) against battle-tested statistical baselines (**ETS, Theta, Seasonal Naive**) in a rigorous, zero-leakage backtest—all wrapped in a vibrant, minimalist, zero-friction UI.

## 🧠 Why Laplace?

Most forecasting tools are either too simple (ignoring confidence intervals and signal validation) or too complex (requiring 50 lines of Python just to see a trend). Laplace is built differently:

- **Smart Heuristics:** Drop a CSV or Excel file. Laplace automatically detects temporal indices and target variables. No configuration needed.
- **Rigor by Default:** We don't just fit a model and hope for the best. Laplace decomposes the signal (STL), calculates Autocorrelation (ACF/PACF), and generates a **Forecastability Score** ($R^2$ of Trend+Seasonality over Residuals) before a single prediction is made.
- **Foundation Models vs. The Classics:** Automatically backtest `amazon/chronos-bolt-small` alongside `AutoETS` and `AutoTheta` using a rolling-origin validation engine. 
- **Boardroom Ready:** The winning model generates future quantiles (80% Confidence Intervals) that can be exported to a clean CSV in one click.

## 🏗 Architecture

Laplace is built on a modern, decoupled stack prioritizing speed and visual excellence:

### Engine (Backend)
- **FastAPI** — High-performance async API.
- **uv** — Lightning-fast Python package and environment manager.
- **StatsForecast** (`Nixtla`) — Blazing fast C++ implementations of classical baselines.
- **Chronos Forecasting** (`Amazon`) — Deep learning zero-shot forecasting via PyTorch/HuggingFace.

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

### 1. Start the Engine (Backend)
```bash
cd backend

# Create virtual environment and install dependencies
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt # (or install directly via uv pip install fastapi uvicorn statsforecast chronos-forecasting pandas torch)

# Run the API
uvicorn main:app --reload --port 8000
```
> **Note:** The first time you run a validation, the Chronos PyTorch model (~150MB) will be downloaded and cached locally.

### 2. Start the Interface (Frontend)
```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

## 🧪 The Workflow

1. **Input:** Select a reference dataset (like *Air Passengers*) or upload your own.
2. **Diagnostics:** Analyze the STL Decomposition and Forecastability Score to understand the underlying signal mechanics.
3. **Validation:** Laplace splits your data, holds out a horizon, and forces the models to compete. A Leaderboard ranks them by sMAPE.
4. **Forecast:** The winning architecture projects into the true future, generating actionable quantiles ready for CSV export.

## 📜 License
MIT License. Built for forecasting enthusiasts.
