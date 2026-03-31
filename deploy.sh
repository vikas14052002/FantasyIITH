#!/bin/bash
# Deploy to Vercel and notify all clients to refresh
set -e

echo "📦 Building..."
cd frontend && npm run build && cd ..

echo "🚀 Deploying to Vercel..."
npx vercel --prod --yes
npx vercel alias frontend-sigma-ivory-68.vercel.app playxifantasy.vercel.app

echo "🔄 Notifying clients to refresh..."
# Bump the build_version in Supabase — triggers Realtime update to all clients
VERSION=$(date +%s)
curl -s -X PATCH \
  "https://ywqmhwgkctmetzsdburj.supabase.co/rest/v1/app_config?key=eq.build_version" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cW1od2drY3RtZXR6c2RidXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTg5MTIsImV4cCI6MjA5MDM3NDkxMn0.THJI80WqrDVZ-sC9Gtm9_TUvVN-oXENLc1y9hGLnQl8" \
  -H "Content-Type: application/json" \
  -d "{\"value\": \"$VERSION\"}" > /dev/null

echo "✅ Deployed and all clients notified!"
