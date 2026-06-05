#!/usr/bin/env bash
set -e

echo "=== Linting all packages ==="
pnpm turbo lint
echo "=== Lint complete ==="
