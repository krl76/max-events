import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateListDigestSends20260912110000 } from "../database/migrations/20260912110000-CreateListDigestSends";

describe("CreateListDigestSends20260912110000", () => {
  it("creates list_digest_sends with a unique fingerprint and drops it on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreateListDigestSends20260912110000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "list_digest_sends"');
    expect(queries[0]).toContain("UQ_list_digest_sends_user_window_fp");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "list_digest_sends"`]);
  });
});
