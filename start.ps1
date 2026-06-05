# 백엔드 + 프론트 동시 실행

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot

$backend = Join-Path $Root "backend"

$frontend = Join-Path $Root "frontend"

$venvPython = Join-Path $backend "venv\Scripts\python.exe"

$nodeModules = Join-Path $frontend "node_modules"



function Ensure-Setup {

    if ((Test-Path $venvPython) -and (Test-Path $nodeModules)) {

        return

    }

    Write-Host ""

    Write-Host "처음 실행입니다. setup.ps1 을 자동 실행합니다 (5~15분, PyTorch 다운로드 포함)..." -ForegroundColor Yellow

    Write-Host ""

    & (Join-Path $Root "setup.ps1")

    if (-not (Test-Path $venvPython) -or -not (Test-Path $nodeModules)) {

        Write-Host "설정이 완료되지 않았습니다. 오류 메시지를 확인한 뒤 다시 setup.ps1 을 실행하세요." -ForegroundColor Red

        exit 1

    }

}



Ensure-Setup



Write-Host "백엔드 시작 (http://127.0.0.1:8000) ..." -ForegroundColor Cyan

Start-Process powershell -WorkingDirectory $backend -ArgumentList @(

    "-NoExit", "-ExecutionPolicy", "Bypass", "-File", ".\run_server.bat"

) -WindowStyle Normal



Start-Sleep -Seconds 3



Write-Host "프론트 시작 (http://localhost:5173) ..." -ForegroundColor Cyan

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +

    [System.Environment]::GetEnvironmentVariable("Path", "User")

Start-Process powershell -WorkingDirectory $frontend -ArgumentList @(

    "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "npm run dev"

) -WindowStyle Normal



Write-Host ""

Write-Host "=== 실행 안내 ===" -ForegroundColor Green

Write-Host "게임 화면: http://localhost:5173  (반드시 5173 포트)" -ForegroundColor Green

Write-Host "API 확인:  http://127.0.0.1:8000/health" -ForegroundColor Green

Write-Host "1) 브라우저에서 5173 접속  2) [전투 시작]  3) 화면 클릭 후 WASD" -ForegroundColor Cyan

