import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreatePayments20260912210000 } from "../database/migrations/20260912210000-CreatePayments";
import { CreatePaymentWebhookEvents20260913010000 } from "../database/migrations/20260913010000-CreatePaymentWebhookEvents";

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

describe("CreatePaymentWebhookEvents20260913010000", () => {
  it("creates the webhook journal and a unique provider payment index", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new CreatePaymentWebhookEvents20260913010000();
    await migration.up(queryRunner);
    expect(queries[0]).toContain(`CREATE UNIQUE INDEX "UQ_payments_provider_payment"`);
    expect(queries[1]).toContain('CREATE TABLE "payment_webhook_events"');
    expect(queries[1]).toContain("UQ_payment_webhook_events_provider_event");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "payment_webhook_events"`, `DROP INDEX "UQ_payments_provider_payment"`]);
  });
});
