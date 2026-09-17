import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateLists20260911220000 } from "../database/migrations/20260911220000-CreateLists";

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
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain("UQ_list_items_list_event");
    expect(queries[1]).toContain('DROP TABLE "list_items"');
    expect(queries[3]).toContain('DROP TABLE "lists"');
  });
});
