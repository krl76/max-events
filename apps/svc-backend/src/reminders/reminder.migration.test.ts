import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { AddBookingReminderSentAt20260911170000 } from "../database/migrations/20260911170000-AddBookingReminderSentAt";

describe("AddBookingReminderSentAt20260911170000", () => {
  it("adds reminderSentAt and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddBookingReminderSentAt20260911170000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ADD COLUMN "reminderSentAt"');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`ALTER TABLE "bookings" DROP COLUMN "reminderSentAt"`]);
  });
});
