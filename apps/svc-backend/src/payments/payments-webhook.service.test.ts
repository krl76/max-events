import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
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
    createdAt: new Date("2026-09-01T07:00:00Z"),
    updatedAt: new Date("2026-09-01T07:00:00Z"),
  };
}

function createService(payment: PaymentEntity) {
  const payments: PaymentEntity[] = [payment];
  const events: PaymentWebhookEventEntity[] = [];
  const paymentRepo = {
    findOneBy: async (where: { providerPaymentId: string }) => payments.find((row) => row.providerPaymentId === where.providerPaymentId) ?? null,
    save: async (entity: PaymentEntity) => entity,
  };
  const eventRepo = {
    findOneBy: async (where: { providerEventId: string }) => events.find((row) => row.providerEventId === where.providerEventId) ?? null,
    create: (fields: Partial<PaymentWebhookEventEntity>) => ({ ...fields }) as PaymentWebhookEventEntity,
    save: async (entity: PaymentWebhookEventEntity) => {
      if (events.some((row) => row.providerEventId === entity.providerEventId)) {
        throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate"), { code: "23505" }));
      }
      events.push(entity);
      return entity;
    },
  };
  const service = new PaymentsWebhookService(paymentRepo as unknown as Repository<PaymentEntity>, eventRepo as unknown as Repository<PaymentWebhookEventEntity>);
  return { service, payments, events };
}

function signed(body: object) {
  const raw = JSON.stringify(body);
  return { raw, signature: signPaymentWebhook(secret, raw) };
}

describe("PaymentsWebhookService", () => {
  it("rejects a missing secret or a bad signature", async () => {
    const { service } = createService(paymentRow());
    const { raw, signature } = signed({ eventId: "evt_1", paymentId: providerPaymentId, status: "succeeded" });
    await expect(service.handleWebhook(raw, signature, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.handleWebhook(raw, "ab", secret)).rejects.toBeInstanceOf(UnauthorizedException);
    const broken = "{";
    await expect(service.handleWebhook(broken, signPaymentWebhook(secret, broken), secret)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("applies a succeeded status once and ignores a duplicate delivery", async () => {
    const { service, payments, events } = createService(paymentRow("pending"));
    const body = { eventId: "evt_1", paymentId: providerPaymentId, status: "succeeded" as const };
    const { raw, signature } = signed(body);
    expect(await service.handleWebhook(raw, signature, secret)).toEqual({ duplicate: false, applied: true });
    expect(payments[0]?.status).toBe("succeeded");
    expect(events).toHaveLength(1);
    expect(await service.handleWebhook(raw, signature, secret)).toEqual({ duplicate: true, applied: false });
    expect(payments[0]?.status).toBe("succeeded");
    expect(events).toHaveLength(1);
  });

  it("journals an illegal transition without changing the payment", async () => {
    const { service, payments } = createService(paymentRow("succeeded"));
    const { raw, signature } = signed({ eventId: "evt_2", paymentId: providerPaymentId, status: "pending" });
    expect(await service.handleWebhook(raw, signature, secret)).toEqual({ duplicate: false, applied: false });
    expect(payments[0]?.status).toBe("succeeded");
  });
});
