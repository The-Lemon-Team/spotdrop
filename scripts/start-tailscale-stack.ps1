# SpotDrop & Media Gateway - Tailscale Stack Launcher
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = Split-Path -Parent $PSScriptRoot
$gatewayDir = "C:\Users\Ilege\projects\bandita-gateway"
$gatewayExe = "$gatewayDir\target\release\bandita-gateway.exe"

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host " 🚀 Запуск стека SpotDrop + Media Gateway в Tailscale LAN + Funnel" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# 1. Настройка Tailscale Funnel
Write-Host "`n[1/3] Настройка Tailscale Funnel..." -ForegroundColor Yellow
tailscale funnel --bg --https=443 3005
tailscale funnel --bg --https=8443 3055
Write-Host "  ✓ Tailscale Funnel настроен (443 -> 3005, 8443 -> 3055)" -ForegroundColor Green

# 2. Запуск Media Gateway (Rust) на порту 3055
Write-Host "`n[2/3] Проверка Media Gateway Rust..." -ForegroundColor Yellow
$gatewayRunning = $false
try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:3055/health" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
    if ($res.StatusCode -eq 200) {
        $gatewayRunning = $true
    }
} catch {
    $gatewayRunning = $false
}

if ($gatewayRunning) {
    Write-Host "  ✓ Media Gateway уже запущен на порту 3055" -ForegroundColor Green
}
if (-not $gatewayRunning -and (Test-Path $gatewayExe)) {
    Write-Host "  -> Запуск Media Gateway (Rust)..." -ForegroundColor Cyan
    Start-Process -FilePath $gatewayExe -WorkingDirectory $gatewayDir -WindowStyle Hidden
    Start-Sleep -Seconds 1
    Write-Host "  ✓ Media Gateway запущен в фоновом режиме" -ForegroundColor Green
}
if (-not $gatewayRunning -and (-not (Test-Path $gatewayExe))) {
    Write-Host "  ! Бинарный файл $gatewayExe не найден." -ForegroundColor Red
}

# 3. Запуск SpotDrop Web Player на порту 3005
Write-Host "`n[3/3] Проверка SpotDrop Web Player..." -ForegroundColor Yellow
$spotdropRunning = $false
try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:3005/api/network-info" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
    if ($res.StatusCode -eq 200) {
        $spotdropRunning = $true
    }
} catch {
    $spotdropRunning = $false
}

if ($spotdropRunning) {
    Write-Host "  ✓ SpotDrop Web Player уже запущен на порту 3005" -ForegroundColor Green
}
if (-not $spotdropRunning) {
    Write-Host "  -> Запуск SpotDrop Standalone Server..." -ForegroundColor Cyan
    $webDir = "$rootDir\web"
    $nodeScript = "$webDir\server\standaloneServer.mjs"
    Start-Process -FilePath "node" -ArgumentList $nodeScript -WorkingDirectory $webDir -WindowStyle Hidden
    Start-Sleep -Seconds 1
    Write-Host "  ✓ SpotDrop запущен в фоновом режиме" -ForegroundColor Green
}

# 4. Вывод дашборда статуса
Write-Host ""
& "$PSScriptRoot\tailscale-network.ps1"
