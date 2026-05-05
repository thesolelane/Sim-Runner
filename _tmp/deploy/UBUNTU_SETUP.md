# Ubuntu Server Setup — TraydBook

## Requirements
- Ubuntu 22.04 LTS
- A non-root user with sudo access
- Your domain's DNS A record pointing to this server's IP

---

## 1. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should print v20.x
```

## 2. Install PM2, Nginx, Git

```bash
sudo npm install -g pm2
sudo apt-get install -y nginx git
```

## 3. Clone the repo

```bash
sudo mkdir -p /var/www/traydbook
sudo chown $USER:$USER /var/www/traydbook
git clone https://github.com/YOUR_USERNAME/traydbook.git /var/www/traydbook
```

## 4. Set environment variables

```bash
cp /var/www/traydbook/deploy/.env.example /var/www/traydbook/.env
nano /var/www/traydbook/.env   # fill in all values
```

## 5. Build and start

```bash
cd /var/www/traydbook
npm install --legacy-peer-deps
npm run build
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

## 6. Configure Nginx

```bash
sudo cp /var/www/traydbook/deploy/nginx.conf /etc/nginx/sites-available/traydbook
sudo ln -s /etc/nginx/sites-available/traydbook /etc/nginx/sites-enabled/
sudo nginx -t   # test config
sudo systemctl reload nginx
```

Edit `/etc/nginx/sites-available/traydbook` and replace `yourdomain.com` with your actual domain.

## 7. SSL certificate (free via Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will automatically update your Nginx config and renew certs every 90 days.

After this, uncomment the HTTPS server block in `nginx.conf` and enable the HTTP→HTTPS redirect.

## 8. Updating the app

Any time you push changes from Replit:

```bash
bash /var/www/traydbook/deploy/deploy.sh
```

This pulls, rebuilds, and restarts the API — takes about 30 seconds.

---

## Useful commands

```bash
pm2 status                    # see if API is running
pm2 logs traydbook-api        # live API logs
pm2 restart traydbook-api     # restart API only
sudo systemctl status nginx   # nginx status
sudo tail -f /var/log/nginx/error.log
```
