import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateEvents20260911130000 } from "../database/migrations/20260911130000-CreateEvents";

describe("CreateEvents20260911130000", () => {
  it("creates events with place FK and paid/free payment CHECK, and drops the table on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateEvents20260911130000();

    await migration.up(queryRunner);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('CREATE TABLE "events"');
    expect(queries[0]).toContain('FOREIGN KEY ("placeId") REFERENCES "places"("id")');
    expect(queries[0]).toContain('"isPaid" = true AND "paymentUrl" IS NOT NULL');
    expect(queries[0]).toContain('"published" boolean NOT NULL DEFAULT true');

    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual(['DROP TABLE "events"']);
  });
});
