# SpotDrop - Production Launcher (PowerShell)
$Host.UI.RawUI.WindowTitle = "SpotDrop - Production Server"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path "$ScriptDir\web"

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host " 🎵 SpotDrop - Запуск Production Web Сервера" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

if (-not (Test-Path "dist\index.html")) {
    Write-Host "[1/2] Production сборка не найдена. Собираем проект..." -ForegroundColor Yellow
    npm run build
} else {
    Write-Host "[1/2] Production сборка найдена в web/dist." -ForegroundColor Green
}

Write-Host "[2/2] Запуск сервера..." -ForegroundColor Green
node server/standaloneServer.mjs
