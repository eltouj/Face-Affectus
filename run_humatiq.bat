@echo off
TITLE HumatiQ - Full Stack Runner
echo ==========================================
echo    HumatiQ: Starting Backend ^& Frontend
echo ==========================================

:: Start Backend
echo [1/2] Launching FastApi (uvicorn) with VENV...
start "HumatiQ Backend" cmd /k "cd .env\Scripts && call activate.bat && cd ../.. && uvicorn main:app --reload"

:: Start Frontend
echo [2/2] Launching Vite Frontend...
cd frontend
start "HumatiQ Frontend" cmd /k "npm run dev"

echo.
echo ==========================================
echo HumatiQ is now running in 2 separate terminals.
echo - Backend: http://127.0.0.1:8000
echo - Frontend: http://localhost:5173
echo ==========================================
pause
