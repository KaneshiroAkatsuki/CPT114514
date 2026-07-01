@echo off
setlocal enabledelayedexpansion

set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
cd /d "%~dp0"

cls
echo ========================================
echo   OMM Daily Report v5.5.2 - Dev Mode
echo ========================================
echo.
echo Starting dev server...
echo First build takes 30-60 seconds.
echo Watch the progress bar below.
echo.
echo Close this window to exit.
echo ========================================
echo.
npm run tauri dev
echo.
echo Dev mode exited.
pause
