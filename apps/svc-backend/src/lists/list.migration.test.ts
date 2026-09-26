import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateLists20260911220000 } from "../database/migrations/20260911220000-CreateLists";
import { AddListItemPlaceUnique20260919120400 } from "../database/migrations/20260919120400-AddListItemPlaceUnique";
import { AddListMembers20260919150000 } from "../database/migrations/20260919150000-AddListMembers";

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
