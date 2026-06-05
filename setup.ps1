# 최초 1회 실행: Python venv + npm 설치

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot



# npm/node 가 PATH 에 없을 수 있어 시스템 PATH 갱신

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +

    [System.Environment]::GetEnvironmentVariable("Path", "User")



Write-Host "=== Trajectory Predictor 설정 ===" -ForegroundColor Cyan



# Python

$py = Get-Command python -ErrorAction SilentlyContinue

if (-not $py) {

    Write-Host "Python이 필요합니다. 설치 시 'Add python to PATH' 체크:" -ForegroundColor Red

    Write-Host "https://www.python.org/downloads/" -ForegroundColor Yellow

    exit 1

}



$pyVer = & python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"

Write-Host "Python $pyVer 감지" -ForegroundColor Gray

if ([version]$pyVer -lt [version]"3.10") {

    Write-Host "Python 3.10 이상이 필요합니다." -ForegroundColor Red

    exit 1

}



$backend = Join-Path $Root "backend"

$venvPython = Join-Path $backend "venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {

    Write-Host "[1/3] Python venv 생성..." -ForegroundColor Yellow

    Push-Location $backend

    python -m venv venv

    Pop-Location

}



Write-Host "[2/3] Python 패키지 설치 (PyTorch 포함, 수 분 소요)..." -ForegroundColor Yellow

& $venvPython -m pip install --upgrade pip

& $venvPython -m pip install -r (Join-Path $backend "requirements.txt")

if ($LASTEXITCODE -ne 0) {

    Write-Host "pip 설치 실패. 인터넷 연결 확인 후 다시 setup.ps1 을 실행하세요." -ForegroundColor Red

    exit 1

}



& $venvPython -c "import fastapi, torch, uvicorn; print('백엔드 패키지 OK')"

if ($LASTEXITCODE -ne 0) {

    Write-Host "패키지 import 실패. Python 버전을 3.10~3.12 로 바꿔 보세요." -ForegroundColor Red

    exit 1

}



$modelPath = Join-Path $backend "prediction\model.pt"

if (-not (Test-Path $modelPath)) {

    Write-Host "[2.5] LSTM 모델 학습 (최초 1회, 1~2분)..." -ForegroundColor Yellow

    Push-Location $backend

    & $venvPython train.py

    Pop-Location

}



# Node

$npm = Get-Command npm -ErrorAction SilentlyContinue

if (-not $npm) {

    Write-Host "Node.js가 필요합니다. LTS 설치 후 PowerShell 을 새로 여세요:" -ForegroundColor Red

    Write-Host "https://nodejs.org/" -ForegroundColor Yellow

    exit 1

}



Write-Host "[3/3] npm install..." -ForegroundColor Yellow

Push-Location (Join-Path $Root "frontend")

npm install

if ($LASTEXITCODE -ne 0) {

    Pop-Location

    Write-Host "npm install 실패." -ForegroundColor Red

    exit 1

}

Pop-Location



Write-Host ""

Write-Host "설정 완료! 실행: .\start.bat" -ForegroundColor Green

