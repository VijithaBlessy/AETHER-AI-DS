@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm are required. Install the current Node.js LTS release, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing website dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Dependency installation failed. Check your network connection and try again.
    pause
    exit /b 1
  )
)

echo Starting the department website at http://localhost:5173
call npm run dev -- --host 127.0.0.1 --open
pause
