import { describe, expect, it } from "vitest";
import { MemoryPointSchema, MyCitySummarySchema } from "./mycity.js";

describe("MyCitySummarySchema", () => {
  it("accepts the README example: 38 мест, 12 событий, 5 новых районов", () => {
    const summary = {
      userId: "018f3c5a-0000-7000-8000-000000000001",
      placesCount: 38,
      eventsCount: 12,
      districtsCount: 5,
    };
    expect(MyCitySummarySchema.parse(summary)).toEqual(summary);
  });

  it("rejects a negative counter", () => {
    expect(MyCitySummarySchema.safeParse({ userId: "018f3c5a-0000-7000-8000-000000000001", placesCount: -1, eventsCount: 0, districtsCount: 0 }).success).toBe(false);
  });
});

describe("MemoryPointSchema", () => {
  it("accepts a memory point at a place with geo and time", () => {
    const point = {
      latitude: 55.826,
      longitude: 37.637,
      eventId: null,
      placeId: "018f3c5a-0000-7000-8000-000000000099",
      visitedAt: "2026-09-11T15:00:00+03:00",
    };
    expect(MemoryPointSchema.parse(point)).toEqual(point);
  });

  it("accepts a memory point at an event instead of a place", () => {
    const point = {
      latitude: 55.826,
      longitude: 37.637,
      eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
      placeId: null,
      visitedAt: "2026-09-11T15:00:00+03:00",
    };
    expect(MemoryPointSchema.parse(point)).toEqual(point);
  });

  it("rejects a point without event or place", () => {
    const point = {
      latitude: 55.826,
      longitude: 37.637,
      eventId: null,
      placeId: null,
      visitedAt: "2026-09-11T15:00:00+03:00",
    };
    expect(MemoryPointSchema.safeParse(point).success).toBe(false);
  });

  it("rejects a point with both event and place", () => {
    const point = {
      latitude: 55.826,
      longitude: 37.637,
      eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
      placeId: "018f3c5a-0000-7000-8000-000000000099",
      visitedAt: "2026-09-11T15:00:00+03:00",
    };
    expect(MemoryPointSchema.safeParse(point).success).toBe(false);
  });

  it("round-trips through JSON", () => {
    const point = {
      latitude: 55.826,
      longitude: 37.637,
      eventId: null,
      placeId: "018f3c5a-0000-7000-8000-000000000099",
      visitedAt: "2026-09-11T15:00:00+03:00",
    };
    const parsed = MemoryPointSchema.parse(point);
    expect(MemoryPointSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
