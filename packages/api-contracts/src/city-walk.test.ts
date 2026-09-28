import { describe, expect, it } from "vitest";
import { CityWalkStopSchema, ComposeCityWalkWriteSchema } from "./city-walk.js";

const write = {
  city: "Тула",
  durationMinutes: 120,
  budgetMode: "any" as const,
  budgetRub: null,
  interests: ["cultural" as const],
  excludeKeys: [],
};

describe("ComposeCityWalkWriteSchema", () => {
  it("accepts a free-text city walk request", () => {
    expect(ComposeCityWalkWriteSchema.parse(write).city).toBe("Тула");
  });

  it("rejects a custom budget without an amount", () => {
    expect(ComposeCityWalkWriteSchema.safeParse({ ...write, budgetMode: "custom", budgetRub: null }).success).toBe(false);
  });

  it("rejects an empty interest list", () => {
    expect(ComposeCityWalkWriteSchema.safeParse({ ...write, interests: [] }).success).toBe(false);
  });
});

describe("CityWalkStopSchema", () => {
  it("rejects a stop without a source url", () => {
    expect(
      CityWalkStopSchema.safeParse({
        order: 1,
        title: "Кремль",
        address: "Кремль",
        latitude: 54.2,
        longitude: 37.6,
        description: "Место в городе Тула.",
        placeId: null,
        done: false,
      }).success,
    ).toBe(false);
  });
});
