import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { CalendarService } from "./calendar.service";

const userId = "00000000-0000-4000-8000-00000000000a";
const otherUser = "00000000-0000-4000-8000-00000000000b";
const now = new Date("2026-09-15T00:00:00Z");

function event(id: string, startsAt: string, placeId: string | null = null): EventEntity {
  return {
    id,
    title: id,
    description: "",
    category: "afisha",
    city: "Москва",
    placeId,
    organizerUserId: null,
    startsAt: new Date(startsAt),
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: null,
    bookedCount: 1,
    published: true,
    chatLink: null,
    chatSyncPending: false,
    createdAt: new Date("2026-09-01T07:00:00Z"),
    updatedAt: new Date("2026-09-01T07:00:00Z"),
  };
}

function booking(id: string, eventId: string, status: "active" | "cancelled" = "active", owner = userId): BookingEntity {
  return {
    id,
    userId: owner,
    eventId,
    status,
    createdAt: new Date("2026-09-01T07:00:00Z"),
    updatedAt: new Date("2026-09-01T07:00:00Z"),
    reminderSentAt: null,
  };
}

function place(id: string): PlaceEntity {
  return {
    id,
    title: "Парк Горького",
    address: "ул. Крымский Вал, 9",
    city: "Москва",
    category: "park",
    latitude: 55.73,
    longitude: 37.6,
    organizerUserId: null,
    published: true,
    createdAt: new Date("2026-09-01T07:00:00Z"),
    updatedAt: new Date("2026-09-01T07:00:00Z"),
  };
}

function createService(bookings: BookingEntity[], events: EventEntity[], places: PlaceEntity[] = []) {
  const bookingsRepo = {
    find: async (opts: { where: { userId: string; status: string } }) => bookings.filter((row) => row.userId === opts.where.userId && row.status === opts.where.status),
  };
  const eventsRepo = {
    findOneBy: async (where: { id: string }) => events.find((row) => row.id === where.id) ?? null,
  };
  const placesRepo = {
    findOneBy: async (where: { id: string }) => places.find((row) => row.id === where.id) ?? null,
  };
  const service = new CalendarService(bookingsRepo as unknown as Repository<BookingEntity>, eventsRepo as unknown as Repository<EventEntity>, placesRepo as unknown as Repository<PlaceEntity>);
  return service;
}

describe("CalendarService", () => {
  it("splits active bookings into upcoming and past by event start and omits cancelled ones", async () => {
    const park = "00000000-0000-4000-8000-0000000000p1";
    const service = createService([booking("b-past", "e-past"), booking("b-future", "e-future"), booking("b-cancelled", "e-other", "cancelled"), booking("b-other", "e-future", "active", otherUser)], [event("e-past", "2026-09-12T16:00:00Z", park), event("e-future", "2026-09-20T16:00:00Z"), event("e-other", "2026-09-22T16:00:00Z")], [place(park)]);

    const calendar = await service.list(userId, now);
    expect(calendar.upcoming.map((entry) => entry.booking.id)).toEqual(["b-future"]);
    expect(calendar.past.map((entry) => entry.booking.id)).toEqual(["b-past"]);
    expect(calendar.past[0]?.place?.title).toBe("Парк Горького");
    expect(calendar.upcoming[0]?.place).toBeNull();
  });

  it("returns empty sections when the user has no active bookings", async () => {
    const service = createService([booking("b-cancelled", "e-past", "cancelled")], [event("e-past", "2026-09-12T16:00:00Z")]);
    await expect(service.list(userId, now)).resolves.toEqual({ upcoming: [], past: [] });
  });
});
