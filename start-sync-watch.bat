@echo off
cd /d "%~dp0"
echo 사이트 자동 동기화 시작 — 이 창을 닫지 마세요.
echo 파일 저장하면 GitHub push 후 Render가 자동 배포합니다.
powershell -ExecutionPolicy Bypass -File "%~dp0sync-to-site.ps1" -Watch
