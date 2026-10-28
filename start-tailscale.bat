@echo off
chcp 65001 > nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-tailscale-stack.ps1"
pause
