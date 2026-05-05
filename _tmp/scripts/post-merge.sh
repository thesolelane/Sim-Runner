#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "→ Installing dependencies..."
npm install --legacy-peer-deps

echo "=== Post-merge complete ==="
