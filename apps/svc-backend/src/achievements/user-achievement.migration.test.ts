import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateUserAchievements20260911250000 } from "../database/migrations/20260911250000-CreateUserAchievements";

describe("CreateUserAchievements20260911250000", () => {
  it("creates user_achievements and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateUserAchievements20260911250000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "user_achievements"');
    expect(queries[0]).toContain("UQ_user_achievements_user_code");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "user_achievements"`]);
  });
});
