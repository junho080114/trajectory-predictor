@echo off

cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -File "%~dp0check-setup.ps1"

pause

