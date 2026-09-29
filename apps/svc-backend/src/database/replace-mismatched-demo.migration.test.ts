import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { ReplaceMismatchedDemoContent20260928180000 } from "./migrations/20260928180000-ReplaceMismatchedDemoContent";

describe("ReplaceMismatchedDemoContent20260928180000", () => {
  it("removes the mismatched demo rows and writes scenes whose photo matches the words", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new ReplaceMismatchedDemoContent20260928180000();

    await migration.up(queryRunner);
    const sql = queries.join("\n");

    expect(sql).toContain("Помощь пожилым соседям");
    expect(sql).toContain("Благоустройство школьного двора");
    expect(sql).toContain("Вход по предварительной регистрации, приходите за 15 минут до начала.");
    expect(sql).toContain("№[0-9]+$");
    expect(sql).toContain("IS DISTINCT FROM 'kudago'");
    expect(sql).toContain("Турнир по настольному теннису");
    expect(sql).toContain(`"organizerOrganizationId" IS NOT NULL`);
    expect(sql).toContain("picsum.photos");
    expect(sql).toContain(`"avatarUrl" = NULL`);
    expect(sql).toContain("/covers/visits/tsaritsyno.jpg");
    expect(sql).toContain("/covers/visits/tsaritsyno-me.jpg");
    expect(sql).toContain("/covers/visits/cleanup.jpg");
    expect(sql).toContain("Экскурсия по Царицыну. Я у пруда, дворец за спиной — так и хотела снять.");
    expect(sql).toContain("Субботник в Измайловском парке. Мешок собрали вдвоём и сразу сфотографировались.");
    expect(sql).toContain('DELETE FROM "events" AS e');
    expect(sql).toContain('e."title" NOT IN');

    queries.length = 0;
    await migration.down(queryRunner);
    const down = queries.join("\n");
    expect(down).toContain("Экскурсия по Царицыну");
    expect(down).toContain("Утренняя йога у арки");
    expect(down).toContain("/covers/visits/tsaritsyno-me.jpg");
  });
});
