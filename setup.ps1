# 최초 1회 실행: Python venv + npm 설치
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host "=== Trajectory Predictor 설정 ===" -ForegroundColor Cyan

# Python
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    Write-Host "Python이 필요합니다: https://www.python.org/downloads/" -ForegroundColor Red
    exit 1
}

$backend = Join-Path $Root "backend"
$venvPython = Join-Path $backend "venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "[1/3] Python venv 생성..." -ForegroundColor Yellow
    Set-Location $backend
    python -m venv venv
    Set-Location $Root
}

Write-Host "[2/3] Python 패키지 설치..." -ForegroundColor Yellow
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $backend "requirements.txt")

$modelPath = Join-Path $backend "prediction\model.pt"
if (-not (Test-Path $modelPath)) {
    Write-Host "[2.5] LSTM 모델 학습 (최초 1회, 1~2분)..." -ForegroundColor Yellow
    Set-Location $backend
    & $venvPython train.py
    Set-Location $Root
}

# Node
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    Write-Host "Node.js가 필요합니다: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

Write-Host "[3/3] npm install..." -ForegroundColor Yellow
Set-Location (Join-Path $Root "frontend")
npm install
Set-Location $Root

Write-Host ""
Write-Host "설정 완료! 실행: .\start.ps1" -ForegroundColor Green
