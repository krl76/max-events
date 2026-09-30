// START_MODULE_CONTRACT
// PURPOSE: Stack identity the conversational bot already has without extra env — public origin for images/webhook, and the webhook secret derived from MAX_BOT_TOKEN.
// SCOPE: Pure functions over config values. Origin is BOT_PUBLIC_URL, else PUBLIC_APP_URL, else the documented host of this contour (prod vs kku). Secret is BOT_WEBHOOK_SECRET, else SHA-256 of the bot token in MAX's alphabet. Subscribe only on the MAX production contour (token present, long poll off, browser-auth off) so the kku stack cannot steal the live bot's webhook.
// DEPENDS: node:crypto
// LINKS: M-SVC-BACKEND, https://dev.max.ru/docs-api/methods/POST/subscriptions
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DEFAULT_PROD_ORIGIN / DEFAULT_KKU_ORIGIN - the two HTTPS hosts this repo deploys
// - flagOn - true / "true" the way ConfigService may store a validated boolean or a raw env string
// - stackOrigin - public origin for covers, hero, and the webhook URL
// - webhookUrl - ${origin}/api/bot/webhook
// - derivedWebhookSecret - SHA-256 hex of the bot token; alphabet and length match MAX's secret constraint
// - webhookSecret - explicit override, else derived from MAX_BOT_TOKEN, else null
// - shouldSubscribe - prod MAX contour only
// END_MODULE_MAP

import { createHash } from "node:crypto";

/** HTTPS origin of the main stack (events.versacegus.cc). Same host the mini-app is rsynced to. */
export const DEFAULT_PROD_ORIGIN = "https://events.versacegus.cc";
/** HTTPS origin of the isolated kku stack. */
export const DEFAULT_KKU_ORIGIN = "https://dev.events.versacegus.cc";

/** Nest may hand a validated boolean or the raw "true"/"false" string. */
export function flagOn(value: unknown): boolean {
  return value === true || value === "true";
}

function originOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed === "") return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

/**
 * Public origin MAX can fetch images from and POST the webhook to. Explicit BOT_PUBLIC_URL wins,
 * then the leftover PUBLIC_APP_URL some stacks already carry, then the host of this contour.
 */
export function stackOrigin(env: { BOT_PUBLIC_URL?: unknown; PUBLIC_APP_URL?: unknown; AUTH_ALLOW_BROWSER?: unknown }): string {
  return originOf(env.BOT_PUBLIC_URL) ?? originOf(env.PUBLIC_APP_URL) ?? (flagOn(env.AUTH_ALLOW_BROWSER) ? DEFAULT_KKU_ORIGIN : DEFAULT_PROD_ORIGIN);
}

export function webhookUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/api/bot/webhook`;
}

/**
 * Stable secret in MAX's `^[a-zA-Z0-9_-]{5,256}$`. Hex SHA-256 is 64 chars of [0-9a-f].
 * Binding includes a purpose string so the token itself never becomes the header value.
 */
export function derivedWebhookSecret(token: string): string {
  return createHash("sha256").update(`max-events.bot.webhook.v1\0${token}`).digest("hex");
}

/** Explicit BOT_WEBHOOK_SECRET, else a derivation from MAX_BOT_TOKEN, else nothing. */
export function webhookSecret(env: { BOT_WEBHOOK_SECRET?: unknown; MAX_BOT_TOKEN?: unknown }): string | null {
  if (typeof env.BOT_WEBHOOK_SECRET === "string" && env.BOT_WEBHOOK_SECRET.trim() !== "") return env.BOT_WEBHOOK_SECRET.trim();
  if (typeof env.MAX_BOT_TOKEN === "string" && env.MAX_BOT_TOKEN.trim() !== "") return derivedWebhookSecret(env.MAX_BOT_TOKEN.trim());
  return null;
}

/**
 * Point MAX at this process. The live bot belongs to the MAX-only host: a shared token on kku
 * would move deliveries to the demo stack, and long polling cannot run beside a webhook.
 */
export function shouldSubscribe(env: { MAX_BOT_TOKEN?: unknown; BOT_LONGPOLL?: unknown; AUTH_ALLOW_BROWSER?: unknown }): boolean {
  if (typeof env.MAX_BOT_TOKEN !== "string" || env.MAX_BOT_TOKEN.trim() === "") return false;
  if (flagOn(env.BOT_LONGPOLL)) return false;
  if (flagOn(env.AUTH_ALLOW_BROWSER)) return false;
  return true;
}
