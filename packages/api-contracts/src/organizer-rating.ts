// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for organizer social rating (stars, recommend %, visits, on-time %).
// SCOPE: rating card; null when too few reviews (do not show zeros).
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerRatingSchema - computed organizer metrics
// - OrganizerRating - rating type
// - OrganizerRatingResponseSchema - nullable envelope
// - OrganizerRatingResponse - envelope type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema } from "./primitives.js";

export const OrganizerRatingSchema = z.object({
  organizerUserId: IdSchema,
  averageStars: z.number().min(0).max(5),
  recommendPercent: z.number().min(0).max(100),
  visitsCount: z.number().int().min(0),
  onTimePercent: z.number().min(0).max(100).nullable(),
  reviewsCount: z.number().int().min(0),
  attendancePercent: z.number().min(0).max(100).nullable().default(null),
  eventsCount: z.number().int().min(0).default(0),
});
export type OrganizerRating = z.infer<typeof OrganizerRatingSchema>;

export const OrganizerRatingResponseSchema = z.object({
  rating: OrganizerRatingSchema.nullable(),
});
export type OrganizerRatingResponse = z.infer<typeof OrganizerRatingResponseSchema>;
