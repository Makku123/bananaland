@echo off
REM Monkey Business - Windows startup script
setlocal

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is required but was not found. Install it from https://nodejs.org
    pause
    exit /b 1
)

cd /d "%~dp0backend"

if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo npm install failed.
        pause
        exit /b 1
    )
)

if "%PORT%"=="" set PORT=3000

echo Starting Monkey Business on http://localhost:%PORT%
start "" http://localhost:%PORT%
call npm start

pause
