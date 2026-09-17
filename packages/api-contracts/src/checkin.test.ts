import { describe, expect, it } from "vitest";
import { CheckInSchema, CreateCheckInWriteSchema, VisitStatsSchema } from "./checkin.js";

const checkIn = {
  id: "018f3c5a-0000-7000-8000-000000000040",
  userId: "018f3c5a-0000-7000-8000-000000000001",
  eventId: null,
  placeId: "018f3c5a-0000-7000-8000-000000000099",
  checkedInAt: "2026-09-11T12:00:00+03:00",
} as const;

describe("CheckInSchema", () => {
  it("accepts a check-in at a place with a time", () => {
    expect(CheckInSchema.parse(checkIn)).toEqual(checkIn);
  });

  it("accepts a check-in at an event instead of a place", () => {
    const eventCheckIn = { ...checkIn, eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90", placeId: null };
    expect(CheckInSchema.parse(eventCheckIn)).toEqual(eventCheckIn);
  });

  it("rejects a check-in without event or place", () => {
    expect(CheckInSchema.safeParse({ ...checkIn, placeId: null }).success).toBe(false);
  });

  it("rejects a check-in with both event and place", () => {
    expect(CheckInSchema.safeParse({ ...checkIn, eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90" }).success).toBe(false);
  });

  it("round-trips through JSON", () => {
    const parsed = CheckInSchema.parse(checkIn);
    expect(CheckInSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});

describe("VisitStatsSchema", () => {
  it("accepts the README example: visit counters by places, events and categories", () => {
    const stats = {
      userId: "018f3c5a-0000-7000-8000-000000000001",
      placesCount: 38,
      eventsCount: 12,
      byCategory: [
        { category: "afisha", count: 8 },
        { category: "volunteering", count: 4 },
      ],
    };
    expect(VisitStatsSchema.parse(stats)).toEqual(stats);
  });

  it("defaults byCategory to an empty array", () => {
    const stats = { userId: "018f3c5a-0000-7000-8000-000000000001", placesCount: 0, eventsCount: 0 };
    expect(VisitStatsSchema.parse(stats).byCategory).toEqual([]);
  });

  it("rejects a negative counter", () => {
    expect(VisitStatsSchema.safeParse({ userId: "018f3c5a-0000-7000-8000-000000000001", placesCount: -1, eventsCount: 0 }).success).toBe(false);
  });
});

describe("CreateCheckInWriteSchema", () => {
  it("accepts exactly one target", () => {
    expect(CreateCheckInWriteSchema.parse({ eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90" }).eventId).toBe("018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90");
    expect(CreateCheckInWriteSchema.parse({ placeId: checkIn.placeId }).placeId).toBe(checkIn.placeId);
    expect(CreateCheckInWriteSchema.safeParse({}).success).toBe(false);
    expect(CreateCheckInWriteSchema.safeParse({ eventId: checkIn.placeId, placeId: checkIn.placeId }).success).toBe(false);
  });
});
