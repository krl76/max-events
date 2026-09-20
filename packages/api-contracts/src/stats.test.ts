import { describe, expect, it } from "vitest";
import { OrganizerEventStatsSchema, StatsPeriodSchema } from "./stats.js";

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
