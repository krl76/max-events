// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for a booking payment (provider charge linked 1:1 to a booking).
// SCOPE: payment status enum, Payment entity, webhook write, frozen commission, organizer sales report.
// DEPENDS: zod, ./primitives.js, ./stats.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PaymentStatusSchema - pending/succeeded/failed/cancelled/refunded
// - PaymentStatus - status type
// - PaymentSchema - booking payment
// - Payment - payment type
// - PaymentWebhookWriteSchema - provider webhook payload
// - PaymentWebhookWrite - webhook write type
// - EventSalesRowSchema - one frozen ticket sale
// - EventSalesRow - sales row type
// - EventSalesReportSchema - organizer totals over a reporting period
// - EventSalesReport - report type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";
import { StatsPeriodSchema } from "./stats.js";

export const PaymentStatusSchema = z.enum(["pending", "succeeded", "failed", "cancelled", "refunded"]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PaymentSchema = z.object({
  id: IdSchema,
  bookingId: IdSchema,
  providerPaymentId: z.string().min(1),
  status: PaymentStatusSchema,
  amountRub: z.number().int().positive(),
  currency: z.literal("RUB"),
  description: z.string().min(1).max(300),
  commissionRub: z.number().int().nonnegative().nullable().default(null),
  netRub: z.number().int().nonnegative().nullable().default(null),
  commissionBps: z.number().int().min(0).max(10_000).nullable().default(null),
  commissionFixedAt: TimestampSchema.nullable().default(null),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Payment = z.infer<typeof PaymentSchema>;

export const PaymentWebhookWriteSchema = z.object({
  eventId: z.string().trim().min(1).max(80),
  paymentId: z.string().trim().min(1).max(80),
  status: PaymentStatusSchema,
});
export type PaymentWebhookWrite = z.infer<typeof PaymentWebhookWriteSchema>;

export const EventSalesRowSchema = z.object({
  paymentId: IdSchema,
  bookingId: IdSchema,
  status: PaymentStatusSchema,
  grossRub: z.number().int().positive(),
  commissionRub: z.number().int().nonnegative(),
  netRub: z.number().int().nonnegative(),
  commissionBps: z.number().int().min(0).max(10_000),
  commissionFixedAt: TimestampSchema,
});
export type EventSalesRow = z.infer<typeof EventSalesRowSchema>;

export const EventSalesReportSchema = z.object({
  eventId: IdSchema,
  period: StatsPeriodSchema.default({ from: null, to: null }),
  rows: z.array(EventSalesRowSchema),
  grossRub: z.number().int().nonnegative(),
  commissionRub: z.number().int().nonnegative(),
  netRub: z.number().int().nonnegative(),
});
export type EventSalesReport = z.infer<typeof EventSalesReportSchema>;
