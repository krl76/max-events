import { describe, expect, it } from "vitest";
import type { FindOperator, Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { CalendarService, parseCalendarRange } from "./calendar.service";

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
    bookingOpensAt: null,
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
    promoCode: null,
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

function inValues(operator: FindOperator<string>): string[] {
  return operator.value as unknown as string[];
}

function emptyRepo() {
  return {
    find: async () => [],
    findOneBy: async () => null,
    create: (fields: object) => fields,
    save: async (entity: object) => entity,
    delete: async () => ({ affected: 0 }),
  };
}

function createService(bookings: BookingEntity[], events: EventEntity[], places: PlaceEntity[] = []) {
  // Counted so the batching stays batching: the calendar must not go back to a query per booking.
  const queries = { events: 0, places: 0 };
  const bookingsRepo = {
    find: async (opts: { where: { userId: string; status: string } }) => bookings.filter((row) => row.userId === opts.where.userId && row.status === opts.where.status),
  };
  const eventsRepo = {
    find: async (opts: { where: { id: FindOperator<string> } }) => {
      queries.events += 1;
      const ids = inValues(opts.where.id);
      return events.filter((row) => ids.includes(row.id));
    },
  };
  const placesRepo = {
    find: async (opts: { where: { id: FindOperator<string> } }) => {
      queries.places += 1;
      const ids = inValues(opts.where.id);
      return places.filter((row) => ids.includes(row.id));
    },
  };
  const empty = emptyRepo();
  const friends = { friendIds: async () => new Set<string>() };
  const service = new CalendarService(bookingsRepo as unknown as Repository<BookingEntity>, eventsRepo as unknown as Repository<EventEntity>, placesRepo as unknown as Repository<PlaceEntity>, empty as never, empty as never, empty as never, empty as never, friends as never);
  return { service, queries };
}

describe("CalendarService", () => {
  it("splits active bookings into upcoming and past by event start and omits cancelled ones", async () => {
    const park = "00000000-0000-4000-8000-0000000000p1";
    const { service } = createService([booking("b-past", "e-past"), booking("b-future", "e-future"), booking("b-cancelled", "e-other", "cancelled"), booking("b-other", "e-future", "active", otherUser)], [event("e-past", "2026-09-12T16:00:00Z", park), event("e-future", "2026-09-20T16:00:00Z"), event("e-other", "2026-09-22T16:00:00Z")], [place(park)]);

    const calendar = await service.list(userId, now);
    expect(calendar.upcoming.map((entry) => entry.booking.id)).toEqual(["b-future"]);
    expect(calendar.past.map((entry) => entry.booking.id)).toEqual(["b-past"]);
    expect(calendar.past[0]?.place?.title).toBe("Парк Горького");
    expect(calendar.upcoming[0]?.place).toBeNull();
  });

  it("returns empty sections when the user has no active bookings", async () => {
    const { service, queries } = createService([booking("b-cancelled", "e-past", "cancelled")], [event("e-past", "2026-09-12T16:00:00Z")]);
    await expect(service.list(userId, now)).resolves.toEqual({ upcoming: [], past: [] });
    // Nothing to join: an empty booking list must not query events or places at all.
    expect(queries).toEqual({ events: 0, places: 0 });
  });

  it("reads events and places in one batch each however many bookings there are", async () => {
    const park = "00000000-0000-4000-8000-0000000000p1";
    const hall = "00000000-0000-4000-8000-0000000000p2";
    const { service, queries } = createService([booking("b1", "e1"), booking("b2", "e2"), booking("b3", "e3")], [event("e1", "2026-09-20T16:00:00Z", park), event("e2", "2026-09-21T16:00:00Z", hall), event("e3", "2026-09-22T16:00:00Z", park)], [place(park), place(hall)]);
    const calendar = await service.list(userId, now);
    expect(calendar.upcoming.map((entry) => entry.booking.id)).toEqual(["b1", "b2", "b3"]);
    expect(queries).toEqual({ events: 1, places: 1 });
  });

  it("skips a booking whose event row is gone", async () => {
    const { service } = createService([booking("b-orphan", "e-missing"), booking("b-ok", "e1")], [event("e1", "2026-09-20T16:00:00Z")]);
    const calendar = await service.list(userId, now);
    expect(calendar.upcoming.map((entry) => entry.booking.id)).toEqual(["b-ok"]);
  });

  it("keeps only bookings whose event start sits inside from/to", async () => {
    const { service } = createService([booking("b-early", "e-early"), booking("b-in", "e-in"), booking("b-late", "e-late")], [event("e-early", "2026-09-10T16:00:00Z"), event("e-in", "2026-09-20T16:00:00Z"), event("e-late", "2026-09-30T16:00:00Z")]);
    const calendar = await service.list(userId, now, { from: new Date("2026-09-15T00:00:00Z"), to: new Date("2026-09-25T00:00:00Z") });
    expect(calendar.upcoming.map((entry) => entry.booking.id)).toEqual(["b-in"]);
    expect(calendar.past).toEqual([]);
  });
});

describe("parseCalendarRange", () => {
  it("treats omitted bounds as an open window and rejects a reversed one", () => {
    expect(parseCalendarRange({})).toEqual({ from: null, to: null });
    expect(parseCalendarRange({ from: "2026-09-15T00:00:00Z" }).from?.toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(() => parseCalendarRange({ from: "2026-09-30T00:00:00Z", to: "2026-09-01T00:00:00Z" })).toThrow(/Invalid calendar range/);
    expect(() => parseCalendarRange({ from: "not-a-date" })).toThrow(/Invalid calendar range/);
  });
});
