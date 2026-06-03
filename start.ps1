# 백엔드 + 프론트 동시 실행
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$backend = Join-Path $Root "backend"
$frontend = Join-Path $Root "frontend"
$venvPython = Join-Path $backend "venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "먼저 setup.ps1 을 실행하세요." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Write-Host "먼저 setup.ps1 을 실행하세요." -ForegroundColor Red
    exit 1
}

Write-Host "백엔드 시작 (http://127.0.0.1:8000) ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$backend'; .\run_server.bat"
) -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "프론트 시작 (http://localhost:5173) ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$frontend'; npm run dev"
) -WindowStyle Normal

Write-Host ""
Write-Host "브라우저: http://localhost:5173" -ForegroundColor Green
Write-Host "헬스체크: http://127.0.0.1:8000/health" -ForegroundColor Green
