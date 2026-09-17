// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for post-event reviews ("После события") and aggregated ratings.
// SCOPE: Review photo, Review (stars + category scores + would-go-again + photos + text), RatingSummary for event/place.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ReviewPhotoSchema - photo entry (url)
// - ReviewPhoto - review photo type
// - ReviewCategoryScoresSchema - optional 1-5 scores per category (atmosphere/organization/price/place)
// - ReviewCategoryScores - review category scores type
// - ReviewSchema - review entity referencing exactly one of eventId or placeId
// - Review - review type
// - RatingSummarySchema - aggregated rating for an event or a place
// - RatingSummary - rating summary type
// - CreateReviewWriteSchema - review submission payload (booked event)
// - CreateReviewWrite - review submission type
// - EventRatingSchema - event-page rating aggregate with per-category averages
// - EventRating - event rating type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const ReviewPhotoSchema = z.object({
  url: z.string().url(),
});
export type ReviewPhoto = z.infer<typeof ReviewPhotoSchema>;

const CategoryScoreSchema = z.number().int().min(1).max(5);

export const ReviewCategoryScoresSchema = z.object({
  atmosphere: CategoryScoreSchema.optional(),
  organization: CategoryScoreSchema.optional(),
  price: CategoryScoreSchema.optional(),
  place: CategoryScoreSchema.optional(),
});
export type ReviewCategoryScores = z.infer<typeof ReviewCategoryScoresSchema>;

export const ReviewSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    eventId: IdSchema.nullable().default(null),
    placeId: IdSchema.nullable().default(null),
    stars: z.number().int().min(1).max(5),
    categoryScores: ReviewCategoryScoresSchema.default({}),
    wouldGoAgain: z.boolean(),
    photos: z.array(ReviewPhotoSchema).default([]),
    text: z.string().max(2000).nullable().default(null),
    createdAt: TimestampSchema,
  })
  .refine((data) => (data.eventId !== null) !== (data.placeId !== null), {
    message: "review must reference exactly one of eventId or placeId",
    path: ["eventId"],
  });
export type Review = z.infer<typeof ReviewSchema>;

export const RatingSummarySchema = z
  .object({
    eventId: IdSchema.nullable().default(null),
    placeId: IdSchema.nullable().default(null),
    averageStars: z.number().min(0).max(5),
    reviewsCount: z.number().int().min(0),
  })
  .refine((data) => (data.eventId !== null) !== (data.placeId !== null), {
    message: "rating summary must reference exactly one of eventId or placeId",
    path: ["eventId"],
  });
export type RatingSummary = z.infer<typeof RatingSummarySchema>;

export const CreateReviewWriteSchema = z.object({
  eventId: IdSchema,
  stars: z.number().int().min(1).max(5),
  categoryScores: ReviewCategoryScoresSchema.optional(),
  wouldGoAgain: z.boolean(),
  photos: z.array(ReviewPhotoSchema).default([]),
  text: z.string().max(2000).nullable().optional(),
});
export type CreateReviewWrite = z.infer<typeof CreateReviewWriteSchema>;

export const EventRatingSchema = z.object({
  summary: RatingSummarySchema,
  categoryAverages: z.object({
    atmosphere: z.number().min(1).max(5).nullable(),
    organization: z.number().min(1).max(5).nullable(),
    price: z.number().min(1).max(5).nullable(),
    place: z.number().min(1).max(5).nullable(),
  }),
});
export type EventRating = z.infer<typeof EventRatingSchema>;
