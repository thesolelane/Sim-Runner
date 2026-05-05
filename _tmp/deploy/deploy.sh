#!/bin/bash
# TraydBook — Ubuntu deployment script
# Run from the server: bash /var/www/traydbook/deploy/deploy.sh

set -e

APP_DIR="/var/www/traydbook"
LOG_DIR="/var/log/traydbook"

echo "=============================="
echo "  TraydBook Deploy"
echo "=============================="

# Create log directory if needed
mkdir -p "$LOG_DIR"

cd "$APP_DIR"

echo "→ Pulling latest code..."
git pull origin main

echo "→ Installing dependencies..."
npm install --legacy-peer-deps --production=false

echo "→ Building frontend..."
npm run build

echo "→ Restarting API server..."
if pm2 list | grep -q "traydbook-api"; then
    pm2 reload ecosystem.config.js --update-env
else
    pm2 start deploy/ecosystem.config.js
    pm2 save
fi

echo ""
echo "✓ Deploy complete."
echo "  API status:  pm2 status"
echo "  API logs:    pm2 logs traydbook-api"
echo "  Nginx logs:  tail -f /var/log/nginx/error.log"
