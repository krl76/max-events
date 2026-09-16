import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreatePlaces20260911120000 } from "../database/migrations/20260911120000-CreatePlaces";

describe("CreatePlaces20260911120000", () => {
  it("creates places with geo columns and unique title+address+city, and drops the table on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreatePlaces20260911120000();

    await migration.up(queryRunner);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('CREATE TABLE "places"');
    expect(queries[0]).toContain('"latitude" double precision NOT NULL');
    expect(queries[0]).toContain('"longitude" double precision NOT NULL');
    expect(queries[0]).toContain('UNIQUE ("title", "address", "city")');

    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual(['DROP TABLE "places"']);
  });
});
