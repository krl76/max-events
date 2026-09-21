// START_MODULE_CONTRACT
// PURPOSE: Server-side validation of MAX mini-app initData (HMAC-SHA256).
// SCOPE: Parse raw initData, verify the signature against the bot token, enforce auth_date freshness, extract the user payload.
// DEPENDS: node:crypto, zod
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// Algorithm source: https://dev.max.ru/docs/webapps/validation
// data-check-string: pairs of initData sorted by key a->z, joined with "\n", "hash" excluded;
// secret_key = HMAC-SHA256(key="WebAppData", data=BOT_TOKEN); signature = hex(HMAC-SHA256(key=secret_key, data=data-check-string)).
//
// START_MODULE_MAP
// - MAX_AUTH_DATE_AGE_SECONDS - max accepted auth_date age; bounds the replay window
// - MaxInitDataUserSchema - shape of the user object embedded in initData
// - MaxInitDataUser - user payload type
// - ValidatedInitData - parsed params, authDate and user after successful validation
// - signInitData - HMAC-SHA256 initData string (same algorithm as validateInitData)
// - validateInitData - returns ValidatedInitData or null on any signature, freshness or shape failure
// END_MODULE_MAP

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// ponytail: 24h replay window is fine for read-only MVP; shrink TTL or add query_id anti-replay when write/booking operations appear
export const MAX_AUTH_DATE_AGE_SECONDS = 24 * 60 * 60;
const CLOCK_SKEW_SECONDS = 60;

export const MaxInitDataUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().min(1),
  last_name: z.string().nullish(),
  username: z.string().max(64).nullish(),
  language_code: z.string().nullish(),
  photo_url: z.string().nullish(),
});
export type MaxInitDataUser = z.infer<typeof MaxInitDataUserSchema>;

export interface ValidatedInitData {
  params: Record<string, string>;
  authDate: number;
  user: MaxInitDataUser;
}

export function signInitData(params: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.entries(params)
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return Object.entries({ ...params, hash })
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
}

export function validateInitData(initData: string, botToken: string, nowSeconds: number = Math.floor(Date.now() / 1000)): ValidatedInitData | null {
  const pairs: [string, string][] = [];
  for (const part of initData.split("&")) {
    const eq = part.indexOf("=");
    if (eq <= 0) return null;
    let value: string;
    try {
      value = decodeURIComponent(part.slice(eq + 1));
    } catch {
      return null;
    }
    pairs.push([part.slice(0, eq), value]);
  }

  const keys = pairs.map(([key]) => key);
  if (new Set(keys).size !== keys.length) return null;

  const hashPairs = pairs.filter(([key]) => key === "hash");
  if (hashPairs.length !== 1) return null;
  const hashHex = hashPairs[0][1];
  if (!/^[0-9a-f]{64}$/.test(hashHex)) return null;
  const received = Buffer.from(hashHex, "hex");

  const dataCheckString = pairs
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest();

  if (received.length !== computed.length || !timingSafeEqual(received, computed)) return null;

  const params = Object.fromEntries(pairs.filter(([key]) => key !== "hash"));

  const authDate = Number(params.auth_date);
  if (!Number.isInteger(authDate) || authDate <= 0) return null;
  if (nowSeconds - authDate > MAX_AUTH_DATE_AGE_SECONDS) return null;
  if (authDate > nowSeconds + CLOCK_SKEW_SECONDS) return null;

  if (typeof params.user !== "string") return null;
  let userJson: unknown;
  try {
    userJson = JSON.parse(params.user);
  } catch {
    return null;
  }
  const user = MaxInitDataUserSchema.safeParse(userJson);
  if (!user.success) return null;

  return { params, authDate, user: user.data };
}
