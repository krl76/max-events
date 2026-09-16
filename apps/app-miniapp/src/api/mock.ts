// START_MODULE_CONTRACT
// PURPOSE: Mock API layer for the catalog, event page, profile and calendar while backend endpoints (M2/M3/M4) do not exist yet.
// SCOPE: In-memory Moscow fixtures (events/places/organizers), in-memory bookings and profiles, pure fixture filtering, fetch interceptor enabled by VITE_USE_MOCK=1 in main.tsx.
// DEPENDS: ./client.js (parseEventFilters, EventFilters), @max-events/api-contracts (Event, Place, User, Booking, Profile, CreateBookingSchema, UpdateProfileSchema)
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockPlaces - 4 Moscow venue fixtures
// - mockEvents - 11 Moscow event fixtures (all four categories, paid and free)
// - mockOrganizers - demo organizer fixture for event details
// - filterMockEvents - apply catalog filters to fixtures (date matches the local day of startsAt)
// - resetMockBookings - clear in-memory bookings (test isolation)
// - resetMockProfiles - clear in-memory profiles (test isolation)
// - calendarEntries - active bookings of a user enriched with event and place
// - installMockApi - intercept global fetch for /api/events, /api/bookings and /api/users/:id/profile, return a restore function
// END_MODULE_MAP

import type { Booking, Event, Place, Profile, User } from "@max-events/api-contracts";
import { CreateBookingSchema, UpdateProfileSchema } from "@max-events/api-contracts";
import { parseEventFilters, type EventFilters } from "./client";

const PLACE_STAMP = "2026-08-01T12:00:00+03:00";

function place(input: Omit<Place, "createdAt" | "updatedAt">): Place {
  return { ...input, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };
}

export const mockPlaces: Place[] = [place({ id: "b0000001-0000-4000-8000-000000000001", title: "Парк Горького", address: "Крымский Вал, 9", city: "Москва", category: "park", latitude: 55.7298, longitude: 37.6019 }), place({ id: "b0000002-0000-4000-8000-000000000002", title: "ГМИИ им. А. С. Пушкина", address: "ул. Волхонка, 12", city: "Москва", category: "museum", latitude: 55.7447, longitude: 37.6055 }), place({ id: "b0000003-0000-4000-8000-000000000003", title: "«Лужники»", address: "Лужнецкая набережная, 24", city: "Москва", category: "sport", latitude: 55.7158, longitude: 37.5543 }), place({ id: "b0000004-0000-4000-8000-000000000004", title: "Депо. Москва", address: "Тверская Застава, 1", city: "Москва", category: "food", latitude: 55.7758, longitude: 37.5936 })];

type EventInput = Pick<Event, "id" | "title" | "category" | "city" | "startsAt" | "isPaid" | "priceRub"> & Partial<Event>;

function event(input: EventInput): Event {
  return { description: "", placeId: null, endsAt: null, paymentUrl: null, capacity: null, ...input };
}

export const mockEvents: Event[] = [
  event({ id: "c0000001-0000-4000-8000-000000000001", title: "Вечер Рахманинова: симфонический оркестр", description: "Программа из симфонических произведений С. В. Рахманинова в исполнении камерного оркестра. Начало в 19:00, антракт — 20 минут.", category: "afisha", city: "Москва", startsAt: "2026-09-19T19:00:00+03:00", isPaid: true, priceRub: 1800, paymentUrl: "https://tickets.example.com/rahmaninov", capacity: 300 }),
  event({ id: "c0000002-0000-4000-8000-000000000002", title: "Выставка импрессионистов из частных собраний", category: "afisha", city: "Москва", startsAt: "2026-09-19T12:00:00+03:00", endsAt: "2026-09-19T21:00:00+03:00", placeId: mockPlaces[1].id, isPaid: true, priceRub: 500, paymentUrl: "https://tickets.example.com/impressionists" }),
  event({ id: "c0000003-0000-4000-8000-000000000003", title: "Субботник в Парке Горького", description: "Приводим в порядок клумбы и дорожки центральной аллеи. Инвентарь и перчатки выдаём на месте, нужна только удобная одежда.", category: "volunteering", city: "Москва", startsAt: "2026-09-20T10:00:00+03:00", placeId: mockPlaces[0].id, isPaid: false, priceRub: null, capacity: 100 }),
  event({ id: "c0000004-0000-4000-8000-000000000004", title: "Помощь в приюте для животных", category: "volunteering", city: "Москва", startsAt: "2026-09-27T11:00:00+03:00", isPaid: false, priceRub: null, capacity: 15 }),
  event({ id: "c0000005-0000-4000-8000-000000000005", title: "Трейл-забег по Крылатским холмам", category: "sport", city: "Москва", startsAt: "2026-09-21T09:00:00+03:00", isPaid: true, priceRub: 800, paymentUrl: "https://tickets.example.com/trail-krilatskie", capacity: 200 }),
  event({ id: "c0000006-0000-4000-8000-000000000006", title: "Матч «Спартак» — «Динамо»", category: "sport", city: "Москва", startsAt: "2026-10-03T19:00:00+03:00", placeId: mockPlaces[2].id, isPaid: true, priceRub: 1500, paymentUrl: "https://tickets.example.com/spartak-dinamo" }),
  event({ id: "c0000007-0000-4000-8000-000000000007", title: "Веломаршрут по центру Москвы", category: "tourism", city: "Москва", startsAt: "2026-09-20T12:00:00+03:00", isPaid: false, priceRub: null }),
  event({ id: "c0000008-0000-4000-8000-000000000008", title: "Экскурсия по Китай-городу", category: "tourism", city: "Москва", startsAt: "2026-09-26T14:00:00+03:00", isPaid: true, priceRub: 900, paymentUrl: "https://tickets.example.com/kitay-gorod", capacity: 20 }),
  event({ id: "c0000009-0000-4000-8000-000000000009", title: "Гастрогид по «Депо»", category: "tourism", city: "Москва", startsAt: "2026-10-04T13:00:00+03:00", placeId: mockPlaces[3].id, isPaid: true, priceRub: 1200, paymentUrl: "https://tickets.example.com/gastro-depo", capacity: 25 }),
  event({ id: "c000000a-0000-4000-8000-00000000000a", title: "Йога на рассвете в парке", category: "sport", city: "Москва", startsAt: "2026-09-13T08:00:00+03:00", placeId: mockPlaces[0].id, isPaid: false, priceRub: null, capacity: 50 }),
  event({ id: "c000000b-0000-4000-8000-00000000000b", title: "Кинопоказ под открытым небом", category: "afisha", city: "Москва", startsAt: "2026-09-18T21:00:00+03:00", placeId: mockPlaces[0].id, isPaid: false, priceRub: null }),
];

export function filterMockEvents(events: Event[], filters: EventFilters): Event[] {
  const city = filters.city?.toLowerCase();
  return events.filter((item) => (filters.category === undefined || item.category === filters.category) && (city === undefined || item.city.toLowerCase() === city) && (filters.date === undefined || item.startsAt.slice(0, 10) === filters.date));
}

export const mockOrganizers: User[] = [{ id: "d0000001-0000-4000-8000-000000000001", maxUserId: "organizer-1", firstName: "Анна", lastName: "Соколова", avatarUrl: null, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP }];

const mockBookings: Booking[] = [];
let mockBookingSeq = 0;

export function resetMockBookings(): void {
  mockBookings.length = 0;
  mockBookingSeq = 0;
}

/** Active bookings of a user, enriched with their event and place. */
export function calendarEntries(userId: string): { booking: Booking; event: Event; place: Place | null }[] {
  const entries: { booking: Booking; event: Event; place: Place | null }[] = [];
  for (const booking of mockBookings) {
    if (booking.userId !== userId || booking.status !== "active") continue;
    const event = mockEvents.find((item) => item.id === booking.eventId);
    if (!event) continue;
    entries.push({ booking, event, place: mockPlaces.find((item) => item.id === event.placeId) ?? null });
  }
  return entries;
}

const mockProfiles = new Map<string, Profile>();

export function resetMockProfiles(): void {
  mockProfiles.clear();
}

function profileFor(userId: string): Profile {
  return mockProfiles.get(userId) ?? { userId, city: "Москва", interests: [] };
}

function remainingSeats(eventId: string): number | null {
  const target = mockEvents.find((item) => item.id === eventId);
  if (!target || target.capacity === null) return null;
  const taken = mockBookings.filter((booking) => booking.eventId === eventId && booking.status === "active").length;
  return target.capacity - taken;
}

function eventDetails(eventId: string, userId: string): object | null {
  const event = mockEvents.find((item) => item.id === eventId);
  if (!event) return null;
  const active = mockBookings.find((booking) => booking.eventId === eventId && booking.userId === userId && booking.status === "active");
  return {
    event,
    place: mockPlaces.find((item) => item.id === event.placeId) ?? null,
    organizer: mockOrganizers[0],
    remainingSeats: remainingSeats(eventId),
    activeBookingId: active?.id ?? null,
  };
}

function parseBookingBody(init?: RequestInit): unknown {
  try {
    return JSON.parse(typeof init?.body === "string" ? init.body : "null");
  } catch {
    return undefined;
  }
}

export function installMockApi(): () => void {
  const real = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (input instanceof Request) return real(input, init);
    const url = new URL(input, "http://mock.local");
    if (url.pathname === "/api/events") {
      return Response.json(filterMockEvents(mockEvents, parseEventFilters(url.search)));
    }
    const details = /^\/api\/events\/([^/]+)\/details$/.exec(url.pathname);
    if (details) {
      const payload = eventDetails(details[1], url.searchParams.get("userId") ?? "");
      return payload ? Response.json(payload) : new Response(null, { status: 404 });
    }
    const byId = /^\/api\/events\/([^/]+)$/.exec(url.pathname);
    if (byId) {
      const found = mockEvents.find((item) => item.id === byId[1]);
      return found ? Response.json(found) : new Response(null, { status: 404 });
    }
    const profile = /^\/api\/users\/([^/]+)\/profile$/.exec(url.pathname);
    if (profile && init?.method === "PATCH") {
      const parsed = UpdateProfileSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const updated: Profile = { ...profileFor(profile[1]), ...parsed.data };
      mockProfiles.set(profile[1], updated);
      return Response.json(updated);
    }
    if (profile) {
      return Response.json(profileFor(profile[1]));
    }
    if (url.pathname === "/api/bookings" && init?.method === "POST") {
      const parsed = CreateBookingSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      if (!mockEvents.some((item) => item.id === parsed.data.eventId)) return new Response(null, { status: 404 });
      const existing = mockBookings.find((booking) => booking.eventId === parsed.data.eventId && booking.userId === parsed.data.userId && booking.status === "active");
      if (existing) return Response.json(existing);
      if (remainingSeats(parsed.data.eventId) === 0) return new Response(null, { status: 409 });
      const now = new Date().toISOString();
      mockBookingSeq += 1;
      const booking: Booking = { id: `e0000000-0000-4000-8000-${String(mockBookingSeq).padStart(12, "0")}`, userId: parsed.data.userId, eventId: parsed.data.eventId, status: "active", createdAt: now, updatedAt: now };
      mockBookings.push(booking);
      return Response.json(booking);
    }
    if (url.pathname === "/api/bookings") {
      return Response.json(calendarEntries(url.searchParams.get("userId") ?? ""));
    }
    const cancel = /^\/api\/bookings\/([^/]+)$/.exec(url.pathname);
    if (cancel && init?.method === "DELETE") {
      const booking = mockBookings.find((item) => item.id === cancel[1]);
      if (!booking) return new Response(null, { status: 404 });
      booking.status = "cancelled";
      booking.updatedAt = new Date().toISOString();
      return Response.json(booking);
    }
    return real(input, init);
  };
  return () => {
    globalThis.fetch = real;
  };
}
