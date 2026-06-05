# Render Blueprint 배포 (브라우저에서 Apply 한 번만 누르면 됨)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$env:Path = "C:\Program Files\Git\bin;" + $env:Path

$repoUrl = "https://github.com/junho080114/trajectory-predictor"
$blueprintUrl = "https://dashboard.render.com/blueprint/new?repo=$repoUrl"
$deployButtonUrl = "https://render.com/deploy?repo=$repoUrl"

Write-Host "=== Render 배포 ===" -ForegroundColor Cyan
Write-Host "저장소: $repoUrl" -ForegroundColor Gray

# GitHub 최신 코드 확인
Set-Location $Root
$hasRenderYaml = Test-Path "render.yaml"
if (-not $hasRenderYaml) {
    Write-Host "render.yaml 이 없습니다." -ForegroundColor Red
    exit 1
}

$local = git rev-parse HEAD 2>$null
$remote = git ls-remote origin refs/heads/main 2>$null
if ($remote -and $local) {
    $remoteHash = ($remote -split "\s+")[0]
    if ($local -ne $remoteHash) {
        Write-Host "로컬과 GitHub가 다릅니다. 먼저 push 하세요: git push origin main" -ForegroundColor Yellow
    } else {
        Write-Host "GitHub main 최신 커밋: $local" -ForegroundColor Green
    }
}

# Render API 키가 있으면 CLI로 배포 트리거 시도
$apiKey = $env:RENDER_API_KEY
if ($apiKey) {
    $cli = Join-Path $env:LOCALAPPDATA "render-cli\extracted\cli_v2.7.0.exe"
    if (Test-Path $cli) {
        $env:RENDER_API_KEY = $apiKey
        Write-Host "Render API 키 감지 — 서비스 목록 확인..." -ForegroundColor Cyan
        & $cli services list -o json 2>&1 | Out-Host
    }
}

Write-Host ""
Write-Host "Render Dashboard 를 엽니다..." -ForegroundColor Yellow
Write-Host "1) GitHub 연결 (처음이면)" -ForegroundColor White
Write-Host "2) Blueprint 이름 확인" -ForegroundColor White
Write-Host "3) [Apply] 클릭 → 배포 시작 (빌드 10~20분)" -ForegroundColor White
Write-Host ""
Write-Host "URL: $blueprintUrl" -ForegroundColor Cyan

Start-Process $blueprintUrl

Write-Host ""
Write-Host "배포 완료 후 접속:" -ForegroundColor Green
Write-Host "  https://trajectory-predictor.onrender.com (서비스 이름에 따라 다름)" -ForegroundColor Green
Write-Host "  /health 로 API 확인" -ForegroundColor Green
