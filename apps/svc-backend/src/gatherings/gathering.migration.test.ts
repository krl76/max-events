import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateGatherings20260911200000 } from "../database/migrations/20260911200000-CreateGatherings";

describe("CreateGatherings20260911200000", () => {
  it("creates gatherings and invitees tables and drops them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateGatherings20260911200000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "gatherings"');
    expect(queries[1]).toContain('CREATE TABLE "gathering_invitees"');
    expect(queries[1]).toContain("UQ_gathering_invitees_gathering_user");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "gathering_invitees"`, `DROP TABLE "gatherings"`]);
  });
});
