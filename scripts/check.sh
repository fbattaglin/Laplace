#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Python lint (ruff) ==="
cd "$ROOT/backend" && uv run ruff check src/ tests/

echo ""
echo "=== TypeScript type check ==="
cd "$ROOT/frontend" && npx tsc --noEmit

echo ""
echo "All checks passed."
