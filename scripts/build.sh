#!/usr/bin/env bash
set -e

echo "=== Building all packages ==="
pnpm turbo build
echo "=== Build complete ==="
