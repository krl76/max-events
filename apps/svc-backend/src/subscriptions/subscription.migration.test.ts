import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateSubscriptions20260911230000 } from "../database/migrations/20260911230000-CreateSubscriptions";

describe("CreateSubscriptions20260911230000", () => {
  it("adds organizerUserId and subscriptions, then reverts", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateSubscriptions20260911230000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain("organizerUserId");
    expect(queries[2]).toContain('CREATE TABLE "subscriptions"');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[3]).toContain('DROP TABLE "subscriptions"');
    expect(queries[5]).toContain("organizerUserId");
  });
});
