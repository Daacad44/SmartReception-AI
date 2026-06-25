#!/usr/bin/env bash
set -euo pipefail

# Run from repository root
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> SmartReception build (sync-webhook-v2)"
npm run build -w @smartreception/shared

echo "==> Generating Prisma client..."
npm run db:generate -w @smartreception/backend

echo "==> Building backend..."
npm run build -w @smartreception/backend

echo "==> Preparing API serverless bundle..."
API_BUNDLE="apps/frontend/api/_bundle"
rm -rf "$API_BUNDLE"
mkdir -p "$API_BUNDLE"
cp -r apps/backend/dist "$API_BUNDLE/dist"
cp -r apps/backend/prisma "$API_BUNDLE/prisma"

echo "==> Building frontend..."
export VITE_API_URL="${VITE_API_URL:-/api/v1}"
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-https://hlngecipthlecwqozwhe.supabase.co}"
# VITE_SUPABASE_ANON_KEY: set in Vercel env or apps/frontend/.env.local (optional — has code fallback)
npm run build -w @smartreception/frontend

echo "==> Build complete."
