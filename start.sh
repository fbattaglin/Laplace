#!/bin/bash

echo "====================================================="
echo "🧠 Laplace V2 - Unified Startup Sequence"
echo "====================================================="

# 1. Kill stale processes to prevent port conflicts
echo "🧹 [1/3] Cleaning up old background processes..."
pkill -f "uvicorn" || true
pkill -f "vite" || true

# 2. Start Backend
echo "⚙️  [2/3] Booting up Backend (FastAPI + AI Engine)..."
cd backend
# Check if venv exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo "❌ Error: Virtual environment (.venv) not found in backend/. Please run 'uv venv' and install requirements."
    exit 1
fi
uvicorn main:app --reload --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 3. Start Frontend
echo "🎨 [3/3] Booting up Frontend (React + Vite)..."
cd frontend
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!
cd ..

sleep 2 # Give it a second to boot

echo ""
echo "====================================================="
echo "✅ LAPLACE IS LIVE!"
echo "📡 Backend API:   http://127.0.0.1:8000"
echo "🖥  Data Studio:   http://localhost:5173"
echo ""
echo "🛑 Press [Ctrl+C] at any time to shutdown everything."
echo "====================================================="

# Trap Ctrl+C to cleanly kill both background processes when the user exits
trap "echo -e '\n\n🛑 Shutting down Laplace...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

# Keep script running
wait $BACKEND_PID $FRONTEND_PID
