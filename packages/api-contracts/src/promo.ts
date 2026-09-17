// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for organizer promocodes and early-access booking window.
// SCOPE: promo code entity, create write, early-access write, booking list row with applied code.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PromoCodeSchema - promocode entity
// - PromoCode - type
// - CreatePromoCodeWriteSchema - organizer create payload
// - CreatePromoCodeWrite - write type
// - EarlyAccessWriteSchema - bookingOpensAt window
// - EarlyAccessWrite - write type
// - OrganizerBookingRowSchema - booking plus applied promo
// - OrganizerBookingRow - row type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";
import { BookingStatusSchema } from "./booking.js";

export const PromoCodeSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  code: z.string().min(1).max(40),
  maxRedemptions: z.number().int().positive().nullable(),
  redeemedCount: z.number().int().min(0),
  expiresAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});
export type PromoCode = z.infer<typeof PromoCodeSchema>;

export const CreatePromoCodeWriteSchema = z.object({
  code: z.string().min(1).max(40),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  expiresAt: TimestampSchema.nullable().optional(),
});
export type CreatePromoCodeWrite = z.infer<typeof CreatePromoCodeWriteSchema>;

export const EarlyAccessWriteSchema = z.object({
  bookingOpensAt: TimestampSchema,
});
export type EarlyAccessWrite = z.infer<typeof EarlyAccessWriteSchema>;

export const OrganizerBookingRowSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  eventId: IdSchema,
  status: BookingStatusSchema,
  promoCode: z.string().nullable(),
  createdAt: TimestampSchema,
});
export type OrganizerBookingRow = z.infer<typeof OrganizerBookingRowSchema>;
