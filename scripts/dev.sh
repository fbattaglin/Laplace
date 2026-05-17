#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

cleanup() {
  echo "Shutting down..."
  kill 0
}
trap cleanup EXIT

echo "Starting backend (uvicorn) on :8000..."
cd "$ROOT/backend" && uv run uvicorn laplace.main:app --reload --host 0.0.0.0 --port 8000 &

echo "Starting frontend (vite) on :5173..."
cd "$ROOT/frontend" && npm run dev &

wait
