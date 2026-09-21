#!/usr/bin/env bash
# Rebuild and restart a stack from DEPLOY_ROOT.
# Code and miniapp static files are delivered by GitHub Actions (rsync).
# .env on the server is never overwritten.
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/max-events}"
HOST_PORT="${HOST_PORT:-3100}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-max-events}"

cd "$DEPLOY_ROOT"
export HOST_PORT COMPOSE_PROJECT_NAME

echo "==> Backend stack ($COMPOSE_PROJECT_NAME on 127.0.0.1:$HOST_PORT)"
docker compose -p "$COMPOSE_PROJECT_NAME" -f docker-compose.prod.yml up -d --build

echo "==> Migrations"
docker compose -p "$COMPOSE_PROJECT_NAME" -f docker-compose.prod.yml exec -T backend bun run migration:run

echo "==> Nginx"
nginx -t && systemctl reload nginx

echo "==> Health"
ok=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${HOST_PORT}/api/health/live"; then
    echo
    ok=1
    break
  fi
  echo "waiting for backend ($((i * 2))s)"
  sleep 2
done
if [ "$ok" -ne 1 ]; then
  echo "health check failed"
  docker compose -p "$COMPOSE_PROJECT_NAME" -f docker-compose.prod.yml logs --tail=40 backend || true
  exit 1
fi

echo "==> Containers"
docker compose -p "$COMPOSE_PROJECT_NAME" -f docker-compose.prod.yml ps
