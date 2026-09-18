import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreatePayments20260912210000 } from "../database/migrations/20260912210000-CreatePayments";

describe("CreatePayments20260912210000", () => {
  it("creates the payments table with a unique booking id", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreatePayments20260912210000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE "payments"');
    expect(queries[0]).toContain("UQ_payments_booking");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "payments"`]);
  });
});
