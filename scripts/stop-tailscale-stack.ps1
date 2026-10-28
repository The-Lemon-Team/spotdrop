# SpotDrop & Media Gateway - Stop Tailscale Stack
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================================" -ForegroundColor Yellow
Write-Host " 🛑 Остановка SpotDrop + Media Gateway и сброс Tailscale Funnel" -ForegroundColor Yellow
Write-Host "========================================================================" -ForegroundColor Yellow

# Останавливаем процесс node, слушающий порт 3005
$spotdropProc = Get-NetTCPConnection -LocalPort 3005 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($spotdropProc) {
    Stop-Process -Id $spotdropProc -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ SpotDrop (PID $spotdropProc) остановлен" -ForegroundColor Green
} else {
    Write-Host "  - SpotDrop не был запущен" -ForegroundColor Gray
}

# Останавливаем bandita-gateway.exe
$gatewayProc = Get-Process -Name "bandita-gateway" -ErrorAction SilentlyContinue
if ($gatewayProc) {
    $gatewayProc | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Media Gateway остановлен" -ForegroundColor Green
} else {
    Write-Host "  - Media Gateway не был запущен" -ForegroundColor Gray
}

# Сброс funnel
Write-Host "`nСброс правил Tailscale Funnel..." -ForegroundColor Cyan
tailscale funnel reset
Write-Host "  ✓ Tailscale Funnel сброшен" -ForegroundColor Green
