// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for autoplan after «Пойду» — travel time, nearby food, dinner→road→meetup→event timeline.
// SCOPE: AutoPlanTimelineEntry, AutoPlanProposal wrapping a saved PlanCard.
// DEPENDS: zod, ./plan.js, ./place.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AutoPlanTimelineEntrySchema - one labelled step with timestamp
// - AutoPlanTimelineEntry - timeline entry type
// - AutoPlanProposalSchema - saved draft plan plus travel/food/timeline
// - AutoPlanProposal - autoplan proposal type
// - CreateAutoPlanWriteSchema - POST /plans/auto payload
// - CreateAutoPlanWrite - autoplan write type
// END_MODULE_MAP

import { z } from "zod";
import { PlaceSchema } from "./place.js";
import { PlanCardSchema } from "./plan.js";
import { IdSchema } from "./primitives.js";

export const AutoPlanTimelineEntrySchema = z.object({
  at: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
});
export type AutoPlanTimelineEntry = z.infer<typeof AutoPlanTimelineEntrySchema>;

export const AutoPlanProposalSchema = z.object({
  plan: PlanCardSchema,
  travelMinutes: z.number().int().min(0),
  foodPlaces: z.array(PlaceSchema),
  timeline: z.array(AutoPlanTimelineEntrySchema),
});
export type AutoPlanProposal = z.infer<typeof AutoPlanProposalSchema>;

export const CreateAutoPlanWriteSchema = z.object({
  eventId: IdSchema,
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
});
export type CreateAutoPlanWrite = z.infer<typeof CreateAutoPlanWriteSchema>;
