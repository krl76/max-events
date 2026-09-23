// START_MODULE_CONTRACT
// PURPOSE: Post-event review endpoints of the api client: the event rating aggregate and review submission.
// SCOPE: GET /events/:id/rating, POST /reviews.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventRating - event page rating aggregate: RatingSummary + per-category averages
// - CreateReview - review submission payload (user + event + scores)
// - withReviews - ApiClient.getEventRating / createReview
// END_MODULE_MAP

import { RatingSummarySchema, ReviewSchema } from "@max-events/api-contracts";
import type { RatingSummary, Review, ReviewCategoryScores } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/** Rating aggregate for the event page: contract summary plus per-category averages (null when nobody scored that category). */
export interface EventRating {
  summary: RatingSummary;
  categoryAverages: { atmosphere: number | null; organization: number | null; price: number | null; place: number | null };
}

/** Review submission payload: the author, the event, the scores and the optional text; the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token). */
export interface CreateReview {
  userId: string;
  eventId: string;
  stars: number;
  categoryScores?: ReviewCategoryScores;
  wouldGoAgain: boolean;
  text?: string;
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

export function withReviews<TBase extends ApiMixin>(Base: TBase) {
  return class ReviewEndpoints extends Base {
    getEventRating(eventId: string): Promise<EventRating> {
      return this.request(`/events/${eventId}/rating`, EventRatingSchema);
    }

    createReview(payload: CreateReview): Promise<Review> {
      return this.request("/reviews", ReviewSchema, { body: payload });
    }
  };
}
