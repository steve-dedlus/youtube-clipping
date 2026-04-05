#!/usr/bin/env bash
# Start both backend services for the AI Technical Clipper pipeline.
#
# Usage:
#   bash scripts/start-services.sh
#
# Prerequisites:
#   - Python dependencies installed: pip install -r services/ml-processor/requirements.txt
#   - Node dependencies installed: npm install (from repo root)
#   - .env.local file with ANTHROPIC_API_KEY

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load env if present
if [ -f "$ROOT_DIR/.env.local" ]; then
  echo "Loading .env.local..."
  set -a
  source "$ROOT_DIR/.env.local"
  set +a
fi

# Create output directory
mkdir -p "$ROOT_DIR/output"
export OUTPUT_DIR="$ROOT_DIR/output"
export PUBLIC_DIR="$ROOT_DIR/output"

echo "Starting ml-processor on port 8000..."
cd "$ROOT_DIR/services/ml-processor"
python -m src.main &
ML_PID=$!

echo "Starting render-server on port 3001..."
cd "$ROOT_DIR/apps/render-server"
npx tsx src/server.ts &
RENDER_PID=$!

echo ""
echo "=== Services started ==="
echo "  ml-processor:  http://localhost:8000  (PID: $ML_PID)"
echo "  render-server: http://localhost:3001  (PID: $RENDER_PID)"
echo ""
echo "Run the pipeline:"
echo "  cd $ROOT_DIR && npx tsx apps/web/src/cli.ts <youtube-url>"
echo ""
echo "Press Ctrl+C to stop all services."

# Trap Ctrl+C to kill both processes
trap "echo 'Stopping services...'; kill $ML_PID $RENDER_PID 2>/dev/null; exit 0" INT TERM

wait
