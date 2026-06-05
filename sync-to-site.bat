@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0sync-to-site.ps1" %*
