import { afterEach, describe, expect, it, vi } from "vitest";
import { EventSchema, PlaceSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { filterMockEvents, installMockApi, mockEvents, mockPlaces } from "./mock";

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

  it("combines several filters", () => {
    const probe = mockEvents[1];
    const events = filterMockEvents(mockEvents, { category: probe.category, date: probe.startsAt.slice(0, 10), city: probe.city });
    expect(events.map((item) => item.id)).toContain(probe.id);
    expect(events.every((item) => item.category === probe.category && item.city === probe.city)).toBe(true);
  });

  it("returns everything without filters", () => {
    expect(filterMockEvents(mockEvents, {})).toHaveLength(mockEvents.length);
  });
});

describe("installMockApi", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    vi.unstubAllGlobals();
  });

  it("serves the filtered list through the typed client", async () => {
    restore = installMockApi();
    const events = await new ApiClient("/api").listEvents({ category: "volunteering" });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((item) => item.category === "volunteering")).toBe(true);
  });

  it("applies date and city params from the query string", async () => {
    restore = installMockApi();
    const day = mockEvents[0].startsAt.slice(0, 10);
    const events = await new ApiClient("/api").listEvents({ date: day, city: "Москва" });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((item) => item.startsAt.startsWith(day))).toBe(true);
  });

  it("serves a single event by id and reports 404 for unknown ids", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const single = await client.getEvent(mockEvents[0].id);
    expect(single.id).toBe(mockEvents[0].id);
    await expect(client.getEvent("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("falls back to the original fetch outside /api/events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 599 })));
    restore = installMockApi();
    const response = await fetch("/api/places/whatever");
    expect(response.status).toBe(599);
  });
});
