import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateParticipations20260911180000 } from "../database/migrations/20260911180000-CreateParticipations";

describe("CreateParticipations20260911180000", () => {
  it("creates the participations table and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateParticipations20260911180000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "participations"');
    expect(queries[0]).toContain("UQ_participations_user_event");
    expect(queries[0]).toContain("looking_for_after_event_company");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "participations"`]);
  });
});
