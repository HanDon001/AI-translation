@echo off
chcp 65001 >nul 2>&1
title 实时同传字幕系统

echo ========================================
echo   实时同传字幕系统 - 一键启动
echo ========================================
echo.
echo [1/2] 启动 Gateway (ws://localhost:3000)...
start "Gateway" cmd /c "cd /d %~dp0 && pnpm --filter @realtime-interp/gateway dev"

timeout /t 2 /nobreak >nul

echo [2/2] 启动 Web 前端 (http://localhost:5173)...
start "Web" cmd /c "cd /d %~dp0 && pnpm --filter @realtime-interp/web dev"

echo.
echo ========================================
echo   启动完成！
echo   Gateway: ws://localhost:3000/ws
echo   前端:    http://localhost:5173
echo ========================================
echo.
echo 按任意键关闭此窗口（服务继续运行）
pause >nul
