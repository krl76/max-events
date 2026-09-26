import { describe, expect, it } from "vitest";
import { CreateSwipeDecisions20260919170000 } from "../database/migrations/20260919170000-CreateSwipeDecisions";

describe("CreateSwipeDecisions", () => {
  it("creates swipe_decisions with a unique (userId, placeId) and drops it on revert", async () => {
    const queries: string[] = [];
    const runner = { query: async (sql: string) => { queries.push(sql); } };
    const migration = new CreateSwipeDecisions20260919170000();
    await migration.up(runner as never);
    expect(queries[0]).toContain('CREATE TABLE "swipe_decisions"');
    expect(queries[0]).toContain("UQ_swipe_decisions_user_place");
    queries.length = 0;
    await migration.down(runner as never);
    expect(queries[0]).toContain('DROP TABLE "swipe_decisions"');
  });
});
