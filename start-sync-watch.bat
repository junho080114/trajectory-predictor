@echo off
cd /d "%~dp0"
REM Open a dedicated PowerShell window (close that window to stop sync)
start "Site-Sync-Watch" powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0sync-to-site.ps1" -Watch
echo Started. Use the "Site-Sync-Watch" PowerShell window.
timeout /t 3 >nul
