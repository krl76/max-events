import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { AddReviewsEventIndex20260917000000 } from "../database/migrations/20260917000000-AddReviewsEventIndex";

describe("AddReviewsEventIndex20260917000000", () => {
  it("indexes reviews by event and drops the index on revert", async () => {
    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => void queries.push(sql) } as unknown as QueryRunner;
    const migration = new AddReviewsEventIndex20260917000000();

    await migration.up(queryRunner);

    // Not unique: an event has many reviews, and the per-user uniqueness already lives in UQ_reviews_user_event.
    expect(queries[0]).toBe('CREATE INDEX "IDX_reviews_event" ON "reviews" ("eventId")');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP INDEX "IDX_reviews_event"');
  });
});
