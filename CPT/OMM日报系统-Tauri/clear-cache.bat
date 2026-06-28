@echo off
setlocal enabledelayedexpansion

set "CACHE_DIR=%~dp0node_modules\.vite"

if exist "%CACHE_DIR%" (
  rmdir /s /q "%CACHE_DIR%"
  if exist "%CACHE_DIR%" (
    echo [FAIL] Failed to clear Vite cache - file in use?
  ) else (
    echo [OK] Vite cache cleared
  )
) else (
  echo [OK] No Vite cache found, nothing to clear
)

echo.
pause
