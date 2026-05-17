#!/usr/bin/env bash
# Laplace — unified dev launcher

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

# ── Colors ─────────────────────────────────────────────────────────────────────
RESET="\033[0m"
BOLD="\033[1m"
DIM="\033[2m"
BLUE="\033[38;5;75m"
TEAL="\033[38;5;80m"
GREEN="\033[38;5;82m"
YELLOW="\033[38;5;220m"
RED="\033[38;5;196m"
GRAY="\033[38;5;245m"

# ── Helpers ────────────────────────────────────────────────────────────────────
clear_line() { printf "\r\033[K"; }
stamp()      { printf "${GRAY}[%s]${RESET}" "$(date +%H:%M:%S)"; }
info()       { echo -e "$(stamp) ${BOLD}${BLUE}$*${RESET}"; }
ok()         { echo -e "$(stamp) ${GREEN}✓${RESET}  $*"; }
warn()       { echo -e "$(stamp) ${YELLOW}⚠${RESET}  $*"; }
err()        { echo -e "$(stamp) ${RED}✗${RESET}  $*"; }
section()    { echo -e "\n${BOLD}${TEAL}$*${RESET}"; }
divider()    { echo -e "${GRAY}$(printf '─%.0s' {1..60})${RESET}"; }

BACKEND_LOG="$ROOT/.laplace_backend.log"
FRONTEND_LOG="$ROOT/.laplace_frontend.log"
BACKEND_PID=""
FRONTEND_PID=""

# ── Cleanup ────────────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  divider
  info "Shutting down Laplace..."
  [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null && ok "Backend stopped"
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null && ok "Frontend stopped"
  rm -f "$BACKEND_LOG" "$FRONTEND_LOG"
  divider
  echo -e "${DIM}  See you next time.${RESET}\n"
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# ── Banner ─────────────────────────────────────────────────────────────────────
clear
echo ""
echo -e "${BOLD}${BLUE}  ██╗      █████╗ ██████╗ ██╗      █████╗  ██████╗███████╗${RESET}"
echo -e "${BOLD}${BLUE}  ██║     ██╔══██╗██╔══██╗██║     ██╔══██╗██╔════╝██╔════╝${RESET}"
echo -e "${BOLD}${BLUE}  ██║     ███████║██████╔╝██║     ███████║██║     █████╗  ${RESET}"
echo -e "${BOLD}${TEAL}  ██║     ██╔══██║██╔═══╝ ██║     ██╔══██║██║     ██╔══╝  ${RESET}"
echo -e "${BOLD}${TEAL}  ███████╗██║  ██║██║     ███████╗██║  ██║╚██████╗███████╗${RESET}"
echo -e "${BOLD}${TEAL}  ╚══════╝╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝${RESET}"
echo ""
echo -e "${DIM}  Time Series Forecasting — Phase 2${RESET}"
echo -e "${DIM}  5 models · 10 datasets · Enhanced EDA · Report Builder${RESET}"
divider
echo ""

# ── Preflight checks ───────────────────────────────────────────────────────────
section "  Checking dependencies"

check_cmd() {
  if command -v "$1" &>/dev/null; then
    ok "$1 found"
  else
    err "$1 not found — run: $2"
    exit 1
  fi
}

check_cmd uv  "curl -LsSf https://astral.sh/uv/install.sh | sh"
check_cmd npm "https://nodejs.org"
echo ""

# ── Backend ────────────────────────────────────────────────────────────────────
section "  Starting Backend  (FastAPI · :8000)"

cd "$ROOT/backend"

# Quick dependency sync (silent unless something changes)
uv sync --quiet 2>/dev/null || true

uv run uvicorn laplace.main:app \
  --host 0.0.0.0 --port 8000 \
  --log-level warning \
  > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready (max 15s)
printf "  Waiting for backend"
for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/api/health >/dev/null 2>&1; then
    clear_line
    ok "Backend ready at ${BOLD}http://localhost:8000${RESET}"
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    clear_line
    err "Backend crashed. Logs:"
    cat "$BACKEND_LOG" | tail -15 | sed 's/^/    /'
    exit 1
  fi
  printf "."
  sleep 0.5
done
echo ""

# ── Frontend ───────────────────────────────────────────────────────────────────
section "  Starting Frontend  (Vite · :5173)"

cd "$ROOT/frontend"

# Install node modules if needed (silent)
if [[ ! -d node_modules ]]; then
  info "Installing npm dependencies..."
  npm install --silent
fi

npm run dev -- --host \
  > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

# Wait for Vite to be ready (max 20s)
printf "  Waiting for frontend"
for i in $(seq 1 40); do
  if curl -sf http://localhost:5173 >/dev/null 2>&1; then
    clear_line
    ok "Frontend ready at ${BOLD}http://localhost:5173${RESET}"
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    clear_line
    err "Frontend crashed. Logs:"
    cat "$FRONTEND_LOG" | tail -15 | sed 's/^/    /'
    exit 1
  fi
  printf "."
  sleep 0.5
done
echo ""

# ── Ready ──────────────────────────────────────────────────────────────────────
divider
echo ""
echo -e "  ${BOLD}${GREEN}✓ Laplace is running${RESET}"
echo ""
echo -e "  ${BOLD}App${RESET}      ${BLUE}http://localhost:5173${RESET}"
echo -e "  ${BOLD}API${RESET}      ${BLUE}http://localhost:8000${RESET}"
echo -e "  ${BOLD}API Docs${RESET} ${BLUE}http://localhost:8000/docs${RESET}"
echo ""
echo -e "  ${DIM}Backend log:  ${GRAY}$BACKEND_LOG${RESET}"
echo -e "  ${DIM}Frontend log: ${GRAY}$FRONTEND_LOG${RESET}"
echo ""
echo -e "  ${DIM}Press ${BOLD}Ctrl+C${RESET}${DIM} to stop all services.${RESET}"
echo ""
divider
echo ""

# ── Open browser (macOS) ───────────────────────────────────────────────────────
if command -v open &>/dev/null; then
  sleep 0.5
  open "http://localhost:5173"
fi

# ── Tail logs ──────────────────────────────────────────────────────────────────
# Forward backend warnings/errors to stdout in real time, prefixed
tail -f "$BACKEND_LOG" 2>/dev/null \
  | grep -v "^$" \
  | sed "s/^/$(printf "${GRAY}[backend]${RESET} ")/" &

wait "$BACKEND_PID" "$FRONTEND_PID"
