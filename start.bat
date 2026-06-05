@echo off
chcp 65001 > nul 2>&1
title LiveTranslate Platform

echo ========================================
echo   LiveTranslate Platform - One Click Start
echo ========================================
echo.

echo [1/5] Building Java project...
call mvn clean package -DskipTests -q
if %errorlevel% neq 0 (
    echo [ERROR] Java build failed!
    pause
    exit /b 1
)
echo [OK] Java build successful

echo.
echo [2/5] Starting Nacos (config center)...
docker-compose -f docker/docker-compose.yml up -d nacos
timeout /t 5 /nobreak >nul

echo.
echo [3/5] Starting Gateway (port 3000)...
start "Gateway" java -jar gateway/gateway-service/target/gateway-service.jar --spring.profiles.active=dev
timeout /t 3 /nobreak >nul

echo.
echo [4/5] Starting Node.js Gateway (port 3001)...
start "NodeGateway" pnpm.cmd --filter @realtime-interp/gateway dev
timeout /t 2 /nobreak >nul

echo.
echo [5/5] Starting Frontend (port 5173)...
start "Frontend" pnpm.cmd --filter @realtime-interp/web dev

echo.
echo ========================================
echo   All services started!
echo.
echo   Frontend:     http://localhost:5173
echo   Landing:      http://localhost:5173/landing.html
echo   Java Gateway: http://localhost:3000
echo   Node Gateway: ws://localhost:3001/ws
echo   Nacos:        http://localhost:8848
echo.
echo   Press any key to stop all services...
echo ========================================
pause >nul

echo.
echo Stopping services...
taskkill /FI "WINDOWTITLE eq Gateway*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq NodeGateway*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend*" /F >nul 2>&1
docker-compose -f docker/docker-compose.yml down
echo Done!
pause
