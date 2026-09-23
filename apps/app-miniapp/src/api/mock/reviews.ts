// START_MODULE_CONTRACT
// PURPOSE: Mock review store: the seeded reviews, the rating aggregate they add up to and the «Что было правдой?» fact tags of экран 35.
// SCOPE: Review state, eventRating and the fact tag dictionary; the HTTP surface is in ./reviews.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockReviews - shared with catalog, organizer, profile
// - resetMockReviews - restore seeded reviews (test isolation)
// - eventRating - rating summary and per-category averages for an event from the mock reviews
// - REVIEW_FACT_TAGS - the five «Что было правдой?» tags of экран 35, in design order
// - reviewFactTags - mock GET /events/:id/review-facts: the dictionary, empty for an unknown event
// - mockReviewFacts - fact tags submitted per review author and event (test isolation, shared with reviews.routes)
// - createMockReview - Creates or replaces the review of a user for an event (one review per user and event); "no_event"/"invalid" map to 404/400 in the interceptor
// END_MODULE_MAP

import { ReviewSchema } from "@max-events/api-contracts";
import type { Review } from "@max-events/api-contracts";
import { type CreateReview, type EventRating, type ReviewFactTag } from "../client";
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
  mockReviewFacts.clear();
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

/**
 * The five «Что было правдой?» tags of экран 35. There is no tag dictionary in the domain (#500), so
 * the mock is the dictionary: one flat list, the same for every event, in the order the design prints it.
 */
export const REVIEW_FACT_TAGS: readonly ReviewFactTag[] = [
  { code: "calm", label: "Спокойно" },
  { code: "kids_ok", label: "С детьми ок" },
  { code: "crowded", label: "Многолюдно" },
  { code: "pricey", label: "Дорого" },
  { code: "beginner_friendly", label: "Новичкам легко" },
];

/** Mock GET /events/:id/review-facts: the dictionary for a known event, nothing to tag for an unknown one. */
export function reviewFactTags(eventId: string): ReviewFactTag[] | "no_event" {
  return mockEvents.some((item) => item.id === eventId) ? [...REVIEW_FACT_TAGS] : "no_event";
}

/** What each author tagged an event with, keyed «userId>eventId» — the store the tag dictionary will get a column for (#500). */
export const mockReviewFacts = new Map<string, string[]>();

/** Creates or replaces the review of a user for an event (one review per user and event); "no_event"/"invalid" map to 404/400 in the interceptor. */
export function createMockReview(payload: CreateReview): Review | "no_event" | "invalid" {
  if (!mockEvents.some((item) => item.id === payload.eventId)) return "no_event";
  const known = new Set(REVIEW_FACT_TAGS.map((tag) => tag.code));
  if ((payload.factTags ?? []).some((code) => !known.has(code))) return "invalid";
  mockReviewFacts.set(`${payload.userId}>${payload.eventId}`, [...(payload.factTags ?? [])]);
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
