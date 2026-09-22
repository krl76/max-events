// START_MODULE_CONTRACT
// PURPOSE: CLI entry for catalog seed against the configured Postgres DataSource.
// SCOPE: initialize AppDataSource, run seedDatabase with the operator's organizer login when configured, destroy; no Bot API.
// DEPENDS: ./data-source, ./seed, places/events/users entities, organizations/organizations.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - runSeedCli - initialize DataSource, seed, destroy
// END_MODULE_MAP

import "reflect-metadata";
import { EventEntity } from "../events/event.entity";
import { OrganizationEntity } from "../organizations/organization.entity";
import { OrganizationsService } from "../organizations/organizations.service";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { AppDataSource } from "./data-source";
import { seedDatabase } from "./seed";

export async function runSeedCli() {
  await AppDataSource.initialize();
  try {
    const result = await seedDatabase(
      {
        places: AppDataSource.getRepository(PlaceEntity),
        events: AppDataSource.getRepository(EventEntity),
        users: AppDataSource.getRepository(UserEntity),
        organizations: new OrganizationsService(AppDataSource.getRepository(OrganizationEntity)),
      },
      // The operator's bootstrap pair, when set, so the seed publishes under the account they will log
      // into instead of a second one. Neither value is printed.
      { organizerLogin: process.env.ORGANIZER_LOGIN, organizerPassword: process.env.ORGANIZER_PASSWORD },
    );
    process.stdout.write(`seeded places=${result.placesInserted} events=${result.eventsInserted} bound=${result.eventsBound} organization=${result.organizationInserted ? "created" : "existing"}\n`);
  } finally {
    await AppDataSource.destroy();
  }
}

void runSeedCli().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "seed failed"}\n`);
  process.exit(1);
});
