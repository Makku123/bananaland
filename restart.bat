@echo off
REM Monkey Business - restart the backend: kill the node on port 3000, relaunch start.bat
setlocal
if "%PORT%"=="" set PORT=3000

REM /C: makes each filter a literal string (a bare pattern with a space would
REM be treated as multiple OR'd search terms and match far too much).
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:"LISTENING" ^| findstr /C:":%PORT% "') do (
    echo Stopping process %%p on port %PORT%...
    taskkill /PID %%p /F >nul 2>nul
)

timeout /t 2 /nobreak >nul
start "" "%~dp0start.bat"
