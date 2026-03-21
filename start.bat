@echo off
REM Monopoly Game - Windows Startup Script

echo Starting Monopoly Game...
echo.

cd backend

echo Installing dependencies...
call npm install

echo.
echo Starting server on http://localhost:3000
echo Open your browser and navigate to http://localhost:3000
echo.

call npm start

pause
