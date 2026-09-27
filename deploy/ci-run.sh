#!/usr/bin/env bash
# Launch deploy.sh in a detached session so a dropped CI SSH connection
# does not kill the build. Writes /tmp/${DEPLOY_SLUG}-deploy.log and
# /tmp/${DEPLOY_SLUG}-deploy.done (exit code).
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/max-events}"
DEPLOY_SLUG="${DEPLOY_SLUG:-max-events}"
HOST_PORT="${HOST_PORT:-3100}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-max-events}"
# Наполнение демо-данными: задаётся конвейером, по умолчанию выключено.
SEED_DEMO="${SEED_DEMO:-}"
SEED_DEMO_SCALE="${SEED_DEMO_SCALE:-}"
SEED_DEMO_RESET="${SEED_DEMO_RESET:-}"

cd "$DEPLOY_ROOT" || exit 1
rm -f "/tmp/${DEPLOY_SLUG}-deploy.done" "/tmp/${DEPLOY_SLUG}-deploy.log"
setsid env \
  DEPLOY_ROOT="$DEPLOY_ROOT" \
  DEPLOY_SLUG="$DEPLOY_SLUG" \
  HOST_PORT="$HOST_PORT" \
  COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" \
  SEED_DEMO="$SEED_DEMO" \
  SEED_DEMO_SCALE="$SEED_DEMO_SCALE" \
  SEED_DEMO_RESET="$SEED_DEMO_RESET" \
  bash -c 'bash "$DEPLOY_ROOT/deploy/deploy.sh" > "/tmp/${DEPLOY_SLUG}-deploy.log" 2>&1; echo $? > "/tmp/${DEPLOY_SLUG}-deploy.done"' \
  < /dev/null > /dev/null 2>&1 &
echo "deploy launched (detached) slug=$DEPLOY_SLUG port=$HOST_PORT"
