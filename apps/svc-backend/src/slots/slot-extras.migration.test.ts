import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreateSlotExtrasWaitlistChat20260920170000 } from "../database/migrations/20260920170000-CreateSlotExtrasWaitlistChat";

describe("CreateSlotExtrasWaitlistChat20260920170000", () => {
  it("creates extras, waitlist and chat tables", async () => {
    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => queries.push(sql) } as unknown as QueryRunner;
    const migration = new CreateSlotExtrasWaitlistChat20260920170000();
    await migration.up(queryRunner);
    expect(queries.some((sql) => sql.includes("place_extras"))).toBe(true);
    expect(queries.some((sql) => sql.includes("slot_waitlist"))).toBe(true);
    expect(queries.some((sql) => sql.includes("slot_chat_messages"))).toBe(true);
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toHaveLength(3);
  });
});
