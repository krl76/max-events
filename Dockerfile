# syntax=docker/dockerfile:1
# Reproducible images from this source tree.
#   docker compose up --build
# Targets: backend (prod API) | backend-local (migrate+seed) | miniapp (nginx)
# Bases: oven/bun:1.3.14-debian, nginx:1.27-alpine.

FROM oven/bun:1.3.14-debian AS bun-base
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/api-contracts/package.json packages/api-contracts/tsconfig.json packages/api-contracts/tsconfig.build.json packages/api-contracts/
COPY apps/svc-backend/package.json apps/svc-backend/tsconfig.json apps/svc-backend/tsconfig.build.json apps/svc-backend/
COPY apps/app-miniapp/package.json apps/app-miniapp/

# ----- API -----
FROM bun-base AS backend-deps
RUN bun install --frozen-lockfile --filter @max-events/api-contracts --filter svc-backend

FROM backend-deps AS backend-build
COPY packages/api-contracts/src packages/api-contracts/src
COPY apps/svc-backend/src apps/svc-backend/src
RUN bun --filter @max-events/api-contracts build \
  && bun --filter svc-backend build

FROM oven/bun:1.3.14-debian AS backend
WORKDIR /app
ENV NODE_ENV=production

# platform-api2.max.ru is issued by Минцифры. Node uses Mozilla's CA store, so
# NODE_EXTRA_CA_CERTS injects the Gosuslugi PEMs vendored in deploy/certs/.
COPY deploy/certs/russian_trusted_root_ca.crt /usr/local/share/ca-certificates/russian_trusted_root_ca.crt
COPY deploy/certs/russian_trusted_sub_ca.crt /usr/local/share/ca-certificates/russian_trusted_sub_ca.crt
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && update-ca-certificates \
  && { cat /usr/local/share/ca-certificates/russian_trusted_root_ca.crt; printf "\n"; cat /usr/local/share/ca-certificates/russian_trusted_sub_ca.crt; printf "\n"; } > /etc/ssl/certs/russian-trusted-ca-bundle.pem \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/russian-trusted-ca-bundle.pem
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

COPY --from=backend-build /app/package.json /app/bun.lock /app/tsconfig.base.json ./
COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/packages/api-contracts ./packages/api-contracts
COPY --from=backend-build /app/apps/svc-backend ./apps/svc-backend
COPY deploy/docker-start.sh /docker-start.sh

WORKDIR /app/apps/svc-backend
EXPOSE 3100
CMD ["node", "dist/main.js"]

FROM backend AS backend-local
ENV NODE_ENV=development
CMD ["bash", "/docker-start.sh"]

# ----- Mini-app -----
FROM bun-base AS miniapp-deps
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN bun install --frozen-lockfile --filter @max-events/api-contracts --filter app-miniapp

FROM miniapp-deps AS miniapp-build
COPY packages/api-contracts/src packages/api-contracts/src
COPY apps/app-miniapp apps/app-miniapp
ENV VITE_BROWSER_AUTH=1
RUN bun --filter @max-events/api-contracts build \
  && bun --filter app-miniapp build

FROM nginx:1.27-alpine AS miniapp
COPY deploy/nginx/local.conf /etc/nginx/conf.d/default.conf
COPY --from=miniapp-build /app/apps/app-miniapp/dist /usr/share/nginx/html
EXPOSE 80
