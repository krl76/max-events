// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for shared plans ("Совместные планы") tied to an event.
// SCOPE: Plan participant statuses, Plan/CreatePlan schemas, plan card with computed distance.
// DEPENDS: zod, ./primitives.js, ./event.js, ./friends.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlanParticipantStatusSchema - closed participant status enum (invited/confirmed/declined)
// - PlanParticipantStatus - participant status type
// - PlanParticipantSchema - plan participant (friend + status)
// - PlanParticipant - participant type
// - PlanSchema - plan entity (event link, participants, meeting point and time)
// - Plan - plan type
// - CreatePlanSchema - plan creation payload (no id/timestamps)
// - CreatePlan - plan creation payload type
// - PlanCardSchema - response card with computed distance to the meeting point
// - PlanCard - plan card type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";
import { EventSchema } from "./event.js";
import { FriendSchema } from "./friends.js";

export const PlanParticipantStatusSchema = z.enum(["invited", "confirmed", "declined"]);
export type PlanParticipantStatus = z.infer<typeof PlanParticipantStatusSchema>;

export const PlanParticipantSchema = z.object({
  friend: FriendSchema,
  status: PlanParticipantStatusSchema,
});
export type PlanParticipant = z.infer<typeof PlanParticipantSchema>;

export const PlanSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  participants: z.array(PlanParticipantSchema),
  meetingPoint: z.string().min(1).max(300),
  meetingAt: TimestampSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Plan = z.infer<typeof PlanSchema>;

export const CreatePlanSchema = PlanSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type CreatePlan = z.infer<typeof CreatePlanSchema>;

export const PlanCardSchema = z.object({
  plan: PlanSchema,
  event: EventSchema,
  distanceMeters: z.number().int().min(0),
});
export type PlanCard = z.infer<typeof PlanCardSchema>;
