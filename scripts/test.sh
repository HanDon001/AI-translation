#!/usr/bin/env bash
set -e

echo "=== Running all tests ==="
pnpm turbo test
echo "=== Tests complete ==="
