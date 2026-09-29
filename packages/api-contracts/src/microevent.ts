// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for user-created micro-events (UGC) — "Играем в баскетбол сегодня в 19:00, сейчас 3/6".
// SCOPE: MicroEvent status enum, MicroEvent entity (what/when/where, participant limit, count and ids, author).
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MicroEventStatusSchema - closed micro-event status enum (open/cancelled)
// - MicroEventStatus - micro-event status type
// - MicroEventSchema - micro-event entity (title, startsAt, text or place location, limit/count/participantIds, author)
// - MicroEvent - micro-event type
// - CreateMicroEventWriteSchema - create payload
// - CreateMicroEventWrite - create payload type
// END_MODULE_MAP

import { z } from "zod";
import { FriendSchema } from "./friends.js";
import { PlanBudgetPersonSchema, PlanDebtSchema } from "./plan-budget.js";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const MicroEventStatusSchema = z.enum(["open", "cancelled"]);
export type MicroEventStatus = z.infer<typeof MicroEventStatusSchema>;

export const MicroEventSchema = z
  .object({
    id: IdSchema,
    authorId: IdSchema,
    title: z.string().min(1).max(200),
    startsAt: TimestampSchema,
    locationText: z.string().min(1).max(300).nullable().default(null),
    placeId: IdSchema.nullable().default(null),
    participantsLimit: z.number().int().min(1).nullable(),
    participantsCount: z.number().int().min(0).default(0),
    // Who is in, so a client can tell whether the current user joined instead of guessing.
    participantIds: z.array(IdSchema).default([]),
    participants: z.array(FriendSchema).default([]),
    status: MicroEventStatusSchema,
    createdAt: TimestampSchema,
  })
  .refine((data) => (data.locationText !== null) !== (data.placeId !== null), {
    message: "micro-event location must be exactly one of locationText or placeId",
    path: ["locationText"],
  })
  .refine((data) => data.participantsLimit === null || data.participantsCount <= data.participantsLimit, {
    message: "participantsCount cannot exceed participantsLimit",
    path: ["participantsCount"],
  })
  .refine((data) => data.participantIds.length === 0 || data.participantIds.length === data.participantsCount, {
    message: "participantIds must match participantsCount when present",
    path: ["participantIds"],
  });
export type MicroEvent = z.infer<typeof MicroEventSchema>;

export const CreateMicroEventWriteSchema = z
  .object({
    title: z.string().min(1).max(200),
    startsAt: TimestampSchema,
    locationText: z.string().min(1).max(300).nullable().optional(),
    placeId: IdSchema.nullable().optional(),
    participantsLimit: z.number().int().min(1).nullable().optional(),
    inviteeIds: z.array(IdSchema).max(30).optional(),
  })
  .refine((data) => (data.locationText != null) !== (data.placeId != null), {
    message: "micro-event location must be exactly one of locationText or placeId",
    path: ["locationText"],
  });
export type CreateMicroEventWrite = z.infer<typeof CreateMicroEventWriteSchema>;

export const MicroExpenseSchema = z.object({
  id: IdSchema,
  microEventId: IdSchema,
  title: z.string().min(1).max(200),
  amountRub: z.number().int().positive().max(2_147_483_647),
  payerUserId: IdSchema,
  shareUserIds: z.array(IdSchema).min(1),
  createdAt: TimestampSchema,
});
export type MicroExpense = z.infer<typeof MicroExpenseSchema>;

/** Same split as a plan budget: who paid, who shares, and who owes whom. The write payload is CreatePlanExpenseWrite. */
export const MicroBudgetSchema = z.object({
  expenses: z.array(MicroExpenseSchema),
  perPerson: z.array(PlanBudgetPersonSchema),
  debts: z.array(PlanDebtSchema),
  totalRub: z.number().int().nonnegative(),
});
export type MicroBudget = z.infer<typeof MicroBudgetSchema>;
