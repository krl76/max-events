import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreatePlaceParticipations20260920120000 } from "../database/migrations/20260920120000-CreatePlaceParticipations";

describe("CreatePlaceParticipations20260920120000", () => {
  it("creates the place_participations table and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreatePlaceParticipations20260920120000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "place_participations"');
    expect(queries[0]).toContain("UQ_place_participations_user_place");
    expect(queries[0]).toContain("looking_for_after_event_company");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "place_participations"`]);
  });
});
