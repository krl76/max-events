// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the "Where to go?" guided picker (company/mood/budget context).
// SCOPE: Whereto query context enums, query schema, response with up to 5 events.
// DEPENDS: zod, ./event.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WheretoCompanySchema - closed company context enum (alone/friends/partner/kids)
// - WheretoCompany - company context type
// - WheretoMoodSchema - closed mood enum (active/calm/unusual)
// - WheretoMood - mood type
// - WheretoBudgetSchema - closed budget enum (free/under_3000/any)
// - WheretoBudget - budget type
// - WheretoQuerySchema - picker query payload
// - WheretoQuery - query type
// - WheretoResponseSchema - response with up to 5 event suggestions
// - WheretoResponse - response type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";

export const WheretoCompanySchema = z.enum(["alone", "friends", "partner", "kids"]);
export type WheretoCompany = z.infer<typeof WheretoCompanySchema>;

export const WheretoMoodSchema = z.enum(["active", "calm", "unusual"]);
export type WheretoMood = z.infer<typeof WheretoMoodSchema>;

export const WheretoBudgetSchema = z.enum(["free", "under_3000", "any"]);
export type WheretoBudget = z.infer<typeof WheretoBudgetSchema>;

export const WheretoQuerySchema = z.object({
  company: WheretoCompanySchema,
  mood: WheretoMoodSchema,
  budget: WheretoBudgetSchema,
});
export type WheretoQuery = z.infer<typeof WheretoQuerySchema>;

export const WheretoResponseSchema = z.object({
  items: z.array(EventSchema).max(5),
});
export type WheretoResponse = z.infer<typeof WheretoResponseSchema>;
