#!/usr/bin/env bash
set -e

echo "=== Cleaning build artifacts ==="
rm -rf packages/*/dist
rm -rf packages/*/build
rm -rf .turbo
rm -rf coverage
echo "=== Clean complete ==="
