// START_MODULE_CONTRACT
// PURPOSE: CLI entry for the demo seed against the configured Postgres DataSource.
// SCOPE: guard DATABASE_URL to localhost (SEED_DEMO_ALLOW_REMOTE=1 opens a named stand deliberately), initialize AppDataSource, run seedDemoDatabase, print counters, destroy; no Bot API.
// DEPENDS: ./data-source, ./seed-demo
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - runDemoSeedCli - guard env, initialize DataSource, seed, print counters
// END_MODULE_MAP

import "reflect-metadata";
// data-source import loads .env via src/config/env before the guard reads DATABASE_URL
import { AppDataSource } from "./data-source";
import { parseDemoScale, seedDemoDatabase, assertLocalDatabaseUrl } from "./seed-demo";

const DEV_INITDATA_MAX_ID = "88847255";

export async function runDemoSeedCli() {
  assertLocalDatabaseUrl(process.env.DATABASE_URL ?? "", process.env.SEED_DEMO_ALLOW_REMOTE === "1");
  const scale = parseDemoScale(process.env.SEED_DEMO_SCALE);
  const ownerMaxUserId = process.env.SEED_DEMO_OWNER_MAX_ID ?? "777000111";
  await AppDataSource.initialize();
  try {
    const reset = process.env.SEED_DEMO_RESET === "1";
    const result = await seedDemoDatabase(AppDataSource, { scale, ownerMaxUserId, devMaxUserId: DEV_INITDATA_MAX_ID, reset });
    const counters = Object.entries(result.inserted)
      .map(([table, count]) => `${table}=${count}`)
      .join(" ");
    process.stdout.write(`seed:demo scale=${scale} owner=${ownerMaxUserId}\n${counters}\n`);
    process.stdout.write(`inserted=${result.totalInserted} skipped-existing=${result.totalSkipped} of ${result.totalRows} rows\n`);
  } finally {
    await AppDataSource.destroy();
  }
}

void runDemoSeedCli().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "demo seed failed"}\n`);
  process.exit(1);
});
