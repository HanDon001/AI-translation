#!/usr/bin/env bash
set -e

echo "=== Starting all services in dev mode ==="

# Start each service in parallel
pnpm --filter @realtime-interp/asr-engine dev &
pnpm --filter @realtime-interp/translator dev &
pnpm --filter @realtime-interp/gateway dev &
pnpm --filter @realtime-interp/web dev &

# Wait for any process to exit
wait -n

# Kill remaining background processes on exit
trap 'kill 0' EXIT
