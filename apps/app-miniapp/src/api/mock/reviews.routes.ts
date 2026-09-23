// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the post-event review: submission, the event rating aggregate and the «Что было правдой?» tags.
// SCOPE: POST /api/reviews, GET /api/events/:id/rating, GET /api/events/:id/review-facts.
// DEPENDS: ./reviews.js, ./fixtures.js, ../client.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - reviewsRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { type CreateReview } from "../client";
import { parseBookingBody } from "./fixtures";
import { createMockReview, eventRating, reviewFactTags } from "./reviews";

export function reviewsRoutes(url: URL, init: RequestInit | undefined): Response | null {
  const rating = /^\/api\/events\/([^/]+)\/rating$/.exec(url.pathname);
  if (rating) {
    const payload = eventRating(rating[1]);
    return payload ? Response.json(payload) : new Response(null, { status: 404 });
  }
  const facts = /^\/api\/events\/([^/]+)\/review-facts$/.exec(url.pathname);
  if (facts) {
    const tags = reviewFactTags(facts[1]);
    return tags === "no_event" ? new Response(null, { status: 404 }) : Response.json(tags);
  }
  if (url.pathname === "/api/reviews" && init?.method === "POST") {
    const payload = parseBookingBody(init) as CreateReview | undefined;
    if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || typeof payload.eventId !== "string" || typeof payload.stars !== "number" || typeof payload.wouldGoAgain !== "boolean") return new Response(null, { status: 400 });
    const result = createMockReview(payload);
    return result === "no_event" ? new Response(null, { status: 404 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
  }
  return null;
}
