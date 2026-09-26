// START_MODULE_CONTRACT
// PURPOSE: zod-validated environment variables, fail-fast on missing or invalid values.
// SCOPE: env schema + validator shared by the Nest process and the TypeORM CLI datasource; optional payment provider keys; opt-in demo switches (NODE_ENV gates the ones that would leak data outside development); optional organizer panel credentials (fail-closed when unset); AUTH_ALLOW_BROWSER staging switch.
// DEPENDS: zod, dotenv
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - envSchema - zod schema for backend environment variables
// - validateEnv - parses raw env input and throws a readable error on invalid values
// - DEFAULT_MODEL_API_URL - OpenCode Zen chat-completions root
// - DEFAULT_MODEL_API_MODELS - failover order, fast models first
// - parseModelApiModels - comma-separated model ids, blanks and duplicates dropped
// - parseModeratorIds - comma-separated MAX user ids for moderation
// - Env - inferred validated env type
// END_MODULE_MAP

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import { z } from "zod";

/** OpenCode Zen chat-completions root. Override with MODEL_API_URL for another OpenAI-compatible host. */
export const DEFAULT_MODEL_API_URL = "https://opencode.ai/zen/v1";

/** Fast models first so a hung reasoning model is only reached after the others fail. */
export const DEFAULT_MODEL_API_MODELS = ["mimo-v2.6-flash-free", "ling-3.0-flash-fin-free", "nemotron-3.5-lightning-free", "mimo-v2.5-free", "big-pickle", "muse-spark-1.3-contributor-free"] as const;

export function parseModelApiModels(raw: string | undefined): string[] {
  const source = raw?.trim() ? raw : DEFAULT_MODEL_API_MODELS.join(",");
  const seen = new Set<string>();
  const models: string[] = [];
  for (const part of source.split(",")) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push(id);
  }
  return models.length > 0 ? models : [...DEFAULT_MODEL_API_MODELS];
}

// Resolve the closest .env walking up from this module regardless of cwd
// (dotenv reads .env relative to process cwd, which differs across run styles:
// `bun run dev:backend` from repo root vs `bun --filter svc-backend ...`).
// dotenv default does NOT override existing process.env values, so real env wins.
let envDir = __dirname;
while (true) {
  const envPath = join(envDir, ".env");
  if (existsSync(envPath)) {
    config({ path: envPath, quiet: true });
    break;
  }
  const parent = dirname(envDir);
  if (parent === envDir) break;
  envDir = parent;
}

export const envSchema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres connection string (postgres://...)"),
  REDIS_URL: z.string().regex(/^rediss?:\/\//, "must be a redis connection string (redis://...)"),
  PORT: z.coerce.number().int().positive().default(3100),
  // Which environment this process believes it is. The default is the strict one on purpose: a host
  // that forgets to set NODE_ENV must not thereby unlock a development-only switch. Note that
  // ConfigModule writes validated keys back into process.env, so this default also lands there.
  NODE_ENV: z.string().default("production"),
  MAX_BOT_TOKEN: z.string().min(1).optional(),
  MODERATOR_MAX_USER_IDS: z.string().optional(),
  // Organizer panel bootstrap credentials: the first successful login provisions the organizations row from them.
  // Once an account row exists it wins; with neither row nor these vars POST /auth/organizer/login is 503 (fail-closed).
  ORGANIZER_LOGIN: z.string().min(1).optional(),
  ORGANIZER_PASSWORD: z.string().min(1).optional(),
  // In-app charges: sandbox (fake) or none. `live` is not a value — production cannot take a ruble in-app.
  // Paid events collect money through Event.paymentUrl, outside the product.
  PAYMENT_PROVIDER: z.enum(["sandbox", "none"]).default("none"),
  PAYMENT_SECRET: z.string().min(1).optional(),
  PAYMENT_SANDBOX_FAIL_AMOUNT: z.coerce.number().int().positive().default(13),
  PAYMENT_COMMISSION_BPS: z.coerce.number().int().min(0).max(10_000).default(1000),
  // OpenAI-compatible catalog parser (OpenCode Zen and the same wire format).
  // Unset key keeps the keyword parser. Models are tried in order.
  MODEL_API_KEY: z.string().min(1).optional(),
  MODEL_API_URL: z.string().url().default(DEFAULT_MODEL_API_URL),
  MODEL_API_MODELS: z
    .string()
    .optional()
    .transform((value) => parseModelApiModels(value)),
  // MAX Bridge exposes no friend list. Treating every app user as a friend is a demo convenience
  // that leaks who else uses the app, so it is opt-in, off by default, and ignored unless
  // NODE_ENV is development or test (see FriendsService.demoFallbackEnabled).
  FRIENDS_DEMO_ALL_USERS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // Staging-only: mint signed initData for a browser session. Must stay false on the MAX-only host.
  AUTH_ALLOW_BROWSER: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // Optional JSON MAX user for AUTH_ALLOW_BROWSER. Unset = tools/max-dev-accounts.json owner.
  AUTH_BROWSER_USER: z.string().min(1).optional(),
  STORAGE_DIR: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseModeratorIds(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );
}

export function validateEnv(raw: Record<string, unknown> = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }
  return parsed.data;
}
