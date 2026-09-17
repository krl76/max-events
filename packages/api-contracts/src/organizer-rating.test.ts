import { describe, expect, it } from "vitest";
import { OrganizerRatingResponseSchema } from "./organizer-rating.js";

describe("OrganizerRatingResponseSchema", () => {
  it("accepts a hidden rating and a full card", () => {
    expect(OrganizerRatingResponseSchema.parse({ rating: null }).rating).toBeNull();
    const parsed = OrganizerRatingResponseSchema.parse({
      rating: {
        organizerUserId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
        averageStars: 4.8,
        recommendPercent: 97,
        visitsCount: 6400,
        onTimePercent: 93,
        reviewsCount: 12,
      },
    });
    expect(parsed.rating?.averageStars).toBe(4.8);
  });
});
