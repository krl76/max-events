import { describe, expect, it } from "vitest";
import { CalendarEntrySchema, CalendarResponseSchema } from "./calendar.js";

const entry = {
  booking: {
    id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d91",
    userId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
    eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
    status: "active",
    createdAt: "2026-09-01T10:00:00+03:00",
    updatedAt: "2026-09-01T10:00:00+03:00",
  },
  event: {
    id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
    title: "Джаз в парке",
    category: "afisha",
    city: "Москва",
    startsAt: "2026-09-12T19:00:00+03:00",
  },
  place: null,
};

describe("CalendarEntrySchema", () => {
  it("accepts a booking with its event and a null place", () => {
    const parsed = CalendarEntrySchema.parse(entry);
    expect(parsed.place).toBeNull();
    expect(parsed.event.title).toBe("Джаз в парке");
  });

  it("rejects a cancelled-status-free payload missing the event", () => {
    expect(CalendarEntrySchema.safeParse({ booking: entry.booking, place: null }).success).toBe(false);
  });
});

describe("CalendarResponseSchema", () => {
  it("round-trips upcoming and past sections", () => {
    const parsed = CalendarResponseSchema.parse({ upcoming: [entry], past: [] });
    expect(parsed.upcoming).toHaveLength(1);
    expect(parsed.past).toEqual([]);
  });
});
