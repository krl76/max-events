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
ok=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:3100/api/health/live; then
    echo
    ok=1
    break
  fi
  echo "waiting for backend ($((i * 2))s)"
  sleep 2
done
if [ "$ok" -ne 1 ]; then
  echo "health check failed"
  docker compose -f docker-compose.prod.yml logs --tail=40 backend || true
  exit 1
fi

echo "==> Containers"
docker compose -f docker-compose.prod.yml ps
