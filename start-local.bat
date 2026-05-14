@echo off
echo Starting backend and frontend...

REM Start backend in background
start cmd /k "cd backend && ..\p1_env\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 5000 --reload"

REM Wait a bit for backend to start
timeout /t 5 /nobreak > nul

REM Start frontend
cd frontend
npm run dev
