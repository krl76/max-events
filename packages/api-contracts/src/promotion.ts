// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for paid promotion campaigns (boost, banner, pin, target collection).
// SCOPE: campaign type/status, audience for target collections, create write, billing fields.
// DEPENDS: zod, ./primitives.js, ./event.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PromotionTypeSchema - boost / banner / pin / target_collection
// - PromotionType - promotion type
// - PromotionStatusSchema - active or completed
// - PromotionStatus - promotion status type
// - PromotionAudienceSchema - visit-history audience for target collections
// - PromotionAudience - audience type
// - PromotionCampaignSchema - campaign with period and billing
// - PromotionCampaign - campaign type
// - PromotionCampaignPublicSchema - viewer campaign without billing
// - PromotionCampaignPublic - viewer campaign type
// - CreatePromotionWriteSchema - organizer create payload
// - CreatePromotionWrite - write type
// - RecordPromotionPaymentWriteSchema - manual payment stamp
// - RecordPromotionPaymentWrite - payment write type
// - PromotionPinSchema - promoted map pin
// - PromotionPin - pin type
// - PromotionPlacementsSchema - banners, pins, boosted ids
// - PromotionPlacements - placements type
// - TargetedPromotionSchema - visit-history matched campaign
// - TargetedPromotion - targeted row type
// - TargetedPromotionsResponseSchema - for-me payload
// - TargetedPromotionsResponse - for-me type
// END_MODULE_MAP

import { z } from "zod";
import { EventCategorySchema, EventSchema } from "./event.js";
import { PlaceSchema } from "./place.js";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const PromotionTypeSchema = z.enum(["boost", "banner", "pin", "target_collection"]);
export type PromotionType = z.infer<typeof PromotionTypeSchema>;

export const PromotionStatusSchema = z.enum(["active", "completed"]);
export type PromotionStatus = z.infer<typeof PromotionStatusSchema>;

export const PromotionAudienceSchema = z.object({
  minVisits: z.number().int().positive(),
  windowDays: z.number().int().positive(),
  category: EventCategorySchema.optional(),
});
export type PromotionAudience = z.infer<typeof PromotionAudienceSchema>;

export const PromotionCampaignSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  type: PromotionTypeSchema,
  status: PromotionStatusSchema,
  startsAt: TimestampSchema,
  endsAt: TimestampSchema,
  tariffCode: z.string().min(1).max(40),
  priceRub: z.number().int().nonnegative(),
  paidAt: TimestampSchema.nullable(),
  audience: PromotionAudienceSchema.nullable(),
  createdAt: TimestampSchema,
  completedAt: TimestampSchema.nullable(),
});
export type PromotionCampaign = z.infer<typeof PromotionCampaignSchema>;

export const PromotionCampaignPublicSchema = PromotionCampaignSchema.omit({ tariffCode: true, priceRub: true, paidAt: true });
export type PromotionCampaignPublic = z.infer<typeof PromotionCampaignPublicSchema>;

export const CreatePromotionWriteSchema = z
  .object({
    type: PromotionTypeSchema,
    startsAt: TimestampSchema,
    endsAt: TimestampSchema,
    tariffCode: z.string().min(1).max(40),
    priceRub: z.number().int().nonnegative(),
    audience: PromotionAudienceSchema.nullable().optional(),
  })
  .refine((row) => new Date(row.endsAt).getTime() > new Date(row.startsAt).getTime(), { message: "endsAt must not be before startsAt", path: ["endsAt"] })
  .refine((row) => row.type !== "target_collection" || row.audience != null, { message: "target_collection requires audience", path: ["audience"] });
export type CreatePromotionWrite = z.infer<typeof CreatePromotionWriteSchema>;

export const RecordPromotionPaymentWriteSchema = z.object({
  paidAt: TimestampSchema.optional(),
});
export type RecordPromotionPaymentWrite = z.infer<typeof RecordPromotionPaymentWriteSchema>;

export const PromotionPinSchema = z.object({
  event: EventSchema,
  place: PlaceSchema,
});
export type PromotionPin = z.infer<typeof PromotionPinSchema>;

export const PromotionPlacementsSchema = z.object({
  banners: z.array(EventSchema),
  pins: z.array(PromotionPinSchema),
  boostedEventIds: z.array(IdSchema),
});
export type PromotionPlacements = z.infer<typeof PromotionPlacementsSchema>;

export const TargetedPromotionSchema = z.object({
  campaign: PromotionCampaignPublicSchema,
  event: EventSchema,
  explanation: z.string().min(1),
});
export type TargetedPromotion = z.infer<typeof TargetedPromotionSchema>;

export const TargetedPromotionsResponseSchema = z.object({
  collections: z.array(TargetedPromotionSchema),
});
export type TargetedPromotionsResponse = z.infer<typeof TargetedPromotionsResponseSchema>;
