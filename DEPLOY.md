# Deploy MAX Events

Two isolated stacks on work-vps (`2.27.41.96`). HTTPS via host nginx. Each stack has its own Postgres, Redis, backend port, and `.env`.

| Branch    | URL                              | Root                  | Static                    | Port |
| --------- | -------------------------------- | --------------------- | ------------------------- | ---- |
| `dev`     | https://events.versacegus.cc     | `/opt/max-events`     | `/var/www/max-events`     | 3100 |
| `dev-kku` | https://dev.events.versacegus.cc | `/opt/max-events-kku` | `/var/www/max-events-kku` | 3101 |

`events.versacegus.cc` (`dev`): login screen «Войти через MAX». `dev.events.versacegus.cc` (`dev-kku`): no login screen, `VITE_BROWSER_AUTH=1`.

## First-time server setup

Directories, nginx vhosts, Let's Encrypt, and compose `.env` are created on the server (not in git).

Re-create a missing `.env`:

```bash
ssh -i ~/.ssh/work-vps-server root@2.27.41.96
# prod:  /opt/max-events/.env
# kku:   /opt/max-events-kku/.env   (include HOST_PORT=3101)
```

rsync `--exclude .env` never overwrites those files.

MAX AI reads `MODEL_API_KEY`, `MODEL_API_URL`, and `MODEL_API_MODELS` from that same stack `.env`. Leave the key unset to keep the keyword parser. A missing model or a hung request falls through to the next id in `MODEL_API_MODELS`.

## GitHub Actions

`.github/workflows/deploy.yml` runs on push to `dev` or `dev-kku`, and on `workflow_dispatch`.

Secrets (Settings → Secrets and variables → Actions) — names must match exactly:

| Name       | Value                                             |
| ---------- | ------------------------------------------------- |
| `SSH_HOST` | `2.27.41.96`                                      |
| `SSH_USER` | `root`                                            |
| `SSH_KEY`  | private key `~/.ssh/work-vps-server` (not `.pub`) |

## Manual update (prod)

```bash
# from repo root, after bun --filter app-miniapp build
rsync -az --delete --exclude node_modules --exclude .git --exclude .env --exclude dist \
  ./ root@2.27.41.96:/opt/max-events/
rsync -az --delete apps/app-miniapp/dist/ root@2.27.41.96:/var/www/max-events/
ssh -i ~/.ssh/work-vps-server root@2.27.41.96 'bash /opt/max-events/deploy/deploy.sh'
```

## Useful server commands

```bash
ssh -i ~/.ssh/work-vps-server root@2.27.41.96
cd /opt/max-events          # or /opt/max-events-kku
docker compose -p max-events -f docker-compose.prod.yml logs -f backend
docker compose -p max-events -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:3100/api/health/live   # kku: :3101
```

Seed (idempotent, first fill only):

```bash
docker compose -p max-events -f docker-compose.prod.yml exec -T backend bun src/database/seed-cli.ts
# kku: -p max-events-kku from /opt/max-events-kku
```

The seed also creates the organization its catalog is published under, so events show an organizer
instead of «Организатор не указан». It uses `ORGANIZER_LOGIN` from the stack `.env` when set, otherwise
the login `max-events`. It never chooses a password: the account owns content but nobody can log into it
until the credentials below claim it, or `org:password` sets one.

Organizer panel credentials. `ORGANIZER_LOGIN` / `ORGANIZER_PASSWORD` in the stack `.env` bootstrap the
account: the first successful organizer login writes the `organizations` row, or takes over the
password-less one the seed created under the same login. From then on that row is the only source of
truth — changing the env vars does nothing. To rotate the password of an existing organization (the
remediation path after a leak, and the way to give a seeded account its first password):

```bash
read -rs -p 'new password (12+ chars): ' PASS; echo
printf '%s' "$PASS" | docker compose -p max-events -f docker-compose.prod.yml exec -T \
  -e ORGANIZER_ROTATE_LOGIN=organizer-login \
  backend bun src/database/set-organization-password-cli.ts
unset PASS
```

The password goes in on stdin on purpose: `read -rs` keeps it off the screen and out of the shell
history, and piping keeps it out of `ps` — an `-e ORGANIZER_ROTATE_PASSWORD=…` is visible to every user
on the host for as long as the command runs (that variable exists as a scripted fallback only).

The command rehashes with the same scrypt helper as the login path and then **revokes every live
organizer session of that organization** — without that step a Bearer token opened with the leaked
password keeps working for up to 7 days. It prints the login, the row id and the number of revoked
sessions, never the password. It refuses a login that has no row (the account must exist: the panel has
no self-registration) and refuses rotating a password to the one already stored.

## Own basemap

The map screen offers «Своя» — the project's own vector basemap of Moscow and Moscow Oblast, rendered in
the browser by MapLibre from one PMTiles archive. Nothing renders on the server: nginx serves a static
file by Range requests. One copy serves both stacks. Files live outside the miniapp static roots because
the miniapp rsync runs with `--delete`:

| Path on server                             | What                                             | Size    |
| ------------------------------------------ | ------------------------------------------------ | ------- |
| `/var/www/max-events-tiles/moscow.pmtiles` | OpenMapTiles-schema vector tiles, z0–z14         | ~350 MB |
| `/var/www/max-events-tiles/fonts/<face>/`  | Noto Sans Regular / Medium / Italic glyph ranges | 14 MB   |

The vhost block is `location /tiles/` in both `deploy/nginx/events.versacegus.cc` and
`deploy/nginx/dev.events.versacegus.cc` (alias to that directory, `pbf`/`pmtiles` MIME types, day-long
cache, CORS for Range). Vhosts are edited on the server by hand, as everything else under nginx: these
files are the reference copy. «Своя» is the default basemap; without the block, or on a device without WebGL, the map falls back to the standard OSM tiles with a notice.

Rebuild the archive (any machine with Java 21+, ~4 min and 6 GB RAM for this extract; the VPS is not
needed for the build). Bounds are the Moscow Oblast bounding box:

```bash
mkdir tiles-work && cd tiles-work
curl -sLO https://github.com/onthegomap/planetiler/releases/download/v0.10.2/planetiler.jar
curl -sLO https://download.geofabrik.de/russia/central-fed-district-latest.osm.pbf
java -Xmx6g -jar planetiler.jar --download --osm-path=central-fed-district-latest.osm.pbf \
  --bounds=35.14,54.25,40.21,56.96 --output=moscow.pmtiles --force
scp -i ~/.ssh/work-vps-server moscow.pmtiles root@2.27.41.96:/var/www/max-events-tiles/moscow.pmtiles.part
ssh -i ~/.ssh/work-vps-server root@2.27.41.96 'mv /var/www/max-events-tiles/moscow.pmtiles.part /var/www/max-events-tiles/moscow.pmtiles'
```

`--download` fetches Natural Earth, ocean polygons and lake centerlines (~1.1 GB, cached in `data/`).
Upload to `.part` and rename so a browser never reads a half-written archive. Fonts come from
`github.com/protomaps/basemaps-assets` (`fonts/`, OFL licence) — copy the three faces into `fonts/`.
Attribution «© OpenStreetMap · © OpenMapTiles» is printed by the app under the map and is mandatory.

## Checks

- `https://events.versacegus.cc` / `https://dev.events.versacegus.cc` — miniapp static
- `https://dev.events.versacegus.cc/tiles/fonts/Noto%20Sans%20Regular/0-255.pbf` — 200, `application/x-protobuf`; a `Range: bytes=0-16383` request to `/tiles/moscow.pmtiles` — 206
- `.../api/health/live` — `{"status":"ok"}`
- MAX login needs `MAX_BOT_TOKEN` in that stack's `.env` (same value used by `bun tools/dev-initdata.mjs`)
- `dev.events.versacegus.cc` (`dev-kku`): no MAX client. Server `.env` must have `AUTH_ALLOW_BROWSER=true` and `MAX_BOT_TOKEN`. CI builds the miniapp with `VITE_BROWSER_AUTH=1`. Opening the site mints HMAC initData for the owner account. Own MAX user: `bun tools/dev-initdata.mjs --url https://dev.events.versacegus.cc --user '{...}'`. Catalog from seed, not `VITE_USE_MOCK`. Empty catalog: `docker compose … exec -T backend bun src/database/seed-cli.ts`.
- `events.versacegus.cc` (`dev`): no `VITE_BROWSER_AUTH`; browser shows «Войти через MAX». Real MAX clients use Bridge initData and skip the gate. Leave `AUTH_ALLOW_BROWSER` unset on this stack.
