import { describe, expect, it } from "vitest";
import { AfterMeResponseSchema, TasteProfileSchema } from "./taste.js";

const userId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";

describe("TasteProfileSchema", () => {
  it("accepts weighted categories and transitions", () => {
    const parsed = TasteProfileSchema.parse({
      userId,
      eventCategories: [{ category: "afisha", weight: 3 }],
      placeCategories: [{ category: "park", weight: 1 }],
      transitions: [{ fromCategory: "afisha", toCategory: "sport", count: 2 }],
      updatedAt: "2026-09-12T10:00:00.000Z",
    });
    expect(parsed.eventCategories[0]?.weight).toBe(3);
  });
});

describe("AfterMeResponseSchema", () => {
  it("accepts an empty suggestion list", () => {
    expect(AfterMeResponseSchema.parse({ suggestions: [] }).suggestions).toEqual([]);
  });
});
