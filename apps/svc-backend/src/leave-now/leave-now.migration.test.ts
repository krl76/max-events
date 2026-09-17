import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { AddLeaveNowSentAt20260912080000 } from "../database/migrations/20260912080000-AddLeaveNowSentAt";

describe("AddLeaveNowSentAt20260912080000", () => {
  it("adds leaveNowSentAt on plans and participants and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddLeaveNowSentAt20260912080000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ALTER TABLE "plans" ADD COLUMN "leaveNowSentAt"');
    expect(queries[1]).toContain('ALTER TABLE "plan_participants" ADD COLUMN "leaveNowSentAt"');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`ALTER TABLE "plan_participants" DROP COLUMN "leaveNowSentAt"`, `ALTER TABLE "plans" DROP COLUMN "leaveNowSentAt"`]);
  });
});
