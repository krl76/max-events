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
// - CreatePromotionWriteSchema - organizer create payload
// - CreatePromotionWrite - write type
// - RecordPromotionPaymentWriteSchema - manual payment stamp
// - RecordPromotionPaymentWrite - payment write type
// END_MODULE_MAP

import { z } from "zod";
import { EventCategorySchema } from "./event.js";
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

export const CreatePromotionWriteSchema = z
  .object({
    type: PromotionTypeSchema,
    startsAt: TimestampSchema,
    endsAt: TimestampSchema,
    tariffCode: z.string().min(1).max(40),
    priceRub: z.number().int().nonnegative(),
    audience: PromotionAudienceSchema.nullable().optional(),
  })
  .refine((row) => new Date(row.endsAt).getTime() >= new Date(row.startsAt).getTime(), { message: "endsAt must not be before startsAt", path: ["endsAt"] })
  .refine((row) => row.type !== "target_collection" || row.audience != null, { message: "target_collection requires audience", path: ["audience"] });
export type CreatePromotionWrite = z.infer<typeof CreatePromotionWriteSchema>;

export const RecordPromotionPaymentWriteSchema = z.object({
  paidAt: TimestampSchema.optional(),
});
export type RecordPromotionPaymentWrite = z.infer<typeof RecordPromotionPaymentWriteSchema>;
