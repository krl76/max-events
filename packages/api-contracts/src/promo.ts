// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for organizer promocodes and early-access booking window.
// SCOPE: promo code entity, create write, early-access write, booking list row with applied code, refer-a-friend and special-offer campaigns.
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
// - PromoCampaignTypeSchema - refer-a-friend or special offer
// - PromoCampaignType - campaign type enum
// - PromoCampaignStatusSchema - active or completed
// - PromoCampaignStatus - campaign status type
// - PromoCampaignSchema - campaign with fulfillment counters
// - PromoCampaign - campaign type
// - CreatePromoCampaignWriteSchema - organizer create payload
// - CreatePromoCampaignWrite - write type
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

export const PromoCampaignTypeSchema = z.enum(["refer_a_friend", "special_offer"]);
export type PromoCampaignType = z.infer<typeof PromoCampaignTypeSchema>;

export const PromoCampaignStatusSchema = z.enum(["active", "completed"]);
export type PromoCampaignStatus = z.infer<typeof PromoCampaignStatusSchema>;

export const PromoCampaignSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  type: PromoCampaignTypeSchema,
  status: PromoCampaignStatusSchema,
  code: z.string().min(1).max(40),
  title: z.string().min(1).max(200),
  maxFulfillments: z.number().int().positive().nullable(),
  fulfillmentCount: z.number().int().min(0),
  createdAt: TimestampSchema,
  completedAt: TimestampSchema.nullable(),
});
export type PromoCampaign = z.infer<typeof PromoCampaignSchema>;

export const CreatePromoCampaignWriteSchema = z.object({
  type: PromoCampaignTypeSchema,
  code: z.string().min(1).max(40),
  title: z.string().min(1).max(200),
  maxFulfillments: z.number().int().positive().nullable().optional(),
});
export type CreatePromoCampaignWrite = z.infer<typeof CreatePromoCampaignWriteSchema>;
