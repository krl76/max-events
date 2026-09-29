import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { PlainDemoPostCaptions20260928200000 } from "./migrations/20260928200000-PlainDemoPostCaptions";

describe("PlainDemoPostCaptions20260928200000", () => {
  it("replaces photo-taking captions with ordinary ones and restores them on revert", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new PlainDemoPostCaptions20260928200000();

    await migration.up(queryRunner);
    const sql = queries.join("\n");
    expect(sql).toContain('UPDATE "feed_posts"');
    expect(sql).toContain("Я у пруда, дворец за спиной — так и хотела снять.");
    expect(sql).toContain("Гуляли у пруда, Большой дворец напротив.");
    expect(sql).toContain("сразу сфотографировались.");
    expect(sql).toContain("Мешок собрали вдвоём за час.");
    expect(sql).toContain("Утренняя йога у арки Парка Горького. Собрались на лужайке сразу за воротами.");

    queries.length = 0;
    await migration.down(queryRunner);
    const down = queries.join("\n");
    expect(down).toContain("так и хотела снять.");
    expect(down).toContain("Гуляли у пруда, Большой дворец напротив.");
  });
});
