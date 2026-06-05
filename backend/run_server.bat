@echo off

cd /d "%~dp0"

echo Starting server...

if exist "venv\Scripts\uvicorn.exe" (

    .\venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8000 --reload --reload-dir . --reload-exclude venv

) else if exist "venv\Scripts\python.exe" (

    .\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload --reload-dir . --reload-exclude venv

) else (

    echo venv not found. Run setup.bat from project root first.

    pause

    exit /b 1

)

