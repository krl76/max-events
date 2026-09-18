import { afterEach, describe, expect, it } from "vitest";
import type { Event } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { calendarEntries, installMockApi, mockEvents, mockOrganizers, mockPlaces, resetMockBookings } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

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

    const entries = await api.listCalendar();

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

    expect(await api.listCalendar()).toHaveLength(0);
  });

  it("keeps other users' bookings out of the list", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    await api.createBooking({ userId: "a0000000-0000-4000-8000-000000000002", eventId: mockEvents[0].id });

    expect(await api.listCalendar()).toHaveLength(0);
  });

  it("matches the pure calendarEntries helper", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const target = mockEvents.find((item) => item.placeId !== null)!;
    await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });

    expect(await api.listCalendar()).toEqual(calendarEntries(DEMO_USER_ID));
  });
});
