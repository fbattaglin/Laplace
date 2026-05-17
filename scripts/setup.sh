#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Laplace — First-time Setup ==="
echo ""

echo "1/3  Installing Python dependencies..."
cd "$ROOT/backend" && uv sync

echo ""
echo "2/3  Installing Node dependencies..."
cd "$ROOT/frontend" && npm install

echo ""
echo "3/3  Pre-loading Chronos-2-Small model..."
cd "$ROOT/backend" && uv run python -c "
from laplace.services.forecasting import ChronosSingleton
print('Loading model...')
ChronosSingleton.get_pipeline()
print('Model cached successfully.')
"

echo ""
echo "=== Setup complete ==="
echo "Run 'scripts/dev.sh' to start the app."
