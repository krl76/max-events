import { describe, expect, it } from "vitest";
import { EventSchema, PlaceSchema } from "@max-events/api-contracts";
import { eventRating, filterMockEvents, mockEvents, mockPlaces } from "./mock";

describe("mock fixtures", () => {
  it("every event fixture passes the event contract", () => {
    for (const fixture of mockEvents) {
      expect(EventSchema.safeParse(fixture)).toMatchObject({ success: true });
    }
  });

  it("every place fixture passes the place contract", () => {
    for (const fixture of mockPlaces) {
      expect(PlaceSchema.safeParse(fixture)).toMatchObject({ success: true });
    }
  });

  it("covers all four categories, paid and free events, the target city", () => {
    const categories = new Set(mockEvents.map((item) => item.category));
    expect([...categories].sort()).toEqual(["afisha", "sport", "tourism", "volunteering"]);
    expect(mockEvents.some((item) => item.isPaid && item.paymentUrl !== null)).toBe(true);
    expect(mockEvents.some((item) => !item.isPaid)).toBe(true);
    expect(mockEvents.length).toBeGreaterThanOrEqual(8);
    expect(mockPlaces.length).toBeGreaterThanOrEqual(3);
    expect(mockEvents.every((item) => item.city === "Москва")).toBe(true);
  });

  it("includes past fixtures so the post-event review flow is reachable in the demo", () => {
    const now = Date.now();
    expect(mockEvents.filter((item) => new Date(item.startsAt).getTime() < now).length).toBeGreaterThanOrEqual(1);
  });
});

describe("filterMockEvents", () => {
  it("keeps only the requested category", () => {
    const events = filterMockEvents(mockEvents, { category: "sport" });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((item) => item.category === "sport")).toBe(true);
  });

  it("matches the city case-insensitively and drops other cities", () => {
    expect(filterMockEvents(mockEvents, { city: "москва" })).toHaveLength(mockEvents.length);
    expect(filterMockEvents(mockEvents, { city: "Сочи" })).toHaveLength(0);
  });

  it("keeps events starting on the filter day", () => {
    const day = mockEvents[0].startsAt.slice(0, 10);
    const events = filterMockEvents(mockEvents, { date: day });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((item) => item.startsAt.startsWith(day))).toBe(true);
  });

  it("keeps only events whose average review score reaches the threshold", () => {
    const rated = filterMockEvents(mockEvents, { minRating: 4 });

    expect(rated.length).toBeGreaterThan(0);
    expect(rated.every((item) => (eventRating(item.id)?.summary.averageStars ?? 0) >= 4)).toBe(true);
    // Backend parity: no reviews means no average, so an unrated event is not "at least 4 stars".
    expect(rated.every((item) => (eventRating(item.id)?.summary.reviewsCount ?? 0) > 0)).toBe(true);
    expect(rated.length).toBeLessThan(mockEvents.length);
  });

  it("drops an event nobody reviewed, whatever the threshold", () => {
    // ".every(...)" over the whole pool is vacuously true on an empty result, so the empty case is
    // proved against an event that is known to have no reviews.
    const unrated = mockEvents.find((item) => (eventRating(item.id)?.summary.reviewsCount ?? 0) === 0);

    expect(unrated).toBeDefined();
    expect(filterMockEvents([unrated!], { minRating: 1 })).toEqual([]);
  });

  it("narrows the pool as the threshold rises", () => {
    const fromThree = filterMockEvents(mockEvents, { minRating: 3 }).length;
    const fromFive = filterMockEvents(mockEvents, { minRating: 5 }).length;

    expect(fromFive).toBeLessThan(fromThree);
    expect(filterMockEvents(mockEvents, { minRating: 5 }).every((item) => (eventRating(item.id)?.summary.averageStars ?? 0) >= 5)).toBe(true);
  });

  it("combines several filters", () => {
    const probe = mockEvents[1];
    const events = filterMockEvents(mockEvents, { category: probe.category, date: probe.startsAt.slice(0, 10), city: probe.city });
    expect(events.map((item) => item.id)).toContain(probe.id);
    expect(events.every((item) => item.category === probe.category && item.city === probe.city)).toBe(true);
  });

  it("returns everything without filters", () => {
    expect(filterMockEvents(mockEvents, {})).toHaveLength(mockEvents.length);
  });

  it("keeps only events that start at or after dateFrom", () => {
    const from = "2026-10-01T00:00:00.000Z";
    const events = filterMockEvents(mockEvents, { dateFrom: from });
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThan(mockEvents.length);
    expect(events.every((item) => Date.parse(item.startsAt) >= Date.parse(from))).toBe(true);
  });
});
