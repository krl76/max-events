import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { AddProfileAppSettings20260920140000 } from "../database/migrations/20260920140000-AddProfileAppSettings";

describe("AddProfileAppSettings20260920140000", () => {
  it("adds and drops the appSettings column", async () => {
    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => queries.push(sql) } as unknown as QueryRunner;
    const migration = new AddProfileAppSettings20260920140000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ADD COLUMN "appSettings"');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP COLUMN "appSettings"');
  });
});
