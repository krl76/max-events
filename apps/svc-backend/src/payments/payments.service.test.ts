import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { PaymentEntity } from "./payment.entity";
import { PaymentsService } from "./payments.service";
import { SandboxPaymentProvider } from "./sandbox-payment.provider";

const bookingId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d10";

function createRows() {
  const store: PaymentEntity[] = [];
  const rows = {
    store,
    findOneBy: async (where: { bookingId: string }) => store.find((row) => row.bookingId === where.bookingId) ?? null,
    find: async () => store,
    create: (fields: Partial<PaymentEntity>) => ({ ...fields }) as PaymentEntity,
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
    expect(first.status).toBe("succeeded");
    expect(first.amountRub).toBe(850);
    expect(first.commissionRub).toBe(85);
    expect(first.netRub).toBe(765);
    expect(first.commissionBps).toBe(1000);
    expect(first.commissionFixedAt).toBeTruthy();
    expect(rows.store[0]?.commissionRub).toBe(85);
    expect(rows.store[0]?.commissionFixedAt).toBeInstanceOf(Date);
    expect(first.bookingId).toBe(bookingId);
    const second = await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    expect(second.id).toBe(first.id);
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
    expect(second.id).toBe(first.id);
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
    expect(healed.commissionRub).toBe(85);
    expect(rows.store[0]?.netRub).toBe(765);
    expect(rows.store[0]?.commissionFixedAt).toBeInstanceOf(Date);
  });

  it("reports frozen sales for the organizer and ignores unfixed rows", async () => {
    const rows = createRows();
    const eventId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d20";
    const organizerId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d21";
    const events = {
      findOneBy: async (where: { id: string; organizerUserId: string }) =>
        where.id === eventId && where.organizerUserId === organizerId ? { id: eventId, organizerUserId: organizerId } : null,
    };
    const bookings = { find: async () => [{ id: bookingId, eventId }] };
    const service = new PaymentsService(new SandboxPaymentProvider(), rows as unknown as Repository<PaymentEntity>, events as never, bookings as never, { get: () => 1000 } as never);
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
    await expect(service.salesReport("018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d99", eventId)).rejects.toMatchObject({ status: 404 });
  });
});
