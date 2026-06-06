@echo off
chcp 65001 > nul 2>&1
title LiveTranslate Platform

echo ========================================
echo   LiveTranslate Platform - One Click Start
echo ========================================
echo.

echo [1/4] Installing dependencies...
call pnpm install --no-frozen-lockfile
if %errorlevel% neq 0 (
    echo [ERROR] Install failed!
    pause
    exit /b 1
)
echo [OK] Dependencies installed

echo.
echo [2/4] Starting Frontend (port 5173)...
start "Frontend" pnpm.cmd --filter livetranslate-web-console dev
timeout /t 3 /nobreak >nul

echo.
echo [3/4] Starting ASR Service (port 3001)...
start "ASRService" pnpm.cmd --filter @livetranslate/asr-server dev
timeout /t 2 /nobreak >nul

echo.
echo [4/4] Starting Translate Service (port 3002)...
start "TranslateService" pnpm.cmd --filter @livetranslate/translate-server dev

echo.
echo ========================================
echo   All services started!
echo.
echo   Frontend:    http://localhost:5173
echo   Landing:     http://localhost:5173/landing.html
echo   ASR:         ws://localhost:3001/ws/asr
echo   Translate:   http://localhost:3002
echo.
echo   Press any key to stop all services...
echo ========================================
pause >nul

echo.
echo Stopping services...
taskkill /FI "WINDOWTITLE eq Frontend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ASRService*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq TranslateService*" /F >nul 2>&1
echo Done!
pause
