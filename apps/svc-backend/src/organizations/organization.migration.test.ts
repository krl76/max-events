import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateOrganizations20260916020000 } from "../database/migrations/20260916020000-CreateOrganizations";

describe("CreateOrganizations20260916020000", () => {
  it("creates organizations with a unique login and drops the table on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateOrganizations20260916020000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "organizations"');
    expect(queries[0]).toContain('CONSTRAINT "UQ_organizations_login" UNIQUE ("login")');
    // The hash column must exist and be required: an account without one could never authenticate.
    expect(queries[0]).toContain('"passwordHash" character varying(255) NOT NULL');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP TABLE "organizations"');
  });
});
