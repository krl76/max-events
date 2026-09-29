import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { AddEventAfishaSource20260927140000 } from "../database/migrations/20260927140000-AddEventAfishaSource";

describe("AddEventAfishaSource20260927140000", () => {
  it("adds the import columns and drops them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => void queries.push(sql) } as unknown as QueryRunner;
    const migration = new AddEventAfishaSource20260927140000();

    await migration.up(queryRunner);
    expect(queries.some((sql) => sql.includes('ADD COLUMN "source"') && sql.includes('"events"'))).toBe(true);
    expect(queries.some((sql) => sql.includes('ADD COLUMN "externalId"') && sql.includes('"events"'))).toBe(true);
    expect(queries.some((sql) => sql.includes('ADD COLUMN "popularity"'))).toBe(true);
    expect(queries.some((sql) => sql.includes("UQ_events_source_externalId"))).toBe(true);
    expect(queries.some((sql) => sql.includes("UQ_places_source_externalId"))).toBe(true);

    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP INDEX "UQ_places_source_externalId"');
    expect(queries.at(-1)).toContain('DROP COLUMN "source"');
  });
});
