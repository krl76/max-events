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
    const report = await service.salesReport(organizerId, eventId);
    expect(report.grossRub).toBe(850);
    expect(report.commissionRub).toBe(85);
    expect(report.netRub).toBe(765);
    expect(report.rows).toHaveLength(1);
    await expect(service.salesReport("018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d99", eventId)).rejects.toMatchObject({ status: 404 });
  });
});
