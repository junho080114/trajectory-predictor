# 로컬 수정 -> GitHub push -> Render 자동 배포
param(
    [string]$Message = "",
    [switch]$Watch,
    [int]$DebounceSec = 10
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$env:Path = "C:\Program Files\Git\bin;" + $env:Path

$env:GIT_AUTHOR_NAME = "junho080114"
$env:GIT_AUTHOR_EMAIL = "junho080114@users.noreply.github.com"
$env:GIT_COMMITTER_NAME = "junho080114"
$env:GIT_COMMITTER_EMAIL = "junho080114@users.noreply.github.com"

Set-Location $Root

function Get-RelevantChanges {
    $status = git status --porcelain 2>&1
    if (-not $status) { return @() }

    $relevant = @()
    foreach ($line in ($status -split "`n")) {
        if (-not $line.Trim()) { continue }
        $file = $line.Substring(3).Trim('"')
        if ($file -match '(^backend[/\\]venv[/\\]|^frontend[/\\]node_modules[/\\]|^frontend[/\\]dist[/\\]|__pycache__)') {
            continue
        }
        $relevant += $line
    }
    return $relevant
}

function Sync-Once {
    param([string]$CommitMessage)

    if ((Get-RelevantChanges).Count -eq 0) {
        return $false
    }

    if (-not $CommitMessage) {
        $CommitMessage = "sync: 사이트 자동 반영 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 커밋 + push 중..." -ForegroundColor Cyan
    git add -A
    git reset -- backend/venv frontend/node_modules frontend/dist 2>$null
    git commit -m $CommitMessage
    git push origin main

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] GitHub push 완료 — Render 자동 배포 (10~20분)" -ForegroundColor Green
    return $true
}

function Start-WatchMode {
    Write-Host "=== 사이트 자동 동기화 (Watch) ===" -ForegroundColor Cyan
    Write-Host "Cursor에서 저장(Ctrl+S)하면 자동 push -> Render 배포" -ForegroundColor Gray
    Write-Host "대기: 저장 후 ${DebounceSec}초 | 종료: Ctrl+C" -ForegroundColor Yellow
    Write-Host ""

    $dirtySince = $null

    while ($true) {
        Start-Sleep -Seconds 2
        $changes = Get-RelevantChanges
        if ($changes.Count -eq 0) {
            $dirtySince = $null
            continue
        }

        if (-not $dirtySince) {
            $dirtySince = Get-Date
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 변경 감지 — ${DebounceSec}초 후 push..." -ForegroundColor Yellow
            continue
        }

        $elapsed = ((Get-Date) - $dirtySince).TotalSeconds
        if ($elapsed -ge $DebounceSec) {
            Sync-Once | Out-Null
            $dirtySince = $null
        }
    }
}

if ($Watch) {
    Start-WatchMode
} else {
    Write-Host "=== 사이트에 반영 (1회) ===" -ForegroundColor Cyan
    if (Sync-Once -CommitMessage $Message) {
        Write-Host "Render 대시보드: Deploying -> Live 확인" -ForegroundColor Cyan
    } else {
        Write-Host "반영할 변경이 없습니다." -ForegroundColor Gray
    }
}
