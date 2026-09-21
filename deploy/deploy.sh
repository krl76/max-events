#!/usr/bin/env bash
# Rebuild and restart the production stack from /opt/max-events.
# Code and miniapp static files are delivered by GitHub Actions (rsync).
# .env on the server is never overwritten.
set -euo pipefail

cd /opt/max-events

echo "==> Backend stack (docker compose)"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Migrations"
docker compose -f docker-compose.prod.yml exec -T backend bun run migration:run

echo "==> Nginx"
nginx -t && systemctl reload nginx

echo "==> Health"
curl -fsS --max-time 10 http://127.0.0.1:3100/api/health/live
echo

echo "==> Containers"
docker compose -f docker-compose.prod.yml ps
