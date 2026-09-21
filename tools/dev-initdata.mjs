#!/usr/bin/env node
// START_MODULE_CONTRACT
// PURPOSE: Generate a signed MAX initData string for local live-mode dev (miniapp shim: apps/app-miniapp/src/max/dev-init-data.ts).
// SCOPE: CLI only; signs auth_date + user with the bot token per https://dev.max.ru/docs/webapps/validation. No dependencies.
// DEPENDS: node:crypto; backend must run with the same MAX_BOT_TOKEN
// LINKS: M-APP-MINIAPP, M-SVC-BACKEND
// MAP_MODE: NONE
// END_MODULE_CONTRACT
//
// Usage: open "http://localhost:5173/?initData=$(bun tools/dev-initdata.mjs)"
//        bun tools/dev-initdata.mjs --token local-dev-token --user '{"id":1001,"first_name":"Иван"}'

import { createHmac } from "node:crypto";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const token = arg("token", "local-dev-token");
const user = arg("user", JSON.stringify({ id: 1001, first_name: "Иван", username: "ivan_dev" }));

const params = {
  auth_date: String(Math.floor(Date.now() / 1000)),
  user,
};

// data-check-string: pairs sorted by key, joined with "\n", hash excluded.
const dataCheckString = Object.keys(params)
  .sort()
  .map((key) => `${key}=${params[key]}`)
  .join("\n");
const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

const initData = Object.entries({ ...params, hash })
  .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
  .join("&");
process.stdout.write(`${initData}\n`);
