import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { AddEventChatLink20260911160000 } from "../database/migrations/20260911160000-AddEventChatLink";

describe("AddEventChatLink20260911160000", () => {
  it("adds chatLink and chatSyncPending and drops them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddEventChatLink20260911160000();

    await migration.up(queryRunner);
    expect(queries[0]).toContain('ADD COLUMN "chatLink"');
    expect(queries[1]).toContain('ADD COLUMN "chatSyncPending"');

    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`ALTER TABLE "events" DROP COLUMN "chatSyncPending"`, `ALTER TABLE "events" DROP COLUMN "chatLink"`]);
  });
});
