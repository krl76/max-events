// START_MODULE_CONTRACT
// PURPOSE: Freeze platform ticket commission at payment success (gross / fee / net).
// SCOPE: splitTicketSale; freezeCommission no-ops once commissionFixedAt is set.
// DEPENDS: ./payment.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DEFAULT_COMMISSION_BPS - 10% platform fee
// - TicketSaleSplit - commission and net
// - splitTicketSale - floor(gross * bps / 10000)
// - freezeCommission - write-once on succeeded payments
// END_MODULE_MAP

import type { PaymentEntity } from "./payment.entity";

export const DEFAULT_COMMISSION_BPS = 1000;

export type TicketSaleSplit = { commissionRub: number; netRub: number };

export function splitTicketSale(grossRub: number, bps: number): TicketSaleSplit {
  const rate = Math.min(10_000, Math.max(0, Math.trunc(bps)));
  const commissionRub = Math.floor((grossRub * rate) / 10_000);
  return { commissionRub, netRub: grossRub - commissionRub };
}

export function freezeCommission(row: PaymentEntity, bps: number, now = new Date()): void {
  if (row.commissionFixedAt || row.status !== "succeeded") return;
  const split = splitTicketSale(row.amountRub, bps);
  row.commissionBps = Math.min(10_000, Math.max(0, Math.trunc(bps)));
  row.commissionRub = split.commissionRub;
  row.netRub = split.netRub;
  row.commissionFixedAt = now;
}
