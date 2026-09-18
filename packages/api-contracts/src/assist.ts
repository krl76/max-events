// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for NL event assist (AI helper, not a separate chat).
// SCOPE: query write, parsed criteria, picks with explanations, response summary.
// DEPENDS: zod, ./event.js
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
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";

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
