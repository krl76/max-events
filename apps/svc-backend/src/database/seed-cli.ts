// START_MODULE_CONTRACT
// PURPOSE: CLI entry for catalog seed against the configured Postgres DataSource.
// SCOPE: initialize AppDataSource, run seedDatabase, destroy; no Bot API.
// DEPENDS: ./data-source, ./seed, places/events entities
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - main - seed CLI
// END_MODULE_MAP

import "reflect-metadata";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { AppDataSource } from "./data-source";
import { seedDatabase } from "./seed";

async function main() {
  await AppDataSource.initialize();
  try {
    const result = await seedDatabase(AppDataSource.getRepository(PlaceEntity), AppDataSource.getRepository(EventEntity));
    process.stdout.write(`seeded places=${result.placesInserted} events=${result.eventsInserted}\n`);
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "seed failed"}\n`);
  process.exit(1);
});
