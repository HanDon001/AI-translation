@echo off
chcp 65001 > nul 2>&1
title LiveTranslate Platform

echo ========================================
echo   LiveTranslate Platform - One Click Start
echo ========================================
echo.

echo [1/4] Building project...
call mvn clean package -DskipTests -q
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
echo [OK] Build successful

echo.
echo [2/4] Starting Nacos (config center)...
docker-compose -f docker/docker-compose.yml up -d nacos
timeout /t 5 /nobreak >nul

echo.
echo [3/4] Starting Gateway (port 3000)...
start "Gateway" java -jar gateway/gateway-service/target/gateway-service.jar --spring.profiles.active=dev
timeout /t 3 /nobreak >nul

echo.
echo [4/4] Starting ASR Service...
start "ASR-Service" java -jar services/asr-service/asr-server/target/asr-server.jar --spring.profiles.active=dev
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   All services started!
echo.
echo   Gateway:     http://localhost:3000
echo   Nacos:       http://localhost:8848
echo   ASR Service: ws://localhost:3000/ws/asr
echo.
echo   Press any key to stop all services...
echo ========================================
pause >nul

echo.
echo Stopping services...
taskkill /FI "WINDOWTITLE eq Gateway*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ASR-Service*" /F >nul 2>&1
docker-compose -f docker/docker-compose.yml down
echo Done!
pause
