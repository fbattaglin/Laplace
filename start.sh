#!/bin/bash

# Set strict shell execution parameters
set -e

# Clear screen and render header
if [ -t 1 ] && command -v clear &>/dev/null; then
    clear
fi
echo -e "\033[1;36m====================================================="
echo -e "🧠 LAPLACE V2 - Intelligent Onboarding Supervisor"
echo -e "=====================================================\033[0m"
echo ""

# Helper to print errors inside structured cards
print_error_card() {
    echo -e "\033[1;31m┌───────────────────────────────────────────────────┐"
    echo -e "│ ❌ ERROR: $1"
    echo -e "└───────────────────────────────────────────────────┘\033[0m"
    echo -e "$2"
    echo ""
}

# ---------------------------------------------------------------------
# Phase 1: Verify Prerequisites
# ---------------------------------------------------------------------
echo -e "\033[1;34m🔍 [1/4] Verifying system prerequisites...\033[0m"

# Verify Python 3
if ! command -v python3 &> /dev/null; then
    print_error_card "Python 3 is not installed or not in PATH." \
        "👉 Please install Python 3.10+ from https://www.python.org or run 'brew install python' on macOS."
    exit 1
fi
echo -e "  ✓ Python 3 detected: \033[32m$(python3 --version | head -n 1)\033[0m"

# Verify Node.js / NPM
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    print_error_card "Node.js or NPM is missing." \
        "👉 Please install Node.js v18+ from https://nodejs.org or run 'brew install node' on macOS."
    exit 1
fi
echo -e "  ✓ Node.js detected:  \033[32m$(node --version)\033[0m"
echo -e "  ✓ NPM detected:      \033[32m$(npm --version)\033[0m"

# Detect UV (10x faster package manager)
HAS_UV=false
if command -v uv &> /dev/null; then
    HAS_UV=true
    echo -e "  ✓ uv detected:       \033[32m$(uv --version | head -n 1)\033[0m"
else
    echo -e "  ⚠️  uv is not installed. Standard pip will be used as a fallback."
    echo -e "     \033[90m💡 Pro Tip: Install uv for 10x faster setup (curl -LsSf https://astral.sh/uv/install.sh | sh)\033[0m"
fi
echo ""

# ---------------------------------------------------------------------
# Phase 2: Stale Process Cleanup & Port Management
# ---------------------------------------------------------------------
echo -e "\033[1;34m🧹 [2/4] Reclaiming ports and cleaning up stale processes...\033[0m"

# Reclaim backend port 8000
if lsof -i :8000 -t &> /dev/null; then
    echo "  - Reclaiming port 8000 (killing active PID $(lsof -i :8000 -t | tr '\n' ' '))"
    lsof -i :8000 -t | xargs kill -9 &> /dev/null || true
fi

# Reclaim frontend port 5173
if lsof -i :5173 -t &> /dev/null; then
    echo "  - Reclaiming port 5173 (killing active PID $(lsof -i :5173 -t | tr '\n' ' '))"
    lsof -i :5173 -t | xargs kill -9 &> /dev/null || true
fi

pkill -f "uvicorn" &> /dev/null || true
pkill -f "vite" &> /dev/null || true
echo -e "  ✓ Environment is clean and ports are reclaimed."
echo ""

# ---------------------------------------------------------------------
# Phase 3: Auto-Bootstrap Environments & Dependencies
# ---------------------------------------------------------------------
echo -e "\033[1;34m📦 [3/4] Checking and bootstrapping environments...\033[0m"

# 3.1 Backend Bootstrapping
cd backend
if [ ! -d ".venv" ]; then
    echo -e "  - \033[1;33mBackend virtual environment (.venv) not found. Creating now...\033[0m"
    if [ "$HAS_UV" = true ]; then
        uv venv &> /dev/null
        echo "  ✓ Virtual environment created successfully via uv."
        echo "  - Installing backend dependencies via uv pip (this may take a moment)..."
        uv pip install -r requirements.txt &> /dev/null
    else
        python3 -m venv .venv &> /dev/null
        echo "  ✓ Virtual environment created successfully via standard python3-venv."
        echo "  - Installing backend dependencies via standard pip (this may take a moment)..."
        .venv/bin/pip install -r requirements.txt &> /dev/null
    fi
    echo -e "  ✓ Backend environment created and packages successfully installed."
else
    echo -e "  ✓ Backend virtual environment (.venv) detected."
fi
cd ..

# 3.2 Frontend Bootstrapping
cd frontend
if [ ! -d "node_modules" ]; then
    echo -e "  - \033[1;33mFrontend dependencies (node_modules) not found. Bootstrapping...\033[0m"
    echo "  - Executing npm install (this may take a moment)..."
    npm install --no-audit --no-fund --loglevel=error &> /dev/null
    echo -e "  ✓ Frontend packages successfully installed."
else
    echo -e "  ✓ Frontend dependencies (node_modules) detected."
fi
cd ..
echo ""

# ---------------------------------------------------------------------
# Phase 4: Launching Laplace Stack with Live Diagnostics
# ---------------------------------------------------------------------
echo -e "\033[1;34m🚀 [4/4] Launching the Laplace platform...\033[0m"

# 4.1 Launch Backend
echo "  - Launching Backend (FastAPI + AI Engine)..."
cd backend
# Activate virtual environment
source .venv/bin/activate
# Start backend in the background and pipe output to log
uvicorn app.main:app --reload --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 4.2 Poll Backend Health Check
echo -e "  - \033[5m⏳ Waiting for Backend API to become healthy...\033[0m"
HEALTH_CHECK_MAX=15
HEALTH_CHECK_COUNT=0
HEALTHY=false

while [ $HEALTH_CHECK_COUNT -lt $HEALTH_CHECK_MAX ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health || true)
    if [ "$HTTP_CODE" = "200" ]; then
        HEALTHY=true
        break
    fi
    sleep 1
    HEALTH_CHECK_COUNT=$((HEALTH_CHECK_COUNT + 1))
done

if [ "$HEALTHY" = false ]; then
    echo ""
    print_error_card "Backend failed to initialize or respond to health check on port 8000." \
        "👉 Here are the last 15 lines of backend/backend.log to diagnose the failure:"
    tail -n 15 backend/backend.log
    echo -e "\033[1;31m🛑 Shutting down spawned services...\033[0m"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo -e "  ✓ Backend API is \033[1;32mHealthy (HTTP 200)\033[0m."

# 4.3 Launch Frontend
echo "  - Launching Frontend (React + Vite)..."
cd frontend
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# 4.4 Poll Frontend Port
sleep 2.5
if ! lsof -i :5173 -t &> /dev/null; then
    echo ""
    print_error_card "Frontend (Vite) failed to bind to port 5173." \
        "👉 Here are the last 15 lines of frontend/frontend.log to diagnose the failure:"
    tail -n 15 frontend/frontend.log
    echo -e "\033[1;31m🛑 Shutting down spawned services...\033[0m"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit 1
fi

echo -e "  ✓ Frontend Dev Server is \033[1;32mActive (port 5173)\033[0m."
echo ""

# ---------------------------------------------------------------------
# Live Banner Presentation
# ---------------------------------------------------------------------
echo -e "\033[1;32m====================================================="
echo -e "🏆 LAPLACE DEMON IS LIVE!"
echo -e "====================================================="
echo -e "📡 Backend API:   \033[4;36mhttp://127.0.0.1:8000\033[0m"
echo -e "🖥  Data Studio:   \033[4;36mhttp://localhost:5173\033[0m"
echo -e "====================================================="
echo -e "\033[90m⚙️  Supervisor log tail active. Logs routed to backend.log & frontend.log.\033[0m"
echo -e "\033[90m🛑 Press [Ctrl+C] at any time to shutdown both platforms cleanly.\033[0m"
echo -e "=====================================================\033[0m"

# Trap Ctrl+C to cleanly kill both background processes when the user exits
cleanup_processes() {
    echo -e "\n\n\033[1;31m🛑 Shutting down Laplace services...\033[0m"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo -e "\033[1;32m✓ Stale processes terminated cleanly. Goodbye, buddy!\033[0m"
    exit 0
}
trap cleanup_processes INT

# Keep supervisor running
wait $BACKEND_PID $FRONTEND_PID
