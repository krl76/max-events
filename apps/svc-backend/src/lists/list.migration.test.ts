import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateLists20260911220000 } from "../database/migrations/20260911220000-CreateLists";
import { AddListItemPlaceUnique20260919120400 } from "../database/migrations/20260919120400-AddListItemPlaceUnique";
import { AddListMembers20260919150000 } from "../database/migrations/20260919150000-AddListMembers";
import { AddListItemFeedPost20260920190000 } from "../database/migrations/20260920190000-AddListItemFeedPost";
import { RelaxListItemTargetCheck20260920200000 } from "../database/migrations/20260920200000-RelaxListItemTargetCheck";

describe("CreateLists20260911220000", () => {
  it("creates lists and list_items and drops them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateLists20260911220000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "lists"');
    expect(queries[1]).toContain("UQ_lists_user_preset");
    expect(queries[2]).toContain('CREATE TABLE "list_items"');
    expect(queries[3]).toContain("UQ_list_items_list_event");
    // Deleting a list of one's own takes its items with it; without the cascade they would be orphans
    // the service would have to sweep by hand.
    expect(queries[2]).toContain('FOREIGN KEY ("listId") REFERENCES "lists"("id") ON DELETE CASCADE');
    // A custom list is preset NULL, so the uniqueness index must not cover it.
    expect(queries[1]).toContain('WHERE "preset" IS NOT NULL');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain("UQ_list_items_list_event");
    expect(queries[1]).toContain('DROP TABLE "list_items"');
    expect(queries[3]).toContain('DROP TABLE "lists"');
  });
});

describe("AddListItemPlaceUnique20260919120400", () => {
  it("adds a partial unique index on list place items", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddListItemPlaceUnique20260919120400();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('DELETE FROM "list_items"');
    expect(queries[1]).toContain("UQ_list_items_list_place");
    expect(queries[1]).toContain('WHERE "placeId" IS NOT NULL');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain("UQ_list_items_list_place");
  });
});

describe("AddListMembers20260919150000", () => {
  it("creates list_members and addedByUserId, and drops them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddListMembers20260919150000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "list_members"');
    expect(queries[0]).toContain('CONSTRAINT "UQ_list_members_list_user" UNIQUE ("listId", "userId")');
    expect(queries[1]).toContain('"addedByUserId"');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain("FK_list_items_added_by");
    expect(queries[2]).toContain('DROP TABLE "list_members"');
  });
});

describe("AddListItemFeedPost20260920190000", () => {
  it("lets a list item reference a feed post instead of an event or a place", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    await new AddListItemFeedPost20260920190000().up(queryRunner);

    expect(queries.some((sql) => sql.includes('DROP CONSTRAINT "CHK_list_items_target"'))).toBe(true);
    expect(queries.some((sql) => sql.includes('"feedPostId" uuid'))).toBe(true);
    const check = queries.find((sql) => sql.includes('ADD CONSTRAINT "CHK_list_items_target"'));
    expect(check).toBeDefined();
    expect(check).toContain('"feedPostId"');
    expect(check).toContain("= 1");
    expect(queries.some((sql) => sql.includes("UQ_list_items_list_feed_post"))).toBe(true);
  });

  it("puts the two-way event-or-place check back on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    await new AddListItemFeedPost20260920190000().down(queryRunner);

    expect(queries.some((sql) => sql.includes("DROP INDEX") && sql.includes("UQ_list_items_list_feed_post"))).toBe(true);
    expect(queries.some((sql) => sql.includes("DROP COLUMN") && sql.includes("feedPostId"))).toBe(true);
    const check = queries.find((sql) => sql.includes('ADD CONSTRAINT "CHK_list_items_target"'));
    expect(check).toContain('"eventId" IS NOT NULL');
    expect(check).not.toContain("feedPostId");
  });
});

describe("RelaxListItemTargetCheck20260920200000", () => {
  it("replaces a leftover two-way check so an already-migrated database can store posts", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    await new RelaxListItemTargetCheck20260920200000().up(queryRunner);

    expect(queries[0]).toContain("DROP CONSTRAINT IF EXISTS");
    expect(queries[0]).toContain("CHK_list_items_target");
    expect(queries[1]).toContain("ADD CONSTRAINT");
    expect(queries[1]).toContain('"feedPostId"');
    expect(queries[1]).toContain("= 1");
  });
});
