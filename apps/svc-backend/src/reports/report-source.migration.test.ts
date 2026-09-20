import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { AddReportSource20260913050000 } from "../database/migrations/20260913050000-AddReportSource";

describe("AddReportSource20260913050000", () => {
  it("adds source defaulting to user so existing reports stay user complaints", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddReportSource20260913050000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ALTER TABLE "reports" ADD "source"');
    expect(queries[0]).toContain("DEFAULT 'user'");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP COLUMN "source"');
  });
});
