import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { WidenFeedPostPhoto20260917010000 } from "../database/migrations/20260917010000-WidenFeedPostPhoto";

describe("WidenFeedPostPhoto20260917010000", () => {
  it("widens photoUrl to text so a stored photo fits", async () => {
    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => void queries.push(sql) } as unknown as QueryRunner;

    await new WidenFeedPostPhoto20260917010000().up(queryRunner);

    expect(queries).toEqual(['ALTER TABLE "feed_posts" ALTER COLUMN "photoUrl" TYPE text']);
  });

  it("clears what no longer fits before narrowing back, instead of failing mid-table", async () => {
    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => void queries.push(sql) } as unknown as QueryRunner;

    await new WidenFeedPostPhoto20260917010000().down(queryRunner);

    expect(queries[0]).toContain('SET "photoUrl" = NULL WHERE length("photoUrl") > 500');
    expect(queries[1]).toContain("TYPE character varying(500)");
  });
});
