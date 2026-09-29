import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateFriendships20260911190000 } from "../database/migrations/20260911190000-CreateFriendships";
import { AddFriendsSyncedAt20260919120000 } from "../database/migrations/20260919120000-AddFriendsSyncedAt";
import { AddFriendshipClose20260921120000 } from "../database/migrations/20260921120000-AddFriendshipClose";

describe("CreateFriendships20260911190000", () => {
  it("creates the friendships table and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateFriendships20260911190000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "friendships"');
    expect(queries[0]).toContain("UQ_friendships_user_friend");
    expect(queries[0]).toContain("CHK_friendships_not_self");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "friendships"`]);
  });
});

describe("AddFriendshipClose20260921120000", () => {
  it("adds closeFriend and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddFriendshipClose20260921120000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain("closeFriend");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP COLUMN "closeFriend"');
  });
});

describe("AddFriendsSyncedAt20260919120000", () => {
  it("adds friendsSyncedAt and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddFriendsSyncedAt20260919120000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain("friendsSyncedAt");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP COLUMN "friendsSyncedAt"');
  });
});
