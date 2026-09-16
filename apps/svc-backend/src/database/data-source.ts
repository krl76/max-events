// START_MODULE_CONTRACT
// PURPOSE: Standalone TypeORM DataSource for the migration CLI (generate/run/revert).
// SCOPE: Postgres connection from validated env; migration sources in src/database/migrations.
// DEPENDS: typeorm, config/env
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AppDataSource - standalone TypeORM DataSource consumed by the migration CLI
// END_MODULE_MAP

import "reflect-metadata";
import { DataSource } from "typeorm";
import { validateEnv } from "../config/env";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";

const env = validateEnv();

export const AppDataSource = new DataSource({
  type: "postgres",
  url: env.DATABASE_URL,
  entities: [UserEntity, PlaceEntity, EventEntity],
  migrations: ["src/database/migrations/*.ts"],
});
