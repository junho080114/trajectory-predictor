@echo off

cd /d "%~dp0"

echo === 설치 + 실행 (처음 받은 PC용) ===

powershell -ExecutionPolicy Bypass -File "%~dp0setup.ps1"

if errorlevel 1 (

    echo Setup failed. See messages above.

    pause

    exit /b 1

)

powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"

pause

