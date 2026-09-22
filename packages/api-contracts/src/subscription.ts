// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for catalog subscriptions (organizer, place, interest).
// SCOPE: Subscription type enum, subscription record (with the target's display title, since a uuid is not something a person can read in a list), create payload (discriminated by type).
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SubscriptionTypeSchema - organizer | place | interest
// - SubscriptionType - subscription type
// - SubscriptionSchema - persisted subscription (exactly one target)
// - Subscription - subscription type
// - CreateSubscriptionSchema - write payload discriminated by type
// - CreateSubscription - write payload type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const SubscriptionTypeSchema = z.enum(["organizer", "place", "interest"]);
export type SubscriptionType = z.infer<typeof SubscriptionTypeSchema>;

export const SubscriptionSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    type: SubscriptionTypeSchema,
    organizerUserId: IdSchema.nullable().default(null),
    placeId: IdSchema.nullable().default(null),
    interest: z.string().min(1).max(200).nullable().default(null),
    /** What the subscription is called on screen: the place, the organization or the interest itself. */
    title: z.string().min(1).max(200),
    createdAt: TimestampSchema,
  })
  .superRefine((data, ctx) => {
    const organizer = data.type === "organizer" && data.organizerUserId !== null && data.placeId === null && data.interest === null;
    const place = data.type === "place" && data.placeId !== null && data.organizerUserId === null && data.interest === null;
    const interest = data.type === "interest" && data.interest !== null && data.organizerUserId === null && data.placeId === null;
    if (!organizer && !place && !interest) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "subscription target must match type" });
    }
  });
export type Subscription = z.infer<typeof SubscriptionSchema>;

export const CreateSubscriptionSchema = z.discriminatedUnion("type", [z.object({ type: z.literal("organizer"), organizerUserId: IdSchema }), z.object({ type: z.literal("place"), placeId: IdSchema }), z.object({ type: z.literal("interest"), interest: z.string().min(1).max(200) })]);
export type CreateSubscription = z.infer<typeof CreateSubscriptionSchema>;
