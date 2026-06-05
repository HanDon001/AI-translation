@echo off
chcp 65001 > nul 2>&1
title LiveTranslate

echo ========================================
echo   LiveTranslate - One Click Start
echo ========================================
echo.

echo Killing old processes on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

echo [1/2] Starting Gateway (ws://localhost:3000)...
start "Gateway" /D "%~dp0" pnpm.cmd --filter @realtime-interp/gateway dev

timeout /t 3 /nobreak >nul

echo [2/2] Starting Web (http://localhost:5173)...
start "Web" /D "%~dp0" pnpm.cmd --filter @realtime-interp/web dev

echo.
echo ========================================
echo   Landing:  http://localhost:5173/landing.html
echo   Console:  http://localhost:5173/index.html
echo   Gateway:  ws://localhost:3000/ws
echo ========================================
echo.
echo Press any key to close this window...
pause >nul
