import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateCheckIns20260911240000 } from "../database/migrations/20260911240000-CreateCheckIns";

describe("CreateCheckIns20260911240000", () => {
  it("creates check_ins with visit unique indexes and drops them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateCheckIns20260911240000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "check_ins"');
    expect(queries[1]).toContain("UQ_check_ins_user_event");
    expect(queries[2]).toContain("UQ_check_ins_user_place_day");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[2]).toContain('DROP TABLE "check_ins"');
  });
});
