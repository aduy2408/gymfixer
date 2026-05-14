@echo off
echo Building frontend...
cd frontend
call npm run build
cd ..

echo Starting backend and Cloudflare Tunnel...
start cmd /k "cd backend && ..\p1_env\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 5000"

REM Wait a bit for backend to start
timeout /t 5 /nobreak > nul

cloudflared tunnel --config cloudflared-quick.yml --url http://127.0.0.1:5000
