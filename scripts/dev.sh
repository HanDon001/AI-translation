#!/usr/bin/env bash
set -e

echo "=== 启动核心服务 ==="
echo "  Gateway → ws://localhost:3000/ws"
echo "  Web     → http://localhost:5173"
echo ""

# 启动核心服务（gateway + web）
pnpm --filter @realtime-interp/gateway dev &
pnpm --filter @realtime-interp/web dev &

# 等待任意进程退出后清理
trap 'kill 0' EXIT
wait -n
