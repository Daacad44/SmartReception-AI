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
export VITE_API_URL="${VITE_API_URL:-/api/v1}"
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-https://hlngecipthlecwqozwhe.supabase.co}"
# VITE_SUPABASE_ANON_KEY: set in Vercel env or apps/frontend/.env.local (optional — has code fallback)
npm run build -w @smartreception/frontend

echo "==> Build complete."
