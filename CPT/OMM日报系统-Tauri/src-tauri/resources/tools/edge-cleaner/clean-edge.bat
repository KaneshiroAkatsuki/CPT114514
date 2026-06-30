@echo off
setlocal
title Edge Deep Cleaner

echo ========================================
echo    Microsoft Edge Deep Cleaner
echo ========================================
echo.

net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo [Info] Administrator rights are required.
    echo [Info] Requesting elevation...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0clean-edge.ps1" %*

echo.
pause
