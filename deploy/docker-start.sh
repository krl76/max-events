#!/usr/bin/env bash
# Local all-in-one entry: migrate, seed the starter catalog, then serve the API.
set -euo pipefail
cd /app/apps/svc-backend
bun --bun typeorm migration:run -d src/database/data-source.ts
bun src/database/seed-cli.ts
exec node dist/main.js
