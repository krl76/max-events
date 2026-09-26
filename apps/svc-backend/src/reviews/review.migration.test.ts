import { describe, expect, it } from "vitest";
import { AddReviewFactTags20260919180000 } from "../database/migrations/20260919180000-AddReviewFactTags";

describe("AddReviewFactTags", () => {
  it("adds factTags to reviews and drops it on revert", async () => {
    const queries: string[] = [];
    const runner = { query: async (sql: string) => { queries.push(sql); } };
    const migration = new AddReviewFactTags20260919180000();
    await migration.up(runner as never);
    expect(queries[0]).toContain('ALTER TABLE "reviews" ADD COLUMN "factTags"');
    queries.length = 0;
    await migration.down(runner as never);
    expect(queries[0]).toContain('DROP COLUMN "factTags"');
  });
});
