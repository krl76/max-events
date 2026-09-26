import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateFeedDrafts20260920130000 } from "../database/migrations/20260920130000-CreateFeedDrafts";

describe("CreateFeedDrafts20260920130000", () => {
  it("creates the feed_drafts table and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => queries.push(sql) } as unknown as QueryRunner;
    const migration = new CreateFeedDrafts20260920130000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "feed_drafts"');
    expect(queries[0]).toContain("UQ_feed_drafts_author");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "feed_drafts"`]);
  });
});
