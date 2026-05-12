# AutoGrowChain System Launcher (PowerShell)
# Usage: Right-click -> Run with PowerShell
#   OR:  .\start.ps1

$Host.UI.RawUI.WindowTitle = "AutoGrowChain Launcher"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "   AutoGrowChain System Launcher" -ForegroundColor Green
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "   Starting all services..." -ForegroundColor Yellow
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""

$jobs = @()

# 0. Local Blockchain Node (Port 8545)
Write-Host "[0/6] Starting Local Blockchain Node & Deploying Contracts..." -ForegroundColor White
$jobs += Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$root\blockchain_contracts`" && npx hardhat node" -WindowStyle Minimized -PassThru
Start-Sleep -Seconds 5
# Deploy contracts to the fresh node
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$root\blockchain_contracts`" && npx hardhat run scripts/deploy.js --network localhost" -WindowStyle Hidden -Wait

# 1. Supply Chain Server (Port 3000)
Write-Host "[1/6] Supply Chain Server (Port 3000)..." -ForegroundColor White
$jobs += Start-Process -FilePath "node" -ArgumentList "$root\blockchain_server\supply_server.js" -WorkingDirectory "$root\blockchain_server" -WindowStyle Minimized -PassThru
Start-Sleep -Seconds 2

# 2. TPL Data Server (Port 3005)
Write-Host "[2/6] TPL Data Server (Port 3005)..." -ForegroundColor White
$jobs += Start-Process -FilePath "node" -ArgumentList "$root\blockchain_server\tpl_server.js" -WorkingDirectory "$root\blockchain_server" -WindowStyle Minimized -PassThru
Start-Sleep -Seconds 2

# 3. Data API Server - SQLite (Port 3010)
Write-Host "[3/6] Data API Server (Port 3010)..." -ForegroundColor White
$jobs += Start-Process -FilePath "node" -ArgumentList "$root\blockchain_server\data_server.js" -WorkingDirectory "$root\blockchain_server" -WindowStyle Minimized -PassThru
Start-Sleep -Seconds 2

# 4. Frontend Dashboard (Port 5173)
Write-Host "[4/6] Frontend Dashboard (Port 5173)..." -ForegroundColor White
$jobs += Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$root\frontend_dashboard`" && npx vite --host" -WindowStyle Minimized -PassThru
Start-Sleep -Seconds 4

# 5. AI Service - YOLOv8 & Market (Port 8000)
Write-Host "[5/6] AI Service (Port 8000)..." -ForegroundColor White
$jobs += Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$root\backend_ai`" && python -m uvicorn main:app --host 0.0.0.0 --port 8000" -WindowStyle Minimized -PassThru
Start-Sleep -Seconds 4

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Green
Write-Host "   All services started!" -ForegroundColor Green
Write-Host "  ================================================" -ForegroundColor Green
Write-Host "   Supply Chain API  : http://localhost:3000" -ForegroundColor White
Write-Host "   TPL Data API      : http://localhost:3005" -ForegroundColor White
Write-Host "   Data API (SQLite) : http://localhost:3010" -ForegroundColor White
Write-Host "   AI Service (YOLO) : http://localhost:8000" -ForegroundColor White
Write-Host "   Dashboard         : http://localhost:5173" -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor Green
Write-Host ""

# Open browser
Start-Process "http://localhost:5173"

Write-Host "  Press ENTER to STOP all services..." -ForegroundColor Red
Read-Host

Write-Host ""
Write-Host "  Stopping all services..." -ForegroundColor Yellow
foreach ($job in $jobs) {
    try {
        Stop-Process -Id $job.Id -Force -ErrorAction SilentlyContinue
    } catch {}
}
# Also kill any remaining node on our ports
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "  All services stopped." -ForegroundColor Green
Start-Sleep -Seconds 2
