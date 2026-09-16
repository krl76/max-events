import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateBookings20260911140000 } from "../database/migrations/20260911140000-CreateBookings";

describe("CreateBookings20260911140000", () => {
  it("adds bookedCount, creates bookings with a partial unique active index, and reverts both", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateBookings20260911140000();

    await migration.up(queryRunner);
    expect(queries[0]).toContain('ALTER TABLE "events" ADD COLUMN "bookedCount"');
    expect(queries[1]).toContain('CREATE TABLE "bookings"');
    expect(queries[1]).toContain('FOREIGN KEY ("eventId") REFERENCES "events"("id")');
    expect(queries[2]).toContain("WHERE \"status\" = 'active'");

    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP INDEX "UQ_bookings_active_user_event"`, `DROP TABLE "bookings"`, `ALTER TABLE "events" DROP COLUMN "bookedCount"`]);
  });
});
