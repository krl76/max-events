import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { AddFeedPostPhoto20260913040000 } from "../database/migrations/20260913040000-AddFeedPostPhoto";

describe("AddFeedPostPhoto20260913040000", () => {
  it("adds a nullable photoUrl to feed_posts and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddFeedPostPhoto20260913040000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ALTER TABLE "feed_posts" ADD "photoUrl"');
    // Nullable: existing posts have no photo and must survive the migration.
    expect(queries[0]).not.toContain("NOT NULL");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP COLUMN "photoUrl"');
  });
});
