import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateEventOptions20260920150000 } from "../database/migrations/20260920150000-CreateEventOptions";

describe("CreateEventOptions20260920150000", () => {
  it("creates and drops event_options", async () => {
    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => queries.push(sql) } as unknown as QueryRunner;
    const migration = new CreateEventOptions20260920150000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "event_options"');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "event_options"`]);
  });
});
