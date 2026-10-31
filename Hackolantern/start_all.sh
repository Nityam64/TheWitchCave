#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "🎃 Starting Madam Hexley's Dark Store System from $DIR..."

# 1. Start Backend on 0.0.0.0:8000
echo "🚀 Starting FastAPI Backend bound to 0.0.0.0:8000..."
cd "$DIR/backend"
if command -v uvicorn &> /dev/null; then
    UVICORN_CMD="uvicorn"
elif [ -f "$HOME/Library/Python/3.9/bin/uvicorn" ]; then
    UVICORN_CMD="$HOME/Library/Python/3.9/bin/uvicorn"
else
    UVICORN_CMD="python3 -m uvicorn"
fi

$UVICORN_CMD main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# 2. Start Web Dashboard
echo "🌐 Starting Vite Web Dashboard on port 5173..."
cd "$DIR/web-dashboard"
if command -v bun &> /dev/null; then
    bun run dev --host --port 5173 &
elif [ -f "$HOME/.bun/bin/bun" ]; then
    $HOME/.bun/bin/bun run dev --host --port 5173 &
else
    npm run dev -- --host --port 5173 &
fi
WEB_PID=$!

echo "=========================================================="
echo "✨ System running!"
echo "   - Backend API: http://0.0.0.0:8000 (LAN: http://192.168.88.35:8000)"
echo "   - Web Dashboard: http://localhost:5173"
echo "   - Android App: Configured with live IP / Wi-Fi switcher"
echo "=========================================================="

wait $BACKEND_PID $WEB_PID
