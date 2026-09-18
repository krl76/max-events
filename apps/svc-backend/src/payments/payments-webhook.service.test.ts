import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type DataSource, type EntityManager, type EntityTarget } from "typeorm";
import { PaymentWebhookEventEntity } from "./payment-webhook-event.entity";
import { PaymentEntity } from "./payment.entity";
import { PaymentsWebhookService } from "./payments-webhook.service";
import { signPaymentWebhook } from "./webhook-signature";

const secret = "test-webhook-secret";
const providerPaymentId = "pay_sandbox_1";
const bookingId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d10";

function paymentRow(status: PaymentEntity["status"] = "pending"): PaymentEntity {
  return {
    id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d11",
    bookingId,
    providerPaymentId,
    status,
    amountRub: 850,
    currency: "RUB",
    description: "Билет: Джаз",
    commissionRub: null,
    netRub: null,
    commissionBps: null,
    commissionFixedAt: null,
    createdAt: new Date("2026-09-01T07:00:00Z"),
    updatedAt: new Date("2026-09-01T07:00:00Z"),
  };
}

function createService(payment: PaymentEntity | null) {
  const payments: PaymentEntity[] = payment ? [payment] : [];
  const events: PaymentWebhookEventEntity[] = [];
  const dataSource = {
    transaction: async <T>(run: (manager: EntityManager) => Promise<T>): Promise<T> => {
      const paymentsSnap = payments.map((row) => ({ ...row }));
      const eventsSnap = events.map((row) => ({ ...row }));
      const manager = {
        findOne: async (entity: EntityTarget<unknown>, options: { where: Record<string, string> }) => {
          const where = options.where;
          if (entity === PaymentWebhookEventEntity) return events.find((row) => row.providerEventId === where.providerEventId) ?? null;
          if (entity === PaymentEntity) return payments.find((row) => row.providerPaymentId === where.providerPaymentId) ?? null;
          return null;
        },
        create: (_entity: EntityTarget<unknown>, fields: object) => ({ ...fields }),
        save: async (entity: EntityTarget<unknown> | object, maybeRecord?: object) => {
          const record = (maybeRecord ?? entity) as PaymentEntity | PaymentWebhookEventEntity;
          if (maybeRecord !== undefined && entity === PaymentWebhookEventEntity) {
            const row = record as PaymentWebhookEventEntity;
            if (events.some((item) => item.providerEventId === row.providerEventId)) {
              throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate"), { code: "23505" }));
            }
            events.push(row);
            return row;
          }
          if (maybeRecord !== undefined && entity === PaymentEntity) {
            const row = record as PaymentEntity;
            const index = payments.findIndex((item) => item.id === row.id);
            if (index >= 0) payments[index] = row;
            return row;
          }
          return record;
        },
      };
      try {
        return await run(manager as unknown as EntityManager);
      } catch (error) {
        payments.length = 0;
        payments.push(...paymentsSnap);
        events.length = 0;
        events.push(...eventsSnap);
        throw error;
      }
    },
  };
  const service = new PaymentsWebhookService(dataSource as unknown as DataSource, { get: () => 1000 } as never);
  return { service, payments, events };
}

function signed(body: object | string) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return { raw, signature: signPaymentWebhook(secret, raw) };
}

describe("PaymentsWebhookService", () => {
  it("rejects a missing secret or a bad signature", async () => {
    const { service } = createService(paymentRow());
    const { raw, signature } = signed({ eventId: "evt_1", paymentId: providerPaymentId, status: "succeeded" });
    await expect(service.handleWebhook(raw, signature, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.handleWebhook(raw, "ab", secret)).rejects.toBeInstanceOf(UnauthorizedException);
    const broken = signed("{");
    await expect(service.handleWebhook(broken.raw, broken.signature, secret)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("applies a succeeded status once and ignores a duplicate delivery", async () => {
    const { service, payments, events } = createService(paymentRow("pending"));
    const body = { eventId: "evt_1", paymentId: providerPaymentId, status: "succeeded" as const };
    const { raw, signature } = signed(body);
    expect(await service.handleWebhook(raw, signature, secret)).toEqual({ duplicate: false, applied: true });
    expect(payments[0]?.status).toBe("succeeded");
    expect(payments[0]?.commissionRub).toBe(85);
    expect(payments[0]?.netRub).toBe(765);
    expect(events).toHaveLength(1);
    expect(await service.handleWebhook(raw, signature, secret)).toEqual({ duplicate: true, applied: false });
    expect(payments[0]?.status).toBe("succeeded");
    expect(payments[0]?.commissionRub).toBe(85);
    expect(payments[0]?.netRub).toBe(765);
    expect(events).toHaveLength(1);
  });

  it("freezes an already-succeeded payment that has no commission yet", async () => {
    const { service, payments } = createService(paymentRow("succeeded"));
    const { raw, signature } = signed({ eventId: "evt_heal", paymentId: providerPaymentId, status: "succeeded" });
    expect(await service.handleWebhook(raw, signature, secret)).toEqual({ duplicate: false, applied: true });
    expect(payments[0]?.commissionRub).toBe(85);
    expect(payments[0]?.netRub).toBe(765);
  });

  it("journals an illegal transition without changing the payment", async () => {
    const { service, payments, events } = createService(paymentRow("succeeded"));
    const { raw, signature } = signed({ eventId: "evt_2", paymentId: providerPaymentId, status: "pending" });
    expect(await service.handleWebhook(raw, signature, secret)).toEqual({ duplicate: false, applied: false });
    expect(payments[0]?.status).toBe("succeeded");
    expect(events).toHaveLength(1);
  });

  it("rolls back the journal when the payment row is missing so the provider can retry", async () => {
    const { service, events } = createService(null);
    const { raw, signature } = signed({ eventId: "evt_3", paymentId: providerPaymentId, status: "succeeded" });
    await expect(service.handleWebhook(raw, signature, secret)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(events).toHaveLength(0);
  });
});
