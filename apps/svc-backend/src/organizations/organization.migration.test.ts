import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateOrganizations20260916020000 } from "../database/migrations/20260916020000-CreateOrganizations";
import { AddOrganizationOrganizerUserId20260919130000 } from "../database/migrations/20260919130000-AddOrganizationOrganizerUserId";

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

describe("AddOrganizationOrganizerUserId20260919130000", () => {
  it("adds the organizer column and its foreign key only where they are missing, and takes both away on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddOrganizationOrganizerUserId20260919130000();
    await migration.up(queryRunner);
    // Production applied the first version of CreateOrganizations, without this column; staging the edited one, with it.
    // The same migration must run clean on both, so every statement is guarded.
    expect(queries).toHaveLength(2);
    expect(queries[0]).toBe('ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "organizerUserId" uuid');
    expect(queries[1]).toContain("IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_organizations_organizer_user')");
    expect(queries[1]).toContain('FOREIGN KEY ("organizerUserId") REFERENCES "users"("id") ON DELETE SET NULL');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual(['ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "FK_organizations_organizer_user"', 'ALTER TABLE "organizations" DROP COLUMN IF EXISTS "organizerUserId"']);
  });
});
