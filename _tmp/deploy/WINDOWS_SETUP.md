# Windows Server Setup — TraydBook

## Requirements
- Windows Server 2019 or 2022 (or Windows 10/11 for local beta)
- PowerShell 5+ (built in)
- Administrator access
- Your domain's DNS A record pointing to this server's IP

---

## 1. Install Node.js 20

Download and run the installer from https://nodejs.org (choose the LTS version).

Verify in PowerShell:
```powershell
node -v    # v20.x
npm -v
```

## 2. Install Git

Download from https://git-scm.com/download/win and install with defaults.

## 3. Install PM2 globally

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
```

Set PM2 to auto-start on reboot:
```powershell
pm2-startup install
```

## 4. Install Nginx for Windows

Download the stable Windows build from https://nginx.org/en/download.html.
Extract to `C:\nginx`.

## 5. Clone the repo

```powershell
mkdir C:\www
cd C:\www
git clone https://github.com/YOUR_USERNAME/traydbook.git traydbook
```

## 6. Set environment variables

```powershell
copy C:\www\traydbook\deploy\.env.example C:\www\traydbook\.env
notepad C:\www\traydbook\.env
```

Fill in all values (Supabase keys, Stripe keys, APP_ORIGIN, etc.).

## 7. Build and start the API

```powershell
cd C:\www\traydbook
npm install --legacy-peer-deps
npm run build
pm2 start deploy/ecosystem.config.js
pm2 save
```

Verify it's running:
```powershell
pm2 status
```

## 8. Configure Nginx

Copy the Windows Nginx config:
```powershell
copy C:\www\traydbook\deploy\nginx-windows.conf C:\nginx\conf\nginx.conf
```

Edit `C:\nginx\conf\nginx.conf` — replace `yourdomain.com` with your actual domain or IP.

Start Nginx:
```powershell
cd C:\nginx
Start-Process nginx.exe
```

Test the config:
```powershell
nginx -t
```

To run Nginx as a Windows service (auto-starts on reboot), use NSSM:
```powershell
# Download NSSM from https://nssm.cc/download
nssm install nginx C:\nginx\nginx.exe
nssm start nginx
```

## 9. SSL certificate (Windows)

For a local beta server (no public domain), you can skip SSL and use HTTP.

For production with a public domain, use **Win-ACME** (free Let's Encrypt client for Windows):
- Download from https://www.win-acme.com
- Run `wacs.exe` and follow the prompts for your domain
- It will place cert files you can reference in the HTTPS block of `nginx-windows.conf`

## 10. Firewall — open ports

```powershell
# Allow HTTP and HTTPS through Windows Firewall
netsh advfirewall firewall add rule name="HTTP" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="HTTPS" dir=in action=allow protocol=TCP localport=443
```

---

## Updating the app

Any time you push changes from Replit, run on your Windows server:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\deploy\deploy.ps1
```

---

## Useful commands

```powershell
pm2 status                          # API running?
pm2 logs traydbook-api              # live API logs
pm2 restart traydbook-api           # restart API only
nginx -s reload                     # reload nginx config
Get-Content C:\nginx\logs\error.log -Tail 50   # nginx errors
```
