#!/usr/bin/env node
// START_MODULE_CONTRACT
// PURPOSE: Sign MAX initData (HMAC-SHA256, https://dev.max.ru/docs/webapps/validation) for browser contour outside the MAX client.
// SCOPE: CLI; reads MAX_BOT_TOKEN / MAX_DEV_USER from env or flags; optional --url prints a one-shot login link. Never logs the token.
// DEPENDS: node:crypto, node:fs; backend must use the same MAX_BOT_TOKEN
// LINKS: M-APP-MINIAPP, M-SVC-BACKEND
// MAP_MODE: NONE
// END_MODULE_CONTRACT
//
// Usage:
//   bun tools/dev-initdata.mjs
//   bun tools/dev-initdata.mjs --url https://dev.events.versacegus.cc
//   bun tools/dev-initdata.mjs --user '{"id":1001,"first_name":"Иван"}'

import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotenv() {
  for (const rel of [".env", "apps/svc-backend/.env"]) {
    const path = join(ROOT, rel);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq);
      let value = trimmed.slice(eq + 1);
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[key] == null || process.env[key] === "") process.env[key] = value;
    }
  }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

export function signInitData(token, user, extras = {}) {
  const params = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: typeof user === "string" ? user : JSON.stringify(user),
    ...extras,
  };
  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return Object.entries({ ...params, hash })
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
}

export function loginUrl(origin, initData) {
  const url = new URL(origin);
  url.searchParams.set("initData", initData);
  return url.toString();
}

loadDotenv();

if (import.meta.main) {
  const token = arg("token", process.env.MAX_BOT_TOKEN ?? "local-dev-token");
  const user = arg("user", process.env.MAX_DEV_USER ?? JSON.stringify({ id: 1001, first_name: "Иван", username: "ivan_dev", language_code: "ru" }));
  const startParam = arg("start", "");
  const extras = {};
  if (startParam) extras.start_param = startParam;
  const initData = signInitData(token, user, extras);
  const origin = arg("url", "");
  if (origin) process.stdout.write(`${loginUrl(origin, initData)}\n`);
  else process.stdout.write(`${initData}\n`);
}
