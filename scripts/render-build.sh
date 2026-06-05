#!/usr/bin/env bash
set -euo pipefail

echo "=== Render build: trajectory-predictor ==="

pip install --upgrade pip
pip install -r backend/requirements-render.txt

echo "=== Frontend build ==="
cd frontend
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
# Same-origin API/WS on Render (backend serves dist/)
npm run build
cd ..

echo "=== Build done ==="
