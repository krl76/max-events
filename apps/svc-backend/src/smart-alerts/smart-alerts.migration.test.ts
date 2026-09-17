import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { AddSmartAlertSentAt20260912090000 } from "../database/migrations/20260912090000-AddSmartAlertSentAt";

describe("AddSmartAlertSentAt20260912090000", () => {
  it("adds weather and friend-left columns and drops them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddSmartAlertSentAt20260912090000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ALTER TABLE "plans" ADD COLUMN "weatherAlertSentAt"');
    expect(queries[1]).toContain('ALTER TABLE "plans" ADD COLUMN "friendLeftBroadcastAt"');
    expect(queries[2]).toContain('ALTER TABLE "plan_participants" ADD COLUMN "friendLeftBroadcastAt"');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([
      `ALTER TABLE "plan_participants" DROP COLUMN "friendLeftBroadcastAt"`,
      `ALTER TABLE "plans" DROP COLUMN "friendLeftBroadcastAt"`,
      `ALTER TABLE "plans" DROP COLUMN "weatherAlertSentAt"`,
    ]);
  });
});
