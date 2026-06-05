@echo off
chcp 65001 > nul 2>&1
title LiveTranslate

echo ========================================
echo   LiveTranslate - One Click Start
echo ========================================
echo.

echo [1/3] Starting Gateway...
start "Gateway" pnpm.cmd --filter @realtime-interp/gateway dev

timeout /t 3 /nobreak >nul

echo [2/3] Starting Web...
start "Web" pnpm.cmd --filter @realtime-interp/web dev

timeout /t 2 /nobreak >nul

echo [3/3] Starting Desktop Subtitles...
cd packages\desktop-lyrics
start "DesktopSubtitles" python lyrics_win32.py
cd ..\..

echo.
echo ========================================
echo   All services started!
echo   Landing:  http://localhost:5173/landing.html
echo   Console:  http://localhost:5173/index.html
echo   Gateway:  ws://localhost:3000/ws
echo   Desktop:  http://127.0.0.1:8765
echo ========================================
echo.
pause
