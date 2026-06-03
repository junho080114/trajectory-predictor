@echo off
cd /d "%~dp0"
echo Starting server (venv changes ignored)...
.\venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8000 --reload --reload-dir . --reload-exclude venv
