import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateNotifications20260919150100 } from "../database/migrations/20260919150100-CreateNotifications";

describe("CreateNotifications20260919150100", () => {
  it("creates notifications with user and actor FKs and drops the table on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateNotifications20260919150100();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "notifications"');
    expect(queries[0]).toContain('FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE');
    expect(queries[1]).toContain("IDX_notifications_user_created");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain("IDX_notifications_user_created");
    expect(queries[1]).toContain('DROP TABLE "notifications"');
  });
});
