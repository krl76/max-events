import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { AddPlanAssembledByMax20260920160000 } from "../database/migrations/20260920160000-AddPlanAssembledByMax";

describe("AddPlanAssembledByMax20260920160000", () => {
  it("adds and drops assembledByMax", async () => {
    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => queries.push(sql) } as unknown as QueryRunner;
    const migration = new AddPlanAssembledByMax20260920160000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ADD COLUMN "assembledByMax"');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP COLUMN "assembledByMax"');
  });
});
