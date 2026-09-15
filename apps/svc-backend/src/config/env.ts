// START_MODULE_CONTRACT
// PURPOSE: zod-validated environment variables, fail-fast on missing or invalid values.
// SCOPE: env schema + validator shared by the Nest process and the TypeORM CLI datasource.
// DEPENDS: zod, dotenv
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - envSchema - zod schema for backend environment variables
// - validateEnv - parses raw env input and throws a readable error on invalid values
// - Env - inferred validated env type
// END_MODULE_MAP

import { config } from "dotenv";
import { z } from "zod";

config({ quiet: true });

export const envSchema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres connection string (postgres://...)"),
  REDIS_URL: z.string().regex(/^rediss?:\/\//, "must be a redis connection string (redis://...)"),
  PORT: z.coerce.number().int().positive().default(3100),
  MAX_BOT_TOKEN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown> = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }
  return parsed.data;
}
