#!/bin/bash
# TraydBook — Server Setup Script
# Run once on a fresh Ubuntu 22.04 / Debian server

set -e

echo "==> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "==> Installing PM2..."
sudo npm install -g pm2

echo "==> Installing Nginx..."
sudo apt-get install -y nginx

echo "==> Installing Certbot (Let's Encrypt SSL)..."
sudo apt-get install -y certbot python3-certbot-nginx

echo "==> Cloning TraydBook..."
git clone https://github.com/thesolelane/traydbook.git /var/www/traydbook
cd /var/www/traydbook

echo "==> Installing dependencies..."
npm install

echo ""
echo "==> Next steps:"
echo "  1. Copy your .env file:  cp .env.example .env  (then fill in real values)"
echo "  2. Build the frontend:   npm run build"
echo "  3. Copy Nginx config:    sudo cp deploy/nginx.conf /etc/nginx/sites-available/traydbook"
echo "  4. Enable site:          sudo ln -s /etc/nginx/sites-available/traydbook /etc/nginx/sites-enabled/"
echo "  5. Get SSL cert:         sudo certbot --nginx -d app.traydbook.com"
echo "  6. Start with PM2:       pm2 start ecosystem.config.cjs --env production"
echo "  7. PM2 auto-start:       pm2 startup && pm2 save"
echo ""
echo "App will be live at https://app.traydbook.com"
