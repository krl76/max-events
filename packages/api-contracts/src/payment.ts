// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for a booking payment (provider charge linked 1:1 to a booking).
// SCOPE: payment status enum, Payment entity, optional attach on BookingWithSeats.
// DEPENDS: zod, ./primitives.js
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
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

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
