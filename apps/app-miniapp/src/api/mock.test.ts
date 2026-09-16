import { afterEach, describe, expect, it, vi } from "vitest";
import { EventSchema, PlaceSchema } from "@max-events/api-contracts";
import type { Event } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { calendarEntries, filterMockEvents, installMockApi, mockEvents, mockOrganizers, mockPlaces, resetMockBookings, resetMockProfiles } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

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

describe("event details and booking flow", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockBookings();
  });

  const client = () => new ApiClient("/api");
  const placeTarget = (): Event & { capacity: number } => mockEvents.find((item) => item.placeId !== null && item.capacity !== null) as Event & { capacity: number };

  it("serves event details with place, organizer and free seats", async () => {
    restore = installMockApi();
    const target = placeTarget();
    const details = await client().getEventDetails(target.id, DEMO_USER_ID);

    expect(details.event.id).toBe(target.id);
    expect(details.place?.id).toBe(target.placeId);
    expect(details.place?.title).toBe(mockPlaces.find((item) => item.id === target.placeId)?.title);
    expect(details.organizer).toMatchObject({ id: mockOrganizers[0].id, firstName: mockOrganizers[0].firstName });
    expect(details.remainingSeats).toBe(target.capacity);
    expect(details.activeBookingId).toBeNull();
  });

  it("reports 404 for unknown event details", async () => {
    restore = installMockApi();
    await expect(client().getEventDetails("00000000-0000-4000-8000-000000000000", DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("creates a booking and decrements the free seat counter", async () => {
    restore = installMockApi();
    const target = placeTarget();
    const api = client();

    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });
    expect(booking.status).toBe("active");

    const details = await api.getEventDetails(target.id, DEMO_USER_ID);
    expect(details.remainingSeats).toBe(target.capacity - 1);
    expect(details.activeBookingId).toBe(booking.id);
  });

  it("refuses to book when no seats remain", async () => {
    restore = installMockApi();
    const capacities = mockEvents.map((item) => item.capacity).filter((value): value is number => value !== null);
    const capacity = Math.min(...capacities);
    const target = mockEvents.find((item) => item.capacity === capacity)!;
    const api = client();

    for (let i = 0; i < capacity; i += 1) {
      await api.createBooking({ userId: `f0000000-0000-4000-8000-${String(i).padStart(12, "0")}`, eventId: target.id });
    }

    await expect(api.createBooking({ userId: DEMO_USER_ID, eventId: target.id })).rejects.toMatchObject({ name: "ApiError", status: 409 });
  });

  it("cancels a booking, restoring seats and the bookable state", async () => {
    restore = installMockApi();
    const target = placeTarget();
    const api = client();

    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });
    const cancelled = await api.cancelBooking(booking.id);
    expect(cancelled.status).toBe("cancelled");

    const details = await api.getEventDetails(target.id, DEMO_USER_ID);
    expect(details.remainingSeats).toBe(target.capacity);
    expect(details.activeBookingId).toBeNull();
  });

  it("keeps re-booking the same user idempotent", async () => {
    restore = installMockApi();
    const target = placeTarget();
    const api = client();

    const first = await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });
    const second = await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });
    expect(second.id).toBe(first.id);

    const details = await api.getEventDetails(target.id, DEMO_USER_ID);
    expect(details.remainingSeats).toBe(target.capacity - 1);
  });
});

describe("profile mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockProfiles();
  });

  it("serves a default profile for an unknown user", async () => {
    restore = installMockApi();

    const profile = await new ApiClient("/api").getProfile(DEMO_USER_ID);

    expect(profile).toEqual({ userId: DEMO_USER_ID, city: "Москва", interests: [] });
  });

  it("applies a PATCH and persists it for the next GET", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const updated = await api.updateProfile(DEMO_USER_ID, { city: "Казань", interests: ["бег", "джаз"] });
    expect(updated).toEqual({ userId: DEMO_USER_ID, city: "Казань", interests: ["бег", "джаз"] });

    const reread = await api.getProfile(DEMO_USER_ID);
    expect(reread).toEqual(updated);
  });

  it("keeps a partial patch without touching other users", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const updated = await api.updateProfile(DEMO_USER_ID, { city: "Казань" });
    expect(updated.interests).toEqual([]);

    const other = await api.getProfile("a0000000-0000-4000-8000-000000000002");
    expect(other.city).toBe("Москва");
    expect(other.interests).toEqual([]);
  });

  it("rejects an invalid patch body", async () => {
    restore = installMockApi();

    await expect(new ApiClient("/api").updateProfile(DEMO_USER_ID, { city: "" })).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });
});

describe("calendar mock endpoint", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockBookings();
  });

  it("lists active bookings with their event and place", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const target = mockEvents.find((item) => item.placeId !== null)!;
    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });

    const entries = await api.listCalendar(DEMO_USER_ID);

    expect(entries).toHaveLength(1);
    expect(entries[0].booking.id).toBe(booking.id);
    expect(entries[0].event.id).toBe(target.id);
    expect(entries[0].place?.id).toBe(target.placeId);
  });

  it("drops cancelled bookings from the calendar", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: mockEvents[0].id });

    await api.cancelBooking(booking.id);

    expect(await api.listCalendar(DEMO_USER_ID)).toHaveLength(0);
  });

  it("keeps other users' bookings out of the list", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    await api.createBooking({ userId: "a0000000-0000-4000-8000-000000000002", eventId: mockEvents[0].id });

    expect(await api.listCalendar(DEMO_USER_ID)).toHaveLength(0);
  });

  it("matches the pure calendarEntries helper", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const target = mockEvents.find((item) => item.placeId !== null)!;
    await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });

    expect(await api.listCalendar(DEMO_USER_ID)).toEqual(calendarEntries(DEMO_USER_ID));
  });
});
