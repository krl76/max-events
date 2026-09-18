// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for NL event assist (AI helper, not a separate chat).
// SCOPE: query write, parsed criteria, picks with explanations, response summary, Saturday day draft with typed plan card.
// DEPENDS: zod, ./event.js, ./plan.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AssistWhenSchema - morning/afternoon/evening/any
// - AssistWhen - when type
// - AssistCompanySchema - company context
// - AssistCompany - company type
// - AssistGenreSchema - coarse genre
// - AssistGenre - genre type
// - AssistCriteriaSchema - structured NL parse
// - AssistCriteria - criteria type
// - AssistQueryWriteSchema - raw NL query
// - AssistQueryWrite - query write type
// - AssistPickSchema - event plus explanation
// - AssistPick - pick type
// - AssistResponseSchema - summary, criteria, picks
// - AssistResponse - response type
// - AssistDayStopSchema - timed event on a generated day
// - AssistDayStop - day stop type
// - AssistDayResponseSchema - Saturday draft with typed PlanCard payload
// - AssistDayResponse - day response type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";
import { PlanCardSchema } from "./plan.js";

export const AssistWhenSchema = z.enum(["morning", "afternoon", "evening", "any"]);
export type AssistWhen = z.infer<typeof AssistWhenSchema>;

export const AssistCompanySchema = z.enum(["alone", "friends", "partner", "kids"]);
export type AssistCompany = z.infer<typeof AssistCompanySchema>;

export const AssistGenreSchema = z.enum(["music", "sport", "outdoors", "any"]);
export type AssistGenre = z.infer<typeof AssistGenreSchema>;

export const AssistCriteriaSchema = z.object({
  when: AssistWhenSchema,
  budgetMaxRub: z.number().int().nonnegative().nullable(),
  company: AssistCompanySchema,
  genre: AssistGenreSchema,
});
export type AssistCriteria = z.infer<typeof AssistCriteriaSchema>;

export const AssistQueryWriteSchema = z.object({
  query: z.string().trim().min(1).max(500),
  save: z.boolean().optional(),
});
export type AssistQueryWrite = z.infer<typeof AssistQueryWriteSchema>;

export const AssistPickSchema = z.object({
  event: EventSchema,
  explanation: z.string().min(1).max(300),
});
export type AssistPick = z.infer<typeof AssistPickSchema>;

export const AssistResponseSchema = z.object({
  summary: z.string().min(1).max(400),
  criteria: AssistCriteriaSchema,
  items: z.array(AssistPickSchema).max(7),
});
export type AssistResponse = z.infer<typeof AssistResponseSchema>;

export const AssistDayStopSchema = z.object({
  at: z.string().min(1),
  event: EventSchema,
  explanation: z.string().min(1).max(300),
});
export type AssistDayStop = z.infer<typeof AssistDayStopSchema>;

export const AssistDayResponseSchema = z.object({
  summary: z.string().min(1).max(400),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stops: z.array(AssistDayStopSchema).min(1).max(4),
  planDraft: z.object({
    eventId: z.string().uuid(),
    participantIds: z.array(z.string().uuid()),
    meetingPoint: z.string().min(1).max(300),
    meetingAt: z.string().min(1),
  }),
  plan: PlanCardSchema.nullable().default(null),
});
export type AssistDayResponse = z.infer<typeof AssistDayResponseSchema>;
