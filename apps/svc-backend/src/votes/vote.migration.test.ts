import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateVotes20260912200000 } from "../database/migrations/20260912200000-CreateVotes";

describe("CreateVotes20260912200000", () => {
  it("creates vote tables and drops them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateVotes20260912200000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "votes"');
    expect(queries[1]).toContain('CREATE TABLE "vote_options"');
    expect(queries[1]).toContain("UQ_vote_options_vote_event");
    expect(queries[2]).toContain('CREATE TABLE "vote_participants"');
    expect(queries[3]).toContain('CREATE TABLE "vote_ballots"');
    expect(queries[3]).toContain("UQ_vote_ballots_vote_user");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "vote_ballots"`, `DROP TABLE "vote_participants"`, `DROP TABLE "vote_options"`, `DROP TABLE "votes"`]);
  });
});
