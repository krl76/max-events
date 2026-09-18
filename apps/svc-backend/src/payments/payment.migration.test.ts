import { describe, expect, it } from "vitest";
import type { QueryRunner } from "typeorm";
import { CreatePayments20260912210000 } from "../database/migrations/20260912210000-CreatePayments";
import { CreatePaymentWebhookEvents20260913010000 } from "../database/migrations/20260913010000-CreatePaymentWebhookEvents";
import { AddPaymentCommission20260913020000 } from "../database/migrations/20260913020000-AddPaymentCommission";

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
    expect(queries[0]).toContain("duplicate payments.providerPaymentId");
    expect(queries[1]).toContain(`CREATE UNIQUE INDEX "UQ_payments_provider_payment"`);
    expect(queries[2]).toContain('CREATE TABLE "payment_webhook_events"');
    expect(queries[2]).toContain("UQ_payment_webhook_events_provider_event");
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries).toEqual([`DROP TABLE "payment_webhook_events"`, `DROP INDEX "UQ_payments_provider_payment"`]);
  });
});

describe("AddPaymentCommission20260913020000", () => {
  it("adds frozen commission columns", async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;
    const migration = new AddPaymentCommission20260913020000();
    await migration.up(queryRunner);
    expect(queries).toEqual([`ALTER TABLE "payments" ADD COLUMN "commissionRub" integer`, `ALTER TABLE "payments" ADD COLUMN "netRub" integer`, `ALTER TABLE "payments" ADD COLUMN "commissionBps" integer`, `ALTER TABLE "payments" ADD COLUMN "commissionFixedAt" TIMESTAMP WITH TIME ZONE`]);
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain("commissionFixedAt");
  });
});
