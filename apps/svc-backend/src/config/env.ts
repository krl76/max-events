// START_MODULE_CONTRACT
// PURPOSE: zod-validated environment variables, fail-fast on missing or invalid values.
// SCOPE: env schema + validator shared by the Nest process and the TypeORM CLI datasource; optional payment provider keys.
// DEPENDS: zod, dotenv
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - envSchema - zod schema for backend environment variables
// - validateEnv - parses raw env input and throws a readable error on invalid values
// - parseModeratorIds - comma-separated MAX user ids for moderation
// - Env - inferred validated env type
// END_MODULE_MAP

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import { z } from "zod";

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
  MAX_BOT_TOKEN: z.string().min(1).optional(),
  MODERATOR_MAX_USER_IDS: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(["sandbox", "none"]).default("sandbox"),
  PAYMENT_SECRET: z.string().min(1).optional(),
  PAYMENT_SANDBOX_FAIL_AMOUNT: z.coerce.number().int().positive().default(13),
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
