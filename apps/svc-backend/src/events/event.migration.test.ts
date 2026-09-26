import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateEvents20260911130000 } from "../database/migrations/20260911130000-CreateEvents";
import { AddEventCoverUrl20260919120300 } from "../database/migrations/20260919120300-AddEventCoverUrl";
import { AddOrganizerOrganizationId20260919160000 } from "../database/migrations/20260919160000-AddOrganizerOrganizationId";

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

describe("AddEventCoverUrl20260919120300", () => {
  it("adds coverUrl and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddEventCoverUrl20260919120300();
    await migration.up(queryRunner);
    expect(queries[0]).toContain("coverUrl");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP COLUMN "coverUrl"');
  });
});

describe("AddOrganizerOrganizationId20260919160000", () => {
  it("adds organizerOrganizationId to events and places, backfills from organizations, and drops on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddOrganizerOrganizationId20260919160000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ALTER TABLE "events" ADD COLUMN "organizerOrganizationId"');
    expect(queries[1]).toContain('ALTER TABLE "places" ADD COLUMN "organizerOrganizationId"');
    expect(queries[2]).toContain("UPDATE \"events\"");
    expect(queries[4]).toContain("FK_events_organizer_organization");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[3]).toContain('ALTER TABLE "events" DROP COLUMN "organizerOrganizationId"');
  });
});
