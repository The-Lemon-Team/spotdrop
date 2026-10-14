@echo off
chcp 65001 > nul
echo ========================================================================
echo  🎵 Bandita Player - Запуск Production Web Сервера (Tailscale)
echo ========================================================================

cd /d "%~dp0web"

if not exist "dist\index.html" (
    echo [1/2] Production сборка не найдена. Собираем проект...
    call npm run build
) else (
    echo [1/2] Frontend уже собран в web\dist.
)

echo [2/2] Запуск автономного веб-сервера...
node server/standaloneServer.mjs

pause
