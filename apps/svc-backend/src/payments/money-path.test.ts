import { describe, expect, it } from "vitest";
import type { DataSource, EntityManager, EntityTarget, Repository } from "typeorm";
import { PaymentWebhookEventEntity } from "./payment-webhook-event.entity";
import { PaymentEntity } from "./payment.entity";
import { PaymentsWebhookService } from "./payments-webhook.service";
import { PaymentsService } from "./payments.service";
import { SandboxPaymentProvider, SANDBOX_FAIL_AMOUNT } from "./sandbox-payment.provider";
import { signPaymentWebhook } from "./webhook-signature";

const secret = "test-webhook-secret";
const bookingOk = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d10";
const bookingFail = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d11";

function createRows() {
  const store: PaymentEntity[] = [];
  return {
    store,
    find: async () => store,
    findOneBy: async (where: { bookingId?: string; providerPaymentId?: string }) => store.find((row) => (where.bookingId ? row.bookingId === where.bookingId : row.providerPaymentId === where.providerPaymentId)) ?? null,
    create: (fields: Partial<PaymentEntity>) => ({ ...fields }) as PaymentEntity,
    save: async (entity: PaymentEntity) => {
      const index = store.findIndex((row) => row === entity || (entity.id && row.id === entity.id));
      if (index >= 0) {
        store[index] = entity;
        return entity;
      }
      entity.id ??= `018f3c5a-9b2e-7d21-9f3a-${String(store.length + 1).padStart(12, "0")}`;
      entity.createdAt ??= new Date("2026-09-01T07:00:00Z");
      entity.updatedAt ??= new Date("2026-09-01T07:00:00Z");
      store.push(entity);
      return entity;
    },
  };
}

describe("money path", () => {
  it("covers success, decline, duplicate webhook, refund, and reconciliation drift", async () => {
    const rows = createRows();
    const provider = new SandboxPaymentProvider();
    const payments = new PaymentsService(provider, rows as unknown as Repository<PaymentEntity>, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    const ok = await payments.ensureForBooking(bookingOk, 850, "Билет: Джаз");
    expect(ok.status).toBe("succeeded");
    expect(ok.commissionRub).toBe(85);
    const declined = await payments.ensureForBooking(bookingFail, SANDBOX_FAIL_AMOUNT, "Билет: Джаз");
    expect(declined.status).toBe("failed");

    const events: PaymentWebhookEventEntity[] = [];
    const dataSource = {
      transaction: async <T>(run: (manager: EntityManager) => Promise<T>): Promise<T> => {
        const manager = {
          findOne: async (entity: EntityTarget<unknown>, options: { where: Record<string, string> }) => {
            if (entity === PaymentWebhookEventEntity) return events.find((row) => row.providerEventId === options.where.providerEventId) ?? null;
            if (entity === PaymentEntity) return rows.store.find((row) => row.providerPaymentId === options.where.providerPaymentId) ?? null;
            return null;
          },
          create: (_entity: EntityTarget<unknown>, fields: object) => ({ ...fields }),
          save: async (entity: EntityTarget<unknown>, record: object) => {
            if (entity === PaymentWebhookEventEntity) {
              events.push(record as PaymentWebhookEventEntity);
              return record;
            }
            return record;
          },
        };
        return run(manager as unknown as EntityManager);
      },
    };
    const webhooks = new PaymentsWebhookService(dataSource as unknown as DataSource, { get: () => 1000 } as never);
    const pending = rows.store.find((row) => row.bookingId === bookingOk)!;
    pending.status = "pending";
    pending.commissionFixedAt = null;
    pending.commissionRub = null;
    pending.netRub = null;
    pending.commissionBps = null;
    const body = { eventId: "evt_dup", paymentId: pending.providerPaymentId, status: "succeeded" as const };
    const raw = JSON.stringify(body);
    const signature = signPaymentWebhook(secret, raw);
    expect(await webhooks.handleWebhook(raw, signature, secret)).toEqual({ duplicate: false, applied: true });
    expect(await webhooks.handleWebhook(raw, signature, secret)).toEqual({ duplicate: true, applied: false });
    expect(pending.status).toBe("succeeded");
    expect(pending.commissionRub).toBe(85);

    const refunded = await payments.refundForBooking(bookingOk);
    expect(refunded?.status).toBe("refunded");

    pending.status = "succeeded";
    const drift = await payments.reconcile();
    expect(drift.some((row) => row.internal === "succeeded" && row.provider === "refunded")).toBe(true);
  });
});
