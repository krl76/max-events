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
    const service = new PaymentsService(new SandboxPaymentProvider(), rows as unknown as Repository<PaymentEntity>);
    const first = await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    expect(first.status).toBe("succeeded");
    expect(first.amountRub).toBe(850);
    expect(first.bookingId).toBe(bookingId);
    const second = await service.ensureForBooking(bookingId, 850, "Билет: Джаз");
    expect(second.id).toBe(first.id);
    expect(rows.store).toHaveLength(1);
  });
});
