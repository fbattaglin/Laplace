#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Backend tests ==="
cd "$ROOT/backend" && uv run pytest tests/ -v

echo ""
echo "=== Frontend tests ==="
cd "$ROOT/frontend" && npx vitest run

echo ""
echo "All tests passed."
echo ""
echo "To run E2E tests (requires dev servers running):"
echo "  cd frontend && npx playwright test"
