// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for taste graph weights and «После меня» follow-on recommendations.
// SCOPE: category weights, transitions, after-me suggestions with upcoming events.
// DEPENDS: zod, ./event.js, ./place.js, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CategoryWeightSchema - category + weight
// - CategoryWeight - category weight type
// - TasteTransitionSchema - from→to visit sequence count
// - TasteTransition - transition type
// - TasteProfileSchema - preference profile
// - TasteProfile - profile type
// - AfterMeSuggestionSchema - «после X зайдёт Y» plus events
// - AfterMeSuggestion - suggestion type
// - AfterMeResponseSchema - list of suggestions
// - AfterMeResponse - response type
// END_MODULE_MAP

import { z } from "zod";
import { EventCategorySchema, EventSchema } from "./event.js";
import { PlaceCategorySchema } from "./place.js";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const CategoryWeightSchema = z.object({
  category: z.string().min(1),
  weight: z.number().nonnegative(),
});
export type CategoryWeight = z.infer<typeof CategoryWeightSchema>;

export const TasteTransitionSchema = z.object({
  fromCategory: EventCategorySchema,
  toCategory: EventCategorySchema,
  count: z.number().int().positive(),
});
export type TasteTransition = z.infer<typeof TasteTransitionSchema>;

export const TasteProfileSchema = z.object({
  userId: IdSchema,
  eventCategories: z.array(z.object({ category: EventCategorySchema, weight: z.number().nonnegative() })),
  placeCategories: z.array(z.object({ category: PlaceCategorySchema, weight: z.number().nonnegative() })),
  transitions: z.array(TasteTransitionSchema),
  updatedAt: TimestampSchema,
});
export type TasteProfile = z.infer<typeof TasteProfileSchema>;

export const AfterMeSuggestionSchema = z.object({
  fromCategory: EventCategorySchema,
  toCategory: EventCategorySchema,
  afterCount: z.number().int().min(0),
  explanation: z.string().min(1),
  events: z.array(EventSchema),
});
export type AfterMeSuggestion = z.infer<typeof AfterMeSuggestionSchema>;

export const AfterMeResponseSchema = z.object({
  suggestions: z.array(AfterMeSuggestionSchema),
});
export type AfterMeResponse = z.infer<typeof AfterMeResponseSchema>;
