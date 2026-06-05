#!/bin/bash

echo "========================================"
echo "  LiveTranslate Platform - One Click Start"
echo "========================================"
echo ""

echo "[1/4] Building project..."
mvn clean package -DskipTests -q
if [ $? -ne 0 ]; then
    echo "[ERROR] Build failed!"
    exit 1
fi
echo "[OK] Build successful"

echo ""
echo "[2/4] Starting Nacos (config center)..."
docker-compose -f docker/docker-compose.yml up -d nacos
sleep 5

echo ""
echo "[3/4] Starting Gateway (port 3000)..."
java -jar gateway/gateway-service/target/gateway-service.jar --spring.profiles.active=dev &
GATEWAY_PID=$!
sleep 3

echo ""
echo "[4/4] Starting ASR Service..."
java -jar services/asr-service/asr-server/target/asr-server.jar --spring.profiles.active=dev &
ASR_PID=$!
sleep 2

echo ""
echo "========================================"
echo "  All services started!"
echo ""
echo "  Gateway:     http://localhost:3000"
echo "  Nacos:       http://localhost:8848"
echo "  ASR Service: ws://localhost:3000/ws/asr"
echo ""
echo "  Press Ctrl+C to stop all services..."
echo "========================================"

# 等待用户中断
trap "echo ''; echo 'Stopping services...'; kill $GATEWAY_PID $ASR_PID 2>/dev/null; docker-compose -f docker/docker-compose.yml down; echo 'Done!'; exit 0" INT
wait
