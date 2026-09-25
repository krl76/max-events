import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { NonePaymentProvider } from "./none-payment.provider";
import { PaymentEntity } from "./payment.entity";
import { PaymentProviderError, type CreatePaymentInput, type PaymentProvider } from "./payment-provider";
import { PaymentsService } from "./payments.service";
import { SANDBOX_FAIL_AMOUNT, SandboxPaymentProvider } from "./sandbox-payment.provider";

const bookingId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d10";

// Sandbox charges plus a record of every refund the domain asked the provider for.
function countingProvider(refundOverride?: () => Promise<never>) {
  const sandbox = new SandboxPaymentProvider();
  const refundKeys: Array<string | undefined> = [];
  const provider: PaymentProvider = {
    create: (input: CreatePaymentInput) => sandbox.create(input),
    getStatus: (paymentId: string) => sandbox.getStatus(paymentId),
    refund: async (paymentId: string, amountRub?: number, idempotencyKey?: string) => {
      refundKeys.push(idempotencyKey);
      if (refundOverride) return refundOverride();
      return sandbox.refund(paymentId, amountRub, idempotencyKey);
    },
  };
  return { provider, refundKeys };
}

function seedPayment(status: PaymentEntity["status"], providerPaymentId: string): PaymentEntity {
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
  } as PaymentEntity;
}

function createRows() {
  const store: PaymentEntity[] = [];
  const rows = {
    store,
    findOneBy: async (where: { bookingId: string }) => store.find((row) => row.bookingId === where.bookingId) ?? null,
    find: async () => store,
    create: (fields: Partial<PaymentEntity>) => ({ ...fields }) as PaymentEntity,
    update: async (criteria: Partial<PaymentEntity>, patch: Partial<PaymentEntity>) => {
      const matched = store.filter((row) => Object.entries(criteria).every(([key, value]) => (row as unknown as Record<string, unknown>)[key] === value));
      for (const row of matched) Object.assign(row, patch);
      return { affected: matched.length };
    },
    save: async (entity: PaymentEntity) => {
      const index = store.findIndex((row) => row === entity || (entity.id && row.id === entity.id));
      if (index >= 0) {
        store[index] = entity;
        return entity;
      }
      if (store.some((row) => row.bookingId === entity.bookingId)) {
        throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate"), { code: "23505" }));
      }
      entity.id ??= "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d11";
      entity.createdAt ??= new Date("2026-09-01T07:00:00Z");
      entity.updatedAt ??= new Date("2026-09-01T07:00:00Z");
      store.push(entity);
      return entity;
    },
  };
  return rows;
}

describe("PaymentsService.ensureForBooking", () => {
  it("creates one payment per booking and reuses it", async () => {
    const rows = createRows();
    const service = new PaymentsService(new SandboxPaymentProvider(), rows as unknown as Repository<PaymentEntity>, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    const first = await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    expect(first?.status).toBe("succeeded");
    expect(first?.amountRub).toBe(850);
    expect(first?.commissionRub).toBe(85);
    expect(first?.netRub).toBe(765);
    expect(first?.commissionBps).toBe(1000);
    expect(first?.commissionFixedAt).toBeTruthy();
    expect(rows.store[0]?.commissionRub).toBe(85);
    expect(rows.store[0]?.commissionFixedAt).toBeInstanceOf(Date);
    expect(first?.bookingId).toBe(bookingId);
    const second = await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    expect(second?.id).toBe(first?.id);
    expect(rows.store).toHaveLength(1);
  });

  it("reloads the winner when a concurrent insert hits unique bookingId", async () => {
    const rows = createRows();
    const service = new PaymentsService(new SandboxPaymentProvider(), rows as unknown as Repository<PaymentEntity>, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    const first = await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    let misses = 1;
    const originalFind = rows.findOneBy.bind(rows);
    rows.findOneBy = async (where: { bookingId: string }) => {
      if (misses > 0) {
        misses -= 1;
        return null;
      }
      return originalFind(where);
    };
    const second = await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    expect(second?.id).toBe(first?.id);
    expect(rows.store).toHaveLength(1);
  });

  it("heals a succeeded payment that was stored without a freeze", async () => {
    const rows = createRows();
    const unfrozen = {
      id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d11",
      bookingId,
      providerPaymentId: "pay_sandbox_old",
      status: "succeeded" as const,
      amountRub: 850,
      currency: "RUB" as const,
      description: "Билет: Джаз",
      commissionRub: null,
      netRub: null,
      commissionBps: null,
      commissionFixedAt: null,
      createdAt: new Date("2026-09-01T07:00:00Z"),
      updatedAt: new Date("2026-09-01T07:00:00Z"),
    } as PaymentEntity;
    rows.store.push(unfrozen);
    const service = new PaymentsService(new SandboxPaymentProvider(), rows as unknown as Repository<PaymentEntity>, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    const healed = await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    expect(healed?.commissionRub).toBe(85);
    expect(rows.store[0]?.netRub).toBe(765);
    expect(rows.store[0]?.commissionFixedAt).toBeInstanceOf(Date);
  });

  it("reports frozen sales for the organizer and ignores unfixed rows", async () => {
    const rows = createRows();
    const eventId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d20";
    const organizerId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d21";
    const events = {
      findOneBy: async (where: { id: string; organizerUserId: string }) => (where.id === eventId && where.organizerUserId === organizerId ? { id: eventId, organizerUserId: organizerId } : null),
    };
    const bookings = { find: async () => [{ id: bookingId, eventId }] };
    const service = new PaymentsService(new SandboxPaymentProvider(), rows as unknown as Repository<PaymentEntity>, events as never, bookings as never, { get: (key: string) => (key === "PAYMENT_PROVIDER" ? "sandbox" : 1000) } as never);
    await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    rows.store.push({
      id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d12",
      bookingId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d13",
      providerPaymentId: "pay_fail",
      status: "failed",
      amountRub: 850,
      currency: "RUB",
      description: "fail",
      commissionRub: null,
      netRub: null,
      commissionBps: null,
      commissionFixedAt: null,
      createdAt: new Date("2026-09-01T07:00:00Z"),
      updatedAt: new Date("2026-09-01T07:00:00Z"),
    } as PaymentEntity);
    const report = await service.salesReport(organizerId, eventId);
    expect(report.grossRub).toBe(850);
    expect(report.commissionRub).toBe(85);
    expect(report.netRub).toBe(765);
    expect(report.rows).toHaveLength(1);
    expect(report.provider).toBe("sandbox");
    await expect(service.salesReport("018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d99", eventId)).rejects.toMatchObject({ status: 404 });
    const refunded = await service.refundForBooking(bookingId);
    expect(refunded?.status).toBe("refunded");
    const afterRefund = await service.salesReport(organizerId, eventId);
    expect(afterRefund.rows).toHaveLength(0);
    expect(afterRefund.grossRub).toBe(0);
    const drift = await service.reconcile();
    expect(drift.some((row) => row.internal === "refunded" && row.provider === "refunded")).toBe(false);
  });
});

describe("PaymentsService.ensureForBooking disabled provider and retries", () => {
  it("returns null and stores nothing when payments are disabled", async () => {
    const rows = createRows();
    const service = new PaymentsService(new NonePaymentProvider(), rows as unknown as Repository<PaymentEntity>, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    const payment = await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    expect(payment).toBeNull();
    expect(rows.store).toHaveLength(0);
  });

  it("re-arms a failed payment as a new provider charge", async () => {
    const rows = createRows();
    const service = new PaymentsService(new SandboxPaymentProvider(), rows as unknown as Repository<PaymentEntity>, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    const failed = await service.ensureForBooking(bookingId, SANDBOX_FAIL_AMOUNT, "Билет: Джаз");
    expect(failed?.status).toBe("failed");
    const retried = await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    expect(retried?.status).toBe("succeeded");
    expect(retried?.providerPaymentId).not.toBe(failed?.providerPaymentId);
    expect(retried?.commissionRub).toBe(85);
    expect(rows.store).toHaveLength(1);
    expect(rows.store[0]?.providerPaymentId).toBe(retried?.providerPaymentId);
  });

  it("keeps a pending payment untouched without a new charge", async () => {
    const rows = createRows();
    rows.store.push({
      id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d11",
      bookingId,
      providerPaymentId: "pay_sandbox_pending",
      status: "pending",
      amountRub: 850,
      currency: "RUB",
      description: "Билет: Джаз",
      commissionRub: null,
      netRub: null,
      commissionBps: null,
      commissionFixedAt: null,
      createdAt: new Date("2026-09-01T07:00:00Z"),
      updatedAt: new Date("2026-09-01T07:00:00Z"),
    } as PaymentEntity);
    const service = new PaymentsService(new SandboxPaymentProvider(), rows as unknown as Repository<PaymentEntity>, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    const same = await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    expect(same?.providerPaymentId).toBe("pay_sandbox_pending");
    expect(same?.status).toBe("pending");
    expect(rows.store).toHaveLength(1);
  });

  it("re-arms a cancelled payment as a new provider charge", async () => {
    const rows = createRows();
    rows.store.push(seedPayment("cancelled", "pay_sandbox_cancelled"));
    const service = new PaymentsService(new SandboxPaymentProvider(), rows as unknown as Repository<PaymentEntity>, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    const retried = await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    expect(retried?.status).toBe("succeeded");
    expect(retried?.providerPaymentId).not.toBe("pay_sandbox_cancelled");
    expect(rows.store).toHaveLength(1);
    expect(rows.store[0]?.status).toBe("succeeded");
  });

  it("shares one provider charge across concurrent retries of a failed payment", async () => {
    const rows = createRows();
    const service = new PaymentsService(new SandboxPaymentProvider(), rows as unknown as Repository<PaymentEntity>, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    const failed = await service.ensureForBooking(bookingId, SANDBOX_FAIL_AMOUNT, "Билет: Джаз");
    const [first, second] = await Promise.all([service.ensureForBooking(bookingId, 850, "Билет: Джаз"), service.ensureForBooking(bookingId, 850, "Билет: Джаз")]);
    expect(first?.providerPaymentId).toBe(second?.providerPaymentId);
    expect(first?.providerPaymentId).not.toBe(failed?.providerPaymentId);
    expect(rows.store).toHaveLength(1);
  });
});

describe("PaymentsService.refundForBooking", () => {
  it("moves money once when two cancels race on the same booking", async () => {
    const rows = createRows();
    const { provider, refundKeys } = countingProvider();
    const service = new PaymentsService(provider, rows as unknown as Repository<PaymentEntity>, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    const [first, second] = await Promise.all([service.refundForBooking(bookingId), service.refundForBooking(bookingId)]);
    expect(first?.status).toBe("refunded");
    expect(second?.status).toBe("refunded");
    expect(rows.store[0]?.status).toBe("refunded");
    expect(refundKeys).toEqual([`booking:${bookingId}:refund`]);
  });

  it("releases the claim when the provider refund fails so a retry can refund", async () => {
    const rows = createRows();
    const { provider, refundKeys } = countingProvider(() => {
      throw new PaymentProviderError("provider_unavailable", "Provider is down");
    });
    const service = new PaymentsService(provider, rows as unknown as Repository<PaymentEntity>, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    await expect(service.refundForBooking(bookingId)).rejects.toBeInstanceOf(PaymentProviderError);
    expect(rows.store[0]?.status).toBe("succeeded");
    expect(refundKeys).toHaveLength(1);
  });

  it("leaves a payment that never took money alone", async () => {
    const rows = createRows();
    rows.store.push(seedPayment("failed", "pay_sandbox_failed"));
    const { provider, refundKeys } = countingProvider();
    const service = new PaymentsService(provider, rows as unknown as Repository<PaymentEntity>, { findOneBy: async () => null } as never, { find: async () => [] } as never, { get: () => 1000 } as never);
    const result = await service.refundForBooking(bookingId);
    expect(result?.status).toBe("failed");
    expect(refundKeys).toHaveLength(0);
  });
});
