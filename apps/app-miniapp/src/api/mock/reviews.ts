// START_MODULE_CONTRACT
// PURPOSE: Mock review store: the seeded reviews and the rating aggregate they add up to.
// SCOPE: Review state and eventRating; the HTTP surface is in ./reviews.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockReviews - shared with catalog, organizer, profile
// - resetMockReviews - restore seeded reviews (test isolation)
// - eventRating - rating summary and per-category averages for an event from the mock reviews
// - createMockReview - Creates or replaces the review of a user for an event (one review per user and event); "no_event"/"invalid" map to 404/400 in the interceptor
// END_MODULE_MAP

import { ReviewSchema } from "@max-events/api-contracts";
import type { Review } from "@max-events/api-contracts";
import { type CreateReview, type EventRating } from "../client";
import { PLACE_STAMP, mockEvents, mockFriendIds } from "./fixtures";

type ReviewSeed = { friend: number; event: number; stars: number; categoryScores?: Review["categoryScores"]; wouldGoAgain: boolean; text?: string };

/** Seeded friend reviews for the showcase event and the park place events so both pages show aggregates out of the box. */
const MOCK_REVIEW_SEED: ReviewSeed[] = [
  { friend: 0, event: 0, stars: 5, categoryScores: { atmosphere: 5, organization: 5, price: 4, place: 5 }, wouldGoAgain: true, text: "Атмосфера замечательная, обязательно приду снова!" },
  { friend: 1, event: 0, stars: 4, categoryScores: { atmosphere: 4, organization: 5, price: 3, place: 4 }, wouldGoAgain: true },
  { friend: 2, event: 0, stars: 5, categoryScores: { atmosphere: 5, organization: 4 }, wouldGoAgain: false, text: "Всё понравилось, но пришлось долго искать вход." },
  { friend: 3, event: 12, stars: 4, categoryScores: { atmosphere: 4, place: 4 }, wouldGoAgain: true, text: "Парк отличное место для прогулок." },
  { friend: 4, event: 2, stars: 5, categoryScores: { atmosphere: 5, place: 5 }, wouldGoAgain: true },
];

export const mockReviews: Review[] = [];

let mockReviewSeq = 0;

function seedMockReviews(): void {
  mockReviews.length = 0;
  mockReviewSeq = 0;
  for (const seed of MOCK_REVIEW_SEED) {
    mockReviewSeq += 1;
    mockReviews.push({ id: `80000000-0000-4000-8000-${String(mockReviewSeq).padStart(12, "0")}`, userId: mockFriendIds[seed.friend], eventId: mockEvents[seed.event].id, placeId: null, stars: seed.stars, categoryScores: seed.categoryScores ?? {}, wouldGoAgain: seed.wouldGoAgain, photos: [], text: seed.text ?? null, createdAt: PLACE_STAMP });
  }
}
seedMockReviews();

export function resetMockReviews(): void {
  seedMockReviews();
}

/** Rating summary and per-category averages for an event from the mock reviews; null for an unknown event. */
export function eventRating(eventId: string): EventRating | null {
  if (!mockEvents.some((item) => item.id === eventId)) return null;
  const reviews = mockReviews.filter((item) => item.eventId === eventId);
  const averageStars = reviews.length === 0 ? 0 : reviews.reduce((sum, item) => sum + item.stars, 0) / reviews.length;
  const categoryAverage = (category: keyof Review["categoryScores"]): number | null => {
    const scores = reviews.flatMap((item) => (item.categoryScores[category] === undefined ? [] : [item.categoryScores[category]!]));
    return scores.length === 0 ? null : scores.reduce((sum, score) => sum + score, 0) / scores.length;
  };
  return {
    summary: { eventId, placeId: null, averageStars, reviewsCount: reviews.length },
    categoryAverages: { atmosphere: categoryAverage("atmosphere"), organization: categoryAverage("organization"), price: categoryAverage("price"), place: categoryAverage("place") },
  };
}

/** Creates or replaces the review of a user for an event (one review per user and event); "no_event"/"invalid" map to 404/400 in the interceptor. */
export function createMockReview(payload: CreateReview): Review | "no_event" | "invalid" {
  if (!mockEvents.some((item) => item.id === payload.eventId)) return "no_event";
  mockReviewSeq += 1;
  const review: Review = { id: `80000000-0000-4000-8000-${String(mockReviewSeq).padStart(12, "0")}`, userId: payload.userId, eventId: payload.eventId, placeId: null, stars: payload.stars, categoryScores: payload.categoryScores ?? {}, wouldGoAgain: payload.wouldGoAgain, photos: [], text: payload.text ?? null, createdAt: new Date().toISOString() };
  if (!ReviewSchema.safeParse(review).success) return "invalid";
  const existing = mockReviews.findIndex((item) => item.userId === payload.userId && item.eventId === payload.eventId);
  if (existing !== -1) {
    mockReviews[existing] = review;
    return review;
  }
  mockReviews.push(review);
  return review;
}
