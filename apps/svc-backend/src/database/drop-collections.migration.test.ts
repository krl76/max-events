import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { DropCollections20260919130000 } from "./migrations/20260919130000-DropCollections";

describe("DropCollections20260919130000", () => {
  it("drops collection tables and recreates them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new DropCollections20260919130000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain("collection_items");
    expect(queries[2]).toContain('"collections"');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "collections"');
    expect(queries[2]).toContain("collection_items");
  });
});
