import { describe, expect, it } from "vitest";
import { freezeCommission, splitTicketSale } from "./commission";
import type { PaymentEntity } from "./payment.entity";

describe("splitTicketSale", () => {
  it("takes 10% with floor remainder on the net", () => {
    expect(splitTicketSale(850, 1000)).toEqual({ commissionRub: 85, netRub: 765 });
    expect(splitTicketSale(999, 1000)).toEqual({ commissionRub: 99, netRub: 900 });
    expect(splitTicketSale(1, 1000)).toEqual({ commissionRub: 0, netRub: 1 });
  });
});

describe("freezeCommission", () => {
  it("writes once on succeeded and ignores a later rate change", () => {
    const row = {
      status: "succeeded",
      amountRub: 850,
      commissionRub: null,
      netRub: null,
      commissionBps: null,
      commissionFixedAt: null,
    } as PaymentEntity;
    const now = new Date("2026-09-13T10:00:00Z");
    freezeCommission(row, 1000, now);
    expect(row.commissionRub).toBe(85);
    expect(row.netRub).toBe(765);
    expect(row.commissionBps).toBe(1000);
    expect(row.commissionFixedAt).toBe(now);
    freezeCommission(row, 500, new Date("2026-09-14T10:00:00Z"));
    expect(row.commissionRub).toBe(85);
    expect(row.commissionBps).toBe(1000);
    expect(row.commissionFixedAt).toBe(now);
  });

  it("does not freeze a failed payment", () => {
    const row = { status: "failed", amountRub: 850, commissionFixedAt: null } as PaymentEntity;
    freezeCommission(row, 1000);
    expect(row.commissionFixedAt).toBeNull();
  });
});
