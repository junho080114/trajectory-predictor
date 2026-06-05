# Local edit -> GitHub push -> Render auto deploy
param(
    [string]$Message = "",
    [switch]$Watch,
    [int]$DebounceSec = 10
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()

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
        $CommitMessage = "sync: auto deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Commit + push..." -ForegroundColor Cyan
    git add -A
    git reset -- backend/venv frontend/node_modules frontend/dist 2>$null
    git commit -m $CommitMessage
    git push origin main

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Done. Render will redeploy in 10-20 min." -ForegroundColor Green
    return $true
}

function Start-WatchMode {
    Write-Host "=== Site Auto Sync (Watch) ===" -ForegroundColor Cyan
    Write-Host "Save files in Cursor (Ctrl+S) -> auto push -> Render deploy" -ForegroundColor Gray
    Write-Host "Wait ${DebounceSec}s after save | Close this window to stop" -ForegroundColor Yellow
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
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Change detected. Push in ${DebounceSec}s..." -ForegroundColor Yellow
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
    Write-Host "=== Sync to site (once) ===" -ForegroundColor Cyan
    if (Sync-Once -CommitMessage $Message) {
        Write-Host "Check Render dashboard: Deploying -> Live" -ForegroundColor Cyan
    } else {
        Write-Host "No changes to sync." -ForegroundColor Gray
    }
}
