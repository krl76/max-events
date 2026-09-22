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
// - PlanSchema - plan entity (host, event link, participants, meeting point and time, optional chat link, repeat rule and series)
// - Plan - plan type
// - CreatePlanSchema - plan creation payload (no id/timestamps/chatLink)
// - CreatePlan - plan creation payload type
// - PlanCardSchema - response card with computed distance to the meeting point
// - PlanCard - plan card type
// - PlanRecurringRuleSchema - weekly weekday or monthly nth weekday
// - PlanRecurringRule - recurring rule type
// - CreatePlanWriteSchema - HTTP create payload (event + friend ids + meeting)
// - CreatePlanWrite - HTTP create payload type
// - PlanCancelScopeSchema - occurrence | series, what a cancel applies to
// - PlanCancelScope - cancel scope type
// - PlanParticipantWriteSchema - invitee confirm/decline body
// - PlanParticipantWrite - invitee confirm/decline body type
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

export const PlanRecurringRuleSchema = z.discriminatedUnion("type", [z.object({ type: z.literal("weekly_weekday"), weekday: z.number().int().min(1).max(7) }), z.object({ type: z.literal("monthly_nth_weekday"), nth: z.number().int().min(1).max(5), weekday: z.number().int().min(1).max(7) })]);
export type PlanRecurringRule = z.infer<typeof PlanRecurringRuleSchema>;

export const PlanSchema = z.object({
  id: IdSchema,
  /** Who made the plan: only the host may cancel it, so the screen has to know. */
  hostUserId: IdSchema,
  eventId: IdSchema,
  participants: z.array(PlanParticipantSchema),
  meetingPoint: z.string().min(1).max(300),
  meetingAt: TimestampSchema,
  chatLink: z.string().nullable().default(null),
  /** How this plan repeats; an occurrence carries the rule of the series it was spawned from. */
  recurringRule: PlanRecurringRuleSchema.nullable().default(null),
  /** Set on every plan of a repeating series, so a screen can offer «this one» or «the whole series». */
  seriesId: IdSchema.nullable().default(null),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Plan = z.infer<typeof PlanSchema>;

/** The series fields are the backend's answer, not something a caller sets when making a plan. */
export const CreatePlanSchema = PlanSchema.omit({ id: true, hostUserId: true, chatLink: true, recurringRule: true, seriesId: true, createdAt: true, updatedAt: true });
export type CreatePlan = z.infer<typeof CreatePlanSchema>;

export const PlanCardSchema = z.object({
  plan: PlanSchema,
  event: EventSchema,
  distanceMeters: z.number().int().min(0),
});
export type PlanCard = z.infer<typeof PlanCardSchema>;

export const CreatePlanWriteSchema = z.object({
  eventId: IdSchema,
  participantIds: z.array(IdSchema).default([]),
  meetingPoint: z.string().min(1).max(300),
  meetingAt: TimestampSchema,
  recurringRule: PlanRecurringRuleSchema.optional(),
});
export type CreatePlanWrite = z.infer<typeof CreatePlanWriteSchema>;

/** DELETE /plans/:id cancels one meeting by default; «series» takes the repeats with it. */
export const PlanCancelScopeSchema = z.enum(["occurrence", "series"]);
export type PlanCancelScope = z.infer<typeof PlanCancelScopeSchema>;

export const PlanParticipantWriteSchema = z.object({
  status: z.enum(["confirmed", "declined"]),
});
export type PlanParticipantWrite = z.infer<typeof PlanParticipantWriteSchema>;
