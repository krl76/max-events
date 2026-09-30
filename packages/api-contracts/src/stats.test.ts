import { describe, expect, it } from "vitest";
import { OrganizerEventStatsSchema, OrganizerSummarySchema, StatsPeriodSchema } from "./stats.js";

const eventId = "018f3c5a-0000-7000-8000-000000000070";

const counters = {
  eventId,
  views: 12,
  bookings: 4,
  cancellations: 1,
  paidBookings: 3,
} as const;

describe("StatsPeriodSchema", () => {
  it("defaults both sides to null, which reads as all time", () => {
    expect(StatsPeriodSchema.parse({})).toEqual({ from: null, to: null });
  });

  it("accepts an open-ended window on either side", () => {
    expect(StatsPeriodSchema.parse({ from: "2026-09-01T00:00:00+03:00" }).to).toBeNull();
    expect(StatsPeriodSchema.parse({ to: "2026-09-30T00:00:00+03:00" }).from).toBeNull();
  });

  it("rejects a window that ends before it starts", () => {
    expect(StatsPeriodSchema.safeParse({ from: "2026-09-30T00:00:00+03:00", to: "2026-09-01T00:00:00+03:00" }).success).toBe(false);
  });

  it("rejects a bound that is not a timestamp", () => {
    expect(StatsPeriodSchema.safeParse({ from: "2026-09-01" }).success).toBe(false);
  });
});

describe("OrganizerEventStatsSchema", () => {
  it("defaults the period to all time when the server omits it", () => {
    expect(OrganizerEventStatsSchema.parse(counters).period).toEqual({ from: null, to: null });
  });

  it("keeps the period the report was built for", () => {
    const period = { from: "2026-09-01T00:00:00+03:00", to: "2026-09-30T00:00:00+03:00" };
    expect(OrganizerEventStatsSchema.parse({ ...counters, period }).period).toEqual(period);
  });

  it("rejects negative counters", () => {
    expect(OrganizerEventStatsSchema.safeParse({ ...counters, views: -1 }).success).toBe(false);
  });
});

describe("OrganizerSummarySchema", () => {
  const summary = {
    bookings: 220,
    bookingsDeltaPercent: 18,
    attendedPercent: 74,
    cancelledPercent: 8,
    byWeekday: [80, 20, 10, 15, 30, 40, 25],
    sources: [
      { source: "chats", percent: 62 },
      { source: "feed", percent: 24 },
      { source: "search", percent: 14 },
    ],
    views: 1240,
    conversionPercent: 18,
    occupancyPercent: 85,
    seatsBooked: 220,
    seatsCapacity: 260,
    events: 8,
    soldOut: 2,
    uniqueGuests: 186,
    repeatGuestPercent: 28,
    newGuestPercent: 72,
    waitlist: 4,
    lead: [
      { bucket: "same_day", percent: 12 },
      { bucket: "days_1_3", percent: 28 },
      { bucket: "days_4_7", percent: 41 },
      { bucket: "earlier", percent: 19 },
    ],
  } as const;

  it("keeps the funnel, occupancy, guests and lead-time counters", () => {
    expect(OrganizerSummarySchema.parse(summary)).toEqual(summary);
  });

  it("allows a quiet period where ratios are still unknown", () => {
    expect(
      OrganizerSummarySchema.parse({
        ...summary,
        bookingsDeltaPercent: null,
        attendedPercent: null,
        cancelledPercent: null,
        conversionPercent: null,
        occupancyPercent: null,
        repeatGuestPercent: null,
        newGuestPercent: null,
        views: 0,
        seatsBooked: 0,
        seatsCapacity: 0,
        events: 0,
        soldOut: 0,
        uniqueGuests: 0,
        waitlist: 0,
        lead: [
          { bucket: "same_day", percent: 0 },
          { bucket: "days_1_3", percent: 0 },
          { bucket: "days_4_7", percent: 0 },
          { bucket: "earlier", percent: 0 },
        ],
      }).conversionPercent,
    ).toBeNull();
  });
});
