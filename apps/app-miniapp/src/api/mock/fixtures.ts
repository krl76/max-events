// START_MODULE_CONTRACT
// PURPOSE: Shared mock fixtures every domain store builds on: the Moscow places and events, the demo user, the organizers and the friend list, plus the fixed demo clock and the geo/url helpers.
// SCOPE: Fixture data and pure helpers only. No in-memory state, no route table, no domain logic - those live in the domain modules that import this one.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PLACE_STAMP - shared with bookings, catalog, groups, lists, organizer, plans, profile, promo, reviews, social
// - place - shared with organizer
// - mockPlaces - Moscow venue fixtures (incl. two food spots — Депо and the Gorky Park food court feeding the autoplan food picks)
// - event - shared with organizer
// - MOCK_TODAY - the fixed demo "today" (Moscow day key) the place page fixtures are curated for
// - moscowDateKey - Moscow-calendar day key of an ISO timestamp (backend moscow-date parity)
// - MOCK_EARLY_ACCESS_EVENT_ID - fixture event whose booking opens in the future (early access, #202)
// - MOCK_BOOKING_OPENS_AT - ponytail: far-future window so the fixture stays "early access" regardless of the wall clock at test time
// - mockEvents - Moscow event fixtures (all four categories, paid and free, incl. two past events for the review flow, one event "today" for the place page, two MOCK_TODAY daytime events filling the nearby now/inAnHour buckets)
// - mockOrganizers - demo organizer fixture for event details
// - mockDemoUser - demo user returned by mock auth outside MAX (VITE_USE_MOCK=1); the id matches the booking/profile fixtures
// - mockOrganization - demo organization returned by the mock organizer login
// - MOCK_ORGANIZER_CREDENTIALS - demo login/password accepted by the mock /api/auth/organizer/login
// - mockFriendIds - friend user ids of the demo user (social counters fixtures)
// - mockFriends - friend fixtures for the "Your people are going" feed
// - MOCK_NOW - the fixed demo "now" (noon of MOCK_TODAY) the nearby timeline buckets and leisure window are computed from
// - HOUR_MS - shared with discover
// - haversineKm - Rough great-circle distance, backend haversine parity
// - moscowHour - shared with discover
// - parseMockCoords - Coordinate query params mirroring the backend validation (missing/out-of-range -> null -> 400 in the interceptor)
// - MOCK_PEOPLE_CENTER - Viewer coords when the people query carries no lat/lng (MOSCOW_CENTER parity with the nearby screen ponytail)
// - parseMockOrigin - lat/lng query params mirroring the backend parseOrigin: both absent -> null (caller default); partial or out-of-range -> "invalid" (400)
// - parseBookingBody - shared with auth.routes, bookings.routes, catalog.routes, discover.routes, feed.routes, groups.routes, lists.routes, moderation.routes, organizer.routes, plans.routes, profile.routes, reviews.routes, social.routes
// - haversineMeters - shared with plans
// END_MODULE_MAP

import type { Event, Friend, Organization, Place, User } from "@max-events/api-contracts";

export const PLACE_STAMP = "2026-08-01T12:00:00+03:00";

export function place(input: Omit<Place, "createdAt" | "updatedAt" | "published">): Place {
  return { published: true, ...input, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };
}

export const mockPlaces: Place[] = [place({ id: "b0000001-0000-4000-8000-000000000001", title: "Парк Горького", address: "Крымский Вал, 9", city: "Москва", category: "park", latitude: 55.7298, longitude: 37.6019 }), place({ id: "b0000002-0000-4000-8000-000000000002", title: "ГМИИ им. А. С. Пушкина", address: "ул. Волхонка, 12", city: "Москва", category: "museum", latitude: 55.7447, longitude: 37.6055 }), place({ id: "b0000003-0000-4000-8000-000000000003", title: "«Лужники»", address: "Лужнецкая набережная, 24", city: "Москва", category: "sport", latitude: 55.7158, longitude: 37.5543 }), place({ id: "b0000004-0000-4000-8000-000000000004", title: "Депо. Москва", address: "Тверская Застава, 1", city: "Москва", category: "food", latitude: 55.7758, longitude: 37.5936 }), place({ id: "b0000005-0000-4000-8000-000000000005", title: "Фудкорт «Веранда» у Парка Горького", address: "Крымский Вал, 2", city: "Москва", category: "food", latitude: 55.7315, longitude: 37.604 })];

type EventInput = Pick<Event, "id" | "title" | "category" | "city" | "startsAt" | "isPaid" | "priceRub"> & Partial<Event>;

export function event(input: EventInput): Event {
  return { published: true, description: "", placeId: null, endsAt: null, paymentUrl: null, capacity: null, chatLink: null, promoted: false, bookingOpensAt: null, weather: null, ...input };
}

/** "Today" for the place social page (P2-11-c): the demo day the today-block fixtures were curated for. */
export const MOCK_TODAY = "2026-09-12";

/** Moscow-calendar day key of an ISO timestamp (backend moscow-date parity). */
export function moscowDateKey(startsAt: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(startsAt));
}

/** Early-access fixture event (#202): public booking opens in the future; booking works only with a valid promo code (backend PromoService.redeemInTransaction parity). */
export const MOCK_EARLY_ACCESS_EVENT_ID = "c0000009-0000-4000-8000-000000000009";

// ponytail: far-future window so the fixture stays "early access" regardless of the wall clock at test time
export const MOCK_BOOKING_OPENS_AT = "2027-06-01T10:00:00+03:00";

export const mockEvents: Event[] = [
  event({ id: "c0000001-0000-4000-8000-000000000001", title: "Вечер Рахманинова: симфонический оркестр", description: "Программа из симфонических произведений С. В. Рахманинова в исполнении камерного оркестра. Начало в 19:00, антракт — 20 минут.", category: "afisha", city: "Москва", startsAt: "2026-09-19T19:00:00+03:00", isPaid: true, priceRub: 1800, paymentUrl: "https://tickets.example.com/rahmaninov", capacity: 300 }),
  event({ id: "c0000002-0000-4000-8000-000000000002", title: "Выставка импрессионистов из частных собраний", category: "afisha", city: "Москва", startsAt: "2026-09-19T12:00:00+03:00", endsAt: "2026-09-19T21:00:00+03:00", placeId: mockPlaces[1].id, isPaid: true, priceRub: 500, paymentUrl: "https://tickets.example.com/impressionists" }),
  event({ id: "c0000003-0000-4000-8000-000000000003", title: "Субботник в Парке Горького", description: "Приводим в порядок клумбы и дорожки центральной аллеи. Инвентарь и перчатки выдаём на месте, нужна только удобная одежда.", category: "volunteering", city: "Москва", startsAt: "2026-09-20T10:00:00+03:00", placeId: mockPlaces[0].id, isPaid: false, priceRub: null, capacity: 100, weather: { temperatureC: 12.4, condition: "облачно", conditionCode: 2, precipitationProbability: 40 } }),
  event({ id: "c0000004-0000-4000-8000-000000000004", title: "Помощь в приюте для животных", category: "volunteering", city: "Москва", startsAt: "2026-09-27T11:00:00+03:00", isPaid: false, priceRub: null, capacity: 15 }),
  event({ id: "c0000005-0000-4000-8000-000000000005", title: "Трейл-забег по Крылатским холмам", category: "sport", city: "Москва", startsAt: "2026-09-21T09:00:00+03:00", isPaid: true, priceRub: 800, paymentUrl: "https://tickets.example.com/trail-krilatskie", capacity: 200 }),
  event({ id: "c0000006-0000-4000-8000-000000000006", title: "Матч «Спартак» — «Динамо»", category: "sport", city: "Москва", startsAt: "2026-10-03T19:00:00+03:00", placeId: mockPlaces[2].id, isPaid: true, priceRub: 1500, paymentUrl: "https://tickets.example.com/spartak-dinamo" }),
  event({ id: "c0000007-0000-4000-8000-000000000007", title: "Веломаршрут по центру Москвы", category: "tourism", city: "Москва", startsAt: "2026-09-20T12:00:00+03:00", isPaid: false, priceRub: null }),
  event({ id: "c0000008-0000-4000-8000-000000000008", title: "Экскурсия по Китай-городу", category: "tourism", city: "Москва", startsAt: "2026-09-26T14:00:00+03:00", isPaid: true, priceRub: 900, paymentUrl: "https://tickets.example.com/kitay-gorod", capacity: 20 }),
  event({ id: "c0000009-0000-4000-8000-000000000009", title: "Гастрогид по «Депо»", category: "tourism", city: "Москва", startsAt: "2026-10-04T13:00:00+03:00", placeId: mockPlaces[3].id, isPaid: true, priceRub: 1200, paymentUrl: "https://tickets.example.com/gastro-depo", capacity: 25, bookingOpensAt: MOCK_BOOKING_OPENS_AT }),
  event({ id: "c000000a-0000-4000-8000-00000000000a", title: "Йога на рассвете в парке", category: "sport", city: "Москва", startsAt: "2026-09-13T08:00:00+03:00", placeId: mockPlaces[0].id, isPaid: false, priceRub: null, capacity: 50 }),
  event({ id: "c000000b-0000-4000-8000-00000000000b", title: "Кинопоказ под открытым небом", category: "afisha", city: "Москва", startsAt: "2026-09-18T21:00:00+03:00", placeId: mockPlaces[0].id, isPaid: false, priceRub: null }),
  event({ id: "c000000c-0000-4000-8000-00000000000c", title: "Гастрофестиваль в «Депо»", category: "afisha", city: "Москва", startsAt: "2026-09-27T12:00:00+03:00", endsAt: "2026-09-27T22:00:00+03:00", placeId: mockPlaces[3].id, isPaid: true, priceRub: 700, paymentUrl: "https://tickets.example.com/gastro-festival" }),
  event({ id: "c000000d-0000-4000-8000-00000000000d", title: "Прогулка-знакомство по Парку Горького", category: "tourism", city: "Москва", startsAt: "2026-09-05T10:00:00+03:00", placeId: mockPlaces[0].id, isPaid: false, priceRub: null }),
  event({ id: "c000000e-0000-4000-8000-00000000000e", title: "Открытая репетиция камерного оркестра", category: "afisha", city: "Москва", startsAt: "2026-09-08T19:00:00+03:00", isPaid: false, priceRub: null }),
  event({ id: "c000000f-0000-4000-8000-00000000000f", title: "Летний концерт на Пушкинской набережной", category: "afisha", city: "Москва", startsAt: `${MOCK_TODAY}T19:00:00+03:00`, placeId: mockPlaces[0].id, isPaid: false, priceRub: null, capacity: 200 }),
  event({ id: "c0000010-0000-4000-8000-000000000010", title: "Дневной кофе-маркет в «Депо»", category: "afisha", city: "Москва", startsAt: `${MOCK_TODAY}T12:30:00+03:00`, placeId: mockPlaces[3].id, isPaid: false, priceRub: null, promoted: true }),
  event({ id: "c0000011-0000-4000-8000-000000000011", title: "Лекция об импрессионистах", category: "afisha", city: "Москва", startsAt: `${MOCK_TODAY}T15:00:00+03:00`, placeId: mockPlaces[1].id, isPaid: false, priceRub: null }),
  // Sandbox-payment failure fixture (#213): the 13 ₽ price is the sandbox fail amount, so paying for a booking here always fails (backend SANDBOX_FAIL_AMOUNT parity).
  event({ id: "c0000012-0000-4000-8000-000000000012", title: "Утренняя настольная игра", category: "sport", city: "Москва", startsAt: "2027-03-15T10:00:00+03:00", isPaid: true, priceRub: 13, paymentUrl: "https://tickets.example.com/nastolka-13" }),
];

export const mockOrganizers: User[] = [{ id: "d0000001-0000-4000-8000-000000000001", maxUserId: "organizer-1", firstName: "Анна", lastName: "Соколова", username: null, avatarUrl: null, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP }];

/** Demo identity for mock auth outside MAX (VITE_USE_MOCK=1); the id matches the demo user id used by the booking/profile fixtures. */
export const mockDemoUser: User = { id: "a0000000-0000-4000-8000-000000000001", maxUserId: "demo", firstName: "Демо", lastName: null, username: "demo", avatarUrl: null, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };

/** Demo organization and its login/password for the organizer space in mock mode. */
export const mockOrganization: Organization = { id: "e0000000-0000-4000-8000-000000000001", name: "Городские события", contacts: "org@example.com" };

export const MOCK_ORGANIZER_CREDENTIALS = { login: "demo", password: "demo" } as const;

export const mockFriendIds: string[] = ["a0000000-0000-4000-8000-0000000000b1", "a0000000-0000-4000-8000-0000000000b2", "a0000000-0000-4000-8000-0000000000b3", "a0000000-0000-4000-8000-0000000000b4", "a0000000-0000-4000-8000-0000000000b5", "a0000000-0000-4000-8000-0000000000b6", "a0000000-0000-4000-8000-0000000000b7"];

/** Friend fixtures for the friends feed; avatarUrl is null so the UI renders initials avatars. */
export const mockFriends: Friend[] = [
  { id: mockFriendIds[0], name: "Анна Соколова", avatarUrl: null },
  { id: mockFriendIds[1], name: "Дима Кузнецов", avatarUrl: null },
  { id: mockFriendIds[2], name: "Катя Орлова", avatarUrl: null },
  { id: mockFriendIds[3], name: "Пётр Новиков", avatarUrl: null },
  { id: mockFriendIds[4], name: "Мария Белова", avatarUrl: null },
  { id: mockFriendIds[5], name: "Игорь Фомин", avatarUrl: null },
  { id: mockFriendIds[6], name: "Лена Гусева", avatarUrl: null },
];

/** The fixed demo "now" for the nearby surface: noon of MOCK_TODAY, so the four buckets fill deterministically (12:30 -> now, 15:00 -> inAnHour, 19:00 -> evening, next morning -> tomorrow). */
export const MOCK_NOW = new Date(`${MOCK_TODAY}T12:00:00+03:00`);

export const HOUR_MS = 60 * 60 * 1000;

/** Rough great-circle distance, backend haversine parity. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function moscowHour(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", hour12: false }).format(date));
}

/** Coordinate query params mirroring the backend validation (missing/out-of-range -> null -> 400 in the interceptor). */
export function parseMockCoords(url: URL): [number, number] | null {
  const latitude = url.searchParams.get("latitude");
  const longitude = url.searchParams.get("longitude");
  if (latitude === null || longitude === null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

/** Viewer coords when the people query carries no lat/lng (MOSCOW_CENTER parity with the nearby screen ponytail). */
export const MOCK_PEOPLE_CENTER: [number, number] = [55.7522, 37.6156];

/** lat/lng query params mirroring the backend parseOrigin: both absent -> null (caller default); partial or out-of-range -> "invalid" (400). */
export function parseMockOrigin(url: URL): [number, number] | null | "invalid" {
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  if ((lat === null || lat === "") && (lng === null || lng === "")) return null;
  if (lat === null || lat === "" || lng === null || lng === "") return "invalid";
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return "invalid";
  return [latitude, longitude];
}

export function parseBookingBody(init?: RequestInit): Record<string, unknown> | undefined {
  try {
    return JSON.parse(typeof init?.body === "string" ? init.body : "null");
  } catch {
    return undefined;
  }
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.round(haversineKm(lat1, lon1, lat2, lon2) * 1000);
}
