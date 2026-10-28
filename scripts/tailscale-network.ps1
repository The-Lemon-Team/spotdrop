# Tailscale & Funnel Status Dashboard
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$sep = "=" * 70

Write-Host ""
Write-Host $sep -ForegroundColor Cyan
Write-Host " Tailscale LAN & Funnel Status Dashboard" -ForegroundColor Cyan
Write-Host $sep -ForegroundColor Cyan
Write-Host ""

$tsIp = "100.82.53.11"
$lanIp = "192.168.1.102"
$funnelHost = "alovingpc.tail0f092f.ts.net"

# 1. Check SpotDrop (Port 3005)
$spotdropActive = $false
try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:3005/api/network-info" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    if ($res.StatusCode -eq 200) {
        $spotdropActive = $true
        $info = $res.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($info.tailscaleIp) { $tsIp = $info.tailscaleIp }
        if ($info.lanIp) { $lanIp = $info.lanIp }
        if ($info.funnelHost) { $funnelHost = $info.funnelHost }
    }
} catch {
    $spotdropActive = $false
}

# 2. Check Media Gateway (Port 3055)
$gatewayActive = $false
try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:3055/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    if ($res.StatusCode -eq 200) { $gatewayActive = $true }
} catch {
    $gatewayActive = $false
}

Write-Host "STATUS OF APPLICATIONS:" -ForegroundColor Yellow
if ($spotdropActive) {
    Write-Host "  [OK] SpotDrop Web Player (Port 3005): RUNNING" -ForegroundColor Green
    Write-Host "       - Public Funnel (HTTPS):  https://$funnelHost" -ForegroundColor White
    Write-Host "       - Tailscale LAN (VPN):    http://${tsIp}:3005" -ForegroundColor White
    Write-Host "       - Local Wi-Fi / Home LAN: http://${lanIp}:3005" -ForegroundColor White
    Write-Host "       - Localhost:              http://localhost:3005" -ForegroundColor White
} else {
    Write-Host "  [--] SpotDrop Web Player (Port 3005): STOPPED" -ForegroundColor Red
}

Write-Host ""
if ($gatewayActive) {
    Write-Host "  [OK] Media Gateway Rust (Port 3055): RUNNING" -ForegroundColor Green
    Write-Host "       - Public Funnel (HTTPS):  https://${funnelHost}:8443" -ForegroundColor White
    Write-Host "       - Tailscale LAN (VPN):    http://${tsIp}:3055" -ForegroundColor White
    Write-Host "       - Local Wi-Fi / Home LAN: http://${lanIp}:3055" -ForegroundColor White
    Write-Host "       - Localhost:              http://localhost:3055" -ForegroundColor White
} else {
    Write-Host "  [--] Media Gateway Rust (Port 3055): STOPPED" -ForegroundColor Red
}

Write-Host ""
Write-Host $sep -ForegroundColor Cyan
Write-Host "TAILSCALE FUNNEL & SERVE STATUS:" -ForegroundColor Yellow
tailscale funnel status
Write-Host $sep -ForegroundColor Cyan
Write-Host ""
