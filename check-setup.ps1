# Environment check after git clone
$ErrorActionPreference = "Continue"
$Root = $PSScriptRoot
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "=== Trajectory Predictor check ===" -ForegroundColor Cyan
$ok = $true

function Test-ItemOk($label, $cond, $hint) {
    if ($cond) {
        Write-Host "[OK] $label" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $label" -ForegroundColor Red
        if ($hint) { Write-Host "       $hint" -ForegroundColor Yellow }
        $script:ok = $false
    }
}

$py = Get-Command python -ErrorAction SilentlyContinue
Test-ItemOk "Python" ($null -ne $py) "Install Python 3.10+ and add to PATH"
if ($py) { Write-Host "       $(python --version 2>&1)" -ForegroundColor Gray }

$npm = Get-Command npm -ErrorAction SilentlyContinue
Test-ItemOk "Node/npm" ($null -ne $npm) "Install Node.js LTS, restart terminal"
if ($npm) { Write-Host "       node $(node --version 2>&1)" -ForegroundColor Gray }

$venv = Join-Path $Root "backend\venv\Scripts\python.exe"
Test-ItemOk "backend venv" (Test-Path $venv) "Run setup.bat in project folder"

$nm = Join-Path $Root "frontend\node_modules"
Test-ItemOk "frontend node_modules" (Test-Path $nm) "Run setup.bat"

$model = Join-Path $Root "backend\prediction\model.pt"
Test-ItemOk "model.pt" (Test-Path $model) "setup.ps1 runs train.py if missing"

if (Test-Path $venv) {
    & $venv -c "import fastapi, torch, uvicorn" 2>$null
    Test-ItemOk "pip packages" ($LASTEXITCODE -eq 0) "Re-run setup.ps1"
}

try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 2
    $h = $r.Content | ConvertFrom-Json
    Write-Host "[OK] backend running version=$($h.version)" -ForegroundColor Green
} catch {
    Write-Host "[--] backend not running (run start.bat)" -ForegroundColor Gray
}

try {
    Invoke-WebRequest -Uri "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 2 | Out-Null
    Write-Host "[OK] frontend http://localhost:5173" -ForegroundColor Green
} catch {
    Write-Host "[--] frontend not running - open http://localhost:5173 after start.bat" -ForegroundColor Gray
}

Write-Host ""
if (-not $ok) {
    Write-Host "Fix: run install-and-run.bat or setup.bat" -ForegroundColor Yellow
} else {
    Write-Host "Ready. Run start.bat then open http://localhost:5173" -ForegroundColor Green
}
