import { describe, expect, it } from "vitest";
import { CreateCalendarShares20260919190000 } from "../database/migrations/20260919190000-CreateCalendarShares";

describe("CreateCalendarShares", () => {
  it("creates shares, invites and goings and drops them on revert", async () => {
    const queries: string[] = [];
    const runner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    };
    const migration = new CreateCalendarShares20260919190000();
    await migration.up(runner as never);
    expect(queries[0]).toContain('CREATE TABLE "calendar_shares"');
    expect(queries[0]).toContain("UQ_calendar_shares_owner_peer");
    expect(queries[1]).toContain('CREATE TABLE "calendar_invites"');
    expect(queries[2]).toContain('CREATE TABLE "calendar_goings"');
    queries.length = 0;
    await migration.down(runner as never);
    expect(queries).toEqual(['DROP TABLE "calendar_goings"', 'DROP TABLE "calendar_invites"', 'DROP TABLE "calendar_shares"']);
  });
});
