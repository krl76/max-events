import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateProfiles20260911150000 } from "../database/migrations/20260911150000-CreateProfiles";

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
