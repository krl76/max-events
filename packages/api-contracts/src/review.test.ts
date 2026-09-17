import { describe, expect, it } from "vitest";
import { CreateReviewWriteSchema, ReviewSchema, RatingSummarySchema } from "./review.js";

const review = {
  id: "018f3c5a-0000-7000-8000-000000000050",
  userId: "018f3c5a-0000-7000-8000-000000000001",
  eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
  placeId: null,
  stars: 5,
  categoryScores: { atmosphere: 5, organization: 4, price: 3, place: 5 },
  wouldGoAgain: true,
  photos: [{ url: "https://example.com/photo-1.jpg" }],
  text: "Как прошло? Отлично.",
  createdAt: "2026-09-11T22:00:00+03:00",
} as const;

describe("ReviewSchema", () => {
  it("accepts the README review: stars + category scores + «пошел бы еще раз» + photo", () => {
    expect(ReviewSchema.parse(review)).toEqual(review);
  });

  it("defaults optional parts: categoryScores, photos, text", () => {
    const minimal = {
      id: "018f3c5a-0000-7000-8000-000000000051",
      userId: "018f3c5a-0000-7000-8000-000000000001",
      eventId: null,
      placeId: "018f3c5a-0000-7000-8000-000000000099",
      stars: 4,
      wouldGoAgain: false,
      createdAt: "2026-09-11T22:00:00+03:00",
    };
    const parsed = ReviewSchema.parse(minimal);
    expect(parsed.categoryScores).toEqual({});
    expect(parsed.photos).toEqual([]);
    expect(parsed.text).toBeNull();
  });

  it("rejects stars out of 1–5", () => {
    expect(ReviewSchema.safeParse({ ...review, stars: 0 }).success).toBe(false);
    expect(ReviewSchema.safeParse({ ...review, stars: 6 }).success).toBe(false);
  });

  it("rejects a category score out of 1–5", () => {
    expect(ReviewSchema.safeParse({ ...review, categoryScores: { atmosphere: 6 } }).success).toBe(false);
  });

  it("rejects a review without event or place", () => {
    expect(ReviewSchema.safeParse({ ...review, eventId: null }).success).toBe(false);
  });

  it("rejects a review with both event and place", () => {
    expect(ReviewSchema.safeParse({ ...review, placeId: "018f3c5a-0000-7000-8000-000000000099" }).success).toBe(false);
  });

  it("round-trips through JSON", () => {
    const parsed = ReviewSchema.parse(review);
    expect(ReviewSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});

describe("CreateReviewWriteSchema", () => {
  it("requires a booked event, stars and wouldGoAgain", () => {
    const parsed = CreateReviewWriteSchema.parse({ eventId: review.eventId, stars: 5, wouldGoAgain: true });
    expect(parsed.photos).toEqual([]);
    expect(parsed.eventId).toBe(review.eventId);
  });
});

describe("RatingSummarySchema", () => {
  it("accepts an aggregated rating for a place", () => {
    const summary = { eventId: null, placeId: "018f3c5a-0000-7000-8000-000000000099", averageStars: 4.8, reviewsCount: 24 };
    expect(RatingSummarySchema.parse(summary)).toEqual(summary);
  });

  it("rejects a summary without event or place", () => {
    expect(RatingSummarySchema.safeParse({ eventId: null, placeId: null, averageStars: 4.8, reviewsCount: 24 }).success).toBe(false);
  });
});
