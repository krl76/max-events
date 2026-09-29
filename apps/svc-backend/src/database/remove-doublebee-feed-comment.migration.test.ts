import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { RemoveDoublebeeFeedComment20260929180000 } from "./migrations/20260929180000-RemoveDoublebeeFeedComment";

describe("RemoveDoublebeeFeedComment20260929180000", () => {
  it("deletes Raul Ivanov's comment on the Doublebee post and leaves the post", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
        return [];
      },
    } as unknown as QueryRunner;

    await new RemoveDoublebeeFeedComment20260929180000().up(queryRunner);

    const sql = queries.join("\n");
    expect(sql).toContain("DELETE FROM feed_comments");
    expect(sql).toContain("Жанна хороша");
    expect(sql).toContain("кофе у окна");
    expect(sql).toContain("raul ivanov");
    expect(sql).not.toContain("DELETE FROM feed_posts");
  });
});
