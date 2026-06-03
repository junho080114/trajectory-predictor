# GitHub에 저장소 생성 후 푸시 (최초 1회 gh 로그인 필요)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$env:Path = "C:\Program Files\Git\bin;C:\Program Files\GitHub CLI;" + $env:Path

Set-Location $Root

if (-not (Test-Path ".git")) {
    Write-Host "Git 저장소가 없습니다. 먼저 git init 후 commit 하세요." -ForegroundColor Red
    exit 1
}

Write-Host "GitHub 로그인 상태 확인..." -ForegroundColor Cyan
gh auth status 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "GitHub 로그인이 필요합니다. 아래 명령을 실행하세요:" -ForegroundColor Yellow
    Write-Host "  gh auth login" -ForegroundColor White
    Write-Host "  (GitHub.com -> HTTPS -> 브라우저 로그인)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "로그인 후 이 스크립트를 다시 실행하세요." -ForegroundColor Yellow
    exit 1
}

$repoName = "trajectory-predictor"
Write-Host "저장소 생성 및 푸시: $repoName" -ForegroundColor Cyan
gh repo create $repoName --public --source=. --remote=origin --push

if ($LASTEXITCODE -eq 0) {
    $url = gh repo view --json url -q ".url"
    Write-Host ""
    Write-Host "완료! 저장소 URL:" -ForegroundColor Green
    Write-Host $url
} else {
    Write-Host "실패. 이미 같은 이름의 저장소가 있으면:" -ForegroundColor Yellow
    Write-Host "  git remote add origin https://github.com/YOUR_USERNAME/trajectory-predictor.git"
    Write-Host "  git push -u origin main"
}
