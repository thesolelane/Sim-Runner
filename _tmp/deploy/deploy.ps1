# TraydBook — Windows Server deployment script
# Run from PowerShell as Administrator:
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# .\deploy\deploy.ps1

$APP_DIR = "C:\www\traydbook"
$LOG_DIR = "C:\logs\traydbook"

Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  TraydBook Deploy (Windows)"  -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

# Create log directory if needed
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR | Out-Null
}

Set-Location $APP_DIR

Write-Host "-> Pulling latest code..." -ForegroundColor Yellow
git pull origin main

Write-Host "-> Installing dependencies..." -ForegroundColor Yellow
npm install --legacy-peer-deps --production=false

Write-Host "-> Building frontend..." -ForegroundColor Yellow
npm run build

Write-Host "-> Restarting API server..." -ForegroundColor Yellow
$running = pm2 list | Select-String "traydbook-api"
if ($running) {
    pm2 reload deploy/ecosystem.config.js --update-env
} else {
    pm2 start deploy/ecosystem.config.js
    pm2 save
}

Write-Host ""
Write-Host "Deploy complete." -ForegroundColor Green
Write-Host "  API status : pm2 status"
Write-Host "  API logs   : pm2 logs traydbook-api"
Write-Host "  Nginx logs : Get-Content C:\nginx\logs\error.log -Tail 50"
