// START_MODULE_CONTRACT
// PURPOSE: Post-event review endpoints of the api client: the event rating aggregate, the «Что было правдой?» fact tags and review submission.
// SCOPE: GET /events/:id/rating, GET /events/:id/review-facts, POST /reviews.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventRating - event page rating aggregate: RatingSummary + per-category averages
// - ReviewFactTag - one «Что было правдой?» tag of экран 35: its code and its ru label
// - CreateReview - review submission payload (user + event + scores + fact tags)
// - withReviews - ApiClient.getEventRating / listReviewFactTags / createReview
// END_MODULE_MAP

import { RatingSummarySchema, ReviewSchema } from "@max-events/api-contracts";
import type { RatingSummary, Review, ReviewCategoryScores } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/** Rating aggregate for the event page: contract summary plus per-category averages (null when nobody scored that category). */
export interface EventRating {
  summary: RatingSummary;
  categoryAverages: { atmosphere: number | null; organization: number | null; price: number | null; place: number | null };
}

/** One «Что было правдой?» tag of экран 35. There is no tag dictionary in the domain yet (#500), so the list is mock-backed behind the signature the endpoint will take. */
export interface ReviewFactTag {
  code: string;
  label: string;
}

/**
 * Review submission payload: the author, the event, the scores, the optional text and the fact tags
 * picked on экран 35. userId and factTags are mock-only conveniences the real backend ignores —
 * identity comes from the init-data token, and CreateReviewWriteSchema strips keys it does not know,
 * so an extra field costs a submission nothing until the tag dictionary lands (#500).
 */
export interface CreateReview {
  userId: string;
  eventId: string;
  stars: number;
  categoryScores?: ReviewCategoryScores;
  wouldGoAgain: boolean;
  text?: string;
  factTags?: string[];
  /** Picked photos as data URLs until object storage lands; the contract accepts any URL string. */
  photos?: { url: string }[];
}

const EventRatingSchema: ZodSchema<EventRating> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected an event rating" };
    const raw = data as Record<string, unknown>;
    const summary = RatingSummarySchema.safeParse(raw.summary);
    if (!summary.success || typeof raw.categoryAverages !== "object" || raw.categoryAverages === null) return { success: false as const, error: "invalid event rating" };
    const averages = raw.categoryAverages as Record<string, unknown>;
    const categoryAverages = { atmosphere: null, organization: null, price: null, place: null } as EventRating["categoryAverages"];
    for (const key of ["atmosphere", "organization", "price", "place"] as const) {
      const value = averages[key];
      if (value !== undefined && value !== null && typeof value !== "number") return { success: false as const, error: "invalid event rating" };
      categoryAverages[key] = typeof value === "number" ? value : null;
    }
    return { success: true as const, data: { summary: summary.data, categoryAverages } };
  },
};

const ReviewFactTagListSchema: ZodSchema<ReviewFactTag[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected review fact tags" };
    const tags: ReviewFactTag[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) return { success: false as const, error: "invalid review fact tag" };
      const raw = item as Record<string, unknown>;
      if (typeof raw.code !== "string" || typeof raw.label !== "string") return { success: false as const, error: "invalid review fact tag" };
      tags.push({ code: raw.code, label: raw.label });
    }
    return { success: true as const, data: tags };
  },
};

export function withReviews<TBase extends ApiMixin>(Base: TBase) {
  return class ReviewEndpoints extends Base {
    getEventRating(eventId: string): Promise<EventRating> {
      return this.request(`/events/${eventId}/rating`, EventRatingSchema);
    }

    listReviewFactTags(eventId: string): Promise<ReviewFactTag[]> {
      return this.request(`/events/${eventId}/review-facts`, ReviewFactTagListSchema);
    }

    createReview(payload: CreateReview): Promise<Review> {
      return this.request("/reviews", ReviewSchema, { body: payload });
    }
  };
}
