import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreatePlans20260911210000 } from "../database/migrations/20260911210000-CreatePlans";

describe("CreatePlans20260911210000", () => {
  it("creates plans and participants tables and drops them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreatePlans20260911210000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "plans"');
    expect(queries[1]).toContain('CREATE TABLE "plan_participants"');
    expect(queries[1]).toContain("UQ_plan_participants_plan_user");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "plan_participants"`, `DROP TABLE "plans"`]);
  });
});
