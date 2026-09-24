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

# Стенд без контура MAX (ветка dev-kku) наполняется демо-данными: он существует ради ручной проверки,
# и пустая база делает эту проверку бессмысленной. Генератор детерминированный (fakerRU, seed 42) и
# пропускает то, что уже вставлено, поэтому повторный деплой ничего не дублирует.
if [ "${SEED_DEMO:-}" = "1" ]; then
  echo "==> Demo data"
  # Через bun напрямую, а не `bun run seed:demo`: пакетный скрипт запускает tsx, которого в рантайм-образе
  # нет (миграции живут рядом и работают именно потому, что зовут bun). Bun исполняет TypeScript сам.
  # Сид не обязан быть фатальным: стенд без демо-данных беднее, но рабочий, а упавший деплой — нет.
  docker compose -p "$COMPOSE_PROJECT_NAME" -f docker-compose.prod.yml exec -T \
    -e SEED_DEMO_ALLOW_REMOTE=1 -e SEED_DEMO_SCALE="${SEED_DEMO_SCALE:-normal}" \
    backend bun src/database/seed-demo-cli.ts || echo "!! demo seed failed, stack stays up"
fi

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
