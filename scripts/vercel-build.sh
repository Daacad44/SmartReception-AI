#!/usr/bin/env bash
set -euo pipefail

# Run from repository root
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Building shared package..."
npm run build -w @smartreception/shared

echo "==> Generating Prisma client..."
npm run db:generate -w @smartreception/backend

echo "==> Building backend..."
npm run build -w @smartreception/backend

echo "==> Building frontend..."
VITE_API_URL=/api/v1 npm run build -w @smartreception/frontend

echo "==> Build complete."
