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

echo "==> Keep uploaded photos"
seed_dir="/var/lib/${COMPOSE_PROJECT_NAME}/uploads-seed"
mkdir -p "$seed_dir"
old_backend="$(docker compose -p "$COMPOSE_PROJECT_NAME" -f docker-compose.prod.yml ps -q backend || true)"
if [ -n "$old_backend" ]; then
  docker cp "$old_backend:/data/uploads/." "$seed_dir/" 2>/dev/null || \
    docker cp "$old_backend:/app/apps/svc-backend/var/uploads/." "$seed_dir/" 2>/dev/null || true
fi

echo "==> Backend stack ($COMPOSE_PROJECT_NAME on 127.0.0.1:$HOST_PORT)"
docker compose -p "$COMPOSE_PROJECT_NAME" -f docker-compose.prod.yml up -d --build

new_backend="$(docker compose -p "$COMPOSE_PROJECT_NAME" -f docker-compose.prod.yml ps -q backend || true)"
if [ -n "$new_backend" ] && [ -d "$seed_dir" ]; then
  docker cp "$seed_dir/." "$new_backend:/data/uploads/" 2>/dev/null || true
fi

echo "==> Migrations"
docker compose -p "$COMPOSE_PROJECT_NAME" -f docker-compose.prod.yml exec -T backend bun run migration:run

# Стенд без контура MAX (ветка dev-events) наполняется демо-данными: он существует ради ручной проверки,
# и пустая база делает эту проверку бессмысленной. Генератор детерминированный (fakerRU, seed 42) и
# пропускает то, что уже вставлено, поэтому повторный деплой ничего не дублирует.
if [ "${SEED_DEMO:-}" = "1" ]; then
  echo "==> Demo data"
  # Через bun напрямую, а не `bun run seed:demo`: пакетный скрипт запускает tsx, которого в рантайм-образе
  # нет (миграции живут рядом и работают именно потому, что зовут bun). Bun исполняет TypeScript сам.
  # Сид не обязан быть фатальным: стенд без демо-данных беднее, но рабочий, а упавший деплой — нет.
  docker compose -p "$COMPOSE_PROJECT_NAME" -f docker-compose.prod.yml exec -T \
    -e SEED_DEMO_ALLOW_REMOTE=1 -e SEED_DEMO_SCALE="${SEED_DEMO_SCALE:-normal}" -e SEED_DEMO_RESET="${SEED_DEMO_RESET:-}" -e SEED_DEMO_PERSONAL="${SEED_DEMO_PERSONAL:-}" \
    backend bun src/database/seed-demo-cli.ts || echo "!! demo seed failed, stack stays up"
fi

echo "==> Nginx"
# MAX sends X-Max-Bot-Api-Secret. Default nginx drops header names with underscores,
# so the webhook looks unsigned and answers 404. conf.d is in http{} on Debian.
printf '%s\n' 'underscores_in_headers on;' > /etc/nginx/conf.d/max-events-underscores.conf
# Live vhosts keep certbot TLS, so they are not overwritten. Missing hashed
# chunks must 404: try_files /index.html turns a deleted Vite file into HTML
# and every lazy screen shows «Не удалось открыть экран».
snippet="/etc/nginx/snippets/max-events-assets.conf"
install -D -m 644 "$DEPLOY_ROOT/deploy/nginx/assets.conf" "$snippet"
for conf in /etc/nginx/sites-enabled/events.versacegus.cc /etc/nginx/sites-enabled/dev.events.versacegus.cc; do
  [ -f "$conf" ] || continue
  grep -q "location /assets/" "$conf" && continue
  grep -q "max-events-assets.conf" "$conf" && continue
  awk -v inc="    include ${snippet};" '
    !done && $0 ~ /location \/ \{/ { print inc; done=1 }
    { print }
  ' "$conf" > "${conf}.tmp" && mv "${conf}.tmp" "$conf"
done
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
