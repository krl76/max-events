import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateProfiles20260911150000 } from "../database/migrations/20260911150000-CreateProfiles";
import { AddProfileSmartAlerts20260912100000 } from "../database/migrations/20260912100000-AddProfileSmartAlerts";
import { AddProfilePrivacy20260912120000 } from "../database/migrations/20260912120000-AddProfilePrivacy";
import { AddProfileRecommendations20260913030000 } from "../database/migrations/20260913030000-AddProfileRecommendations";

describe("CreateProfiles20260911150000", () => {
  it("creates profiles keyed by userId and drops the table on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateProfiles20260911150000();

    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "profiles"');
    expect(queries[0]).toContain('PRIMARY KEY ("userId")');
    expect(queries[0]).toContain('FOREIGN KEY ("userId") REFERENCES "users"("id")');

    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual(['DROP TABLE "profiles"']);
  });
});

describe("AddProfileSmartAlerts20260912100000", () => {
  it("adds smartAlerts jsonb and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddProfileSmartAlerts20260912100000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ADD COLUMN "smartAlerts" jsonb');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`ALTER TABLE "profiles" DROP COLUMN "smartAlerts"`]);
  });
});

describe("AddProfilePrivacy20260912120000", () => {
  it("adds privacy jsonb and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddProfilePrivacy20260912120000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ADD COLUMN "privacy" jsonb');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`ALTER TABLE "profiles" DROP COLUMN "privacy"`]);
  });
});

describe("AddProfileRecommendations20260913030000", () => {
  it("adds recommendationsEnabled", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddProfileRecommendations20260913030000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain("recommendationsEnabled");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain("DROP COLUMN \"recommendationsEnabled\"");
  });
});
