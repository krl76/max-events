// START_MODULE_CONTRACT
// PURPOSE: Mock catalog store: the event and place page aggregates, the catalog filter, the card list of экран 08 and the map context of экран 16 (weather, travel time), plus the participation counters.
// SCOPE: filterMockEvents, catalogCards, mapWeatherFor, mapHourlyForecast, travelOptionsFor, eventDetails, placePageFor, participationStats and the in-memory participations; the HTTP surface is in ./catalog.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - filterMockEvents - apply catalog filters to fixtures (date matches the local day of startsAt, q matches title/description/city/venue, sort orders the answer)
// - mockEventDistanceKm - haversine distance from an origin to the venue of an event; null for an event without a place
// - mockEventRatingValue - average stars of an event, rounded to one digit; null when nobody reviewed it
// - catalogCards - mock GET /events/cards: filtered events enriched with distance, rating and venue line (#496)
// - MOCK_WALK_KMH - walking speed the mock travel estimate uses
// - MOCK_METRO_KMH - metro speed the mock travel estimate uses, on top of MOCK_METRO_OVERHEAD_MIN
// - MOCK_METRO_OVERHEAD_MIN - fixed minutes a metro trip spends outside the train (entrance, platform, exit)
// - mapWeatherFor - mock GET /weather: the fixed demo forecast behind the map chip (#495)
// - MAP_HOURLY_COLUMNS - hours drawn on the map weather sheet
// - mapHourlyForecast - mock GET /weather/hourly: eight hours from the chip snapshot, rain landing at changesAt
// - travelOptionsFor - mock GET /travel: walking and metro estimates from the distance alone (#504)
// - mockParticipations - shared with catalog.routes, social
// - nextMockParticipationSeq - Bumps and returns the participation sequence; the route table writes participations from its own module, and an imported binding is read-only
// - mockPlaceStatuses - viewer statuses on venues (макет, экран 03); mock-only until the slot domain lands (#492), shared with catalog.routes and feed
// - resetMockParticipations - restore seeded participations and clear the venue statuses (test isolation)
// - participationStats - per-event status counters, friends count and own status
// - placePageFor - place social page aggregate: today events, friend visits, place rating, popularity, personal visits (mock)
// - eventDetails - shared with catalog.routes
// - MOCK_FORECAST_SOURCE - who the mock forecast is attributed to; the backend reads Open-Meteo, so the screen must not print another provider
// - MOCK_FORECAST_STEP_HOURS - spacing of the hourly strip columns (макет, экран 17: 14:00 · 16:00 · 18:00 …)
// - MOCK_FORECAST_COLUMNS - how many columns the strip draws
// - eventForecast - mock GET /events/:id/weather/hourly: the strip derived from the single stored snapshot (#495)
// - eventMoodTags - mock GET /events/:id/mood-tags: «Обстановка» tags with counters derived from the participations
// - MOCK_NEARBY_RADIUS_M - how far around the venue the «Рядом» list looks
// - eventNearby - mock GET /events/:id/nearby: published venues around the event venue, nearest first
// - eventCompanions - mock GET /events/:id/companions: экран 23 counters, the viewer status, the people and the gathering teaser
// - bookingOfferFor - mock GET /events/:id/booking-offer: the queue length and the friends already holding tickets (#496)
// END_MODULE_MAP

import type { Event, EventCategory, Friend, Participation, ParticipationStatus, Place, PlacePage } from "@max-events/api-contracts";
import { type BookingOffer, type CatalogCard, type EventCompanion, type EventCompanions, type EventFilters, type EventForecast, type EventMoodTag, type EventNearbySpot, type EventRating, type EventWeatherHour, type MapWeather, type ParticipationStats, type TravelOption } from "../client";
import { checkInFor, mockBookings, mockCheckIns, remainingSeats, waitlistAheadCount } from "./bookings";
import { HOUR_MS, MOCK_TODAY, PLACE_STAMP, haversineKm, mockDemoUser, mockEvents, mockFriendIds, mockFriends, mockOrganization, mockOrganizers, mockPlaces, moscowDateKey } from "./fixtures";
import { eventPromoted } from "./promo";
import { eventRating, mockReviews } from "./reviews";

const placeOf = (item: Event): Place | undefined => (item.placeId === null ? undefined : mockPlaces.find((candidate) => candidate.id === item.placeId));

/** Haversine distance from the viewer to the venue of an event; null for an event without a place (#496). */
export function mockEventDistanceKm(item: Event, origin: { latitude: number; longitude: number } | null): number | null {
  const place = placeOf(item);
  if (place === undefined || origin === null) return null;
  return Math.round(haversineKm(origin.latitude, origin.longitude, place.latitude, place.longitude) * 10) / 10;
}

/** Average stars of an event to one digit; null when nobody reviewed it, since «0.0» would read as an answer (#496). */
export function mockEventRatingValue(eventId: string): number | null {
  const summary = eventRating(eventId)?.summary;
  if (summary === undefined || summary.reviewsCount === 0) return null;
  return Math.round(summary.averageStars * 10) / 10;
}

/** Full-text needle of the search field: the title, the description, the city and the venue name (#497). */
function matchesMockQuery(item: Event, needle: string): boolean {
  const place = placeOf(item);
  return [item.title, item.description, item.city, place?.title ?? "", place?.address ?? ""].some((field) => field.toLowerCase().includes(needle));
}

/** Ordering the list asked for; distance needs an origin, so without one «near» keeps the soonest-first order (#497). */
function sortMockEvents(events: Event[], filters: EventFilters, origin: { latitude: number; longitude: number } | null): Event[] {
  const bySoon = (a: Event, b: Event) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id);
  if (filters.sort === "rating") {
    return [...events].sort((a, b) => (mockEventRatingValue(b.id) ?? -1) - (mockEventRatingValue(a.id) ?? -1) || bySoon(a, b));
  }
  if (filters.sort === "near") {
    return [...events].sort((a, b) => (mockEventDistanceKm(a, origin) ?? Number.POSITIVE_INFINITY) - (mockEventDistanceKm(b, origin) ?? Number.POSITIVE_INFINITY) || bySoon(a, b));
  }
  return [...events].sort(bySoon);
}

function boundMs(value: string, endOfDay: boolean): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return Date.parse(endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`);
  return Date.parse(value);
}

export function filterMockEvents(events: Event[], filters: EventFilters, origin: { latitude: number; longitude: number } | null = null): Event[] {
  const city = filters.city?.toLowerCase();
  const needle = filters.query?.trim().toLowerCase();
  const fromMs = filters.dateFrom ? boundMs(filters.dateFrom, false) : Number.NaN;
  const toMs = filters.dateTo ? boundMs(filters.dateTo, true) : Number.NaN;
  const matched = events.filter((item) => {
    if (filters.category !== undefined && item.category !== filters.category) return false;
    if (city !== undefined && item.city.toLowerCase() !== city) return false;
    if (filters.date !== undefined && item.startsAt.slice(0, 10) !== filters.date) return false;
    const startMs = Date.parse(item.startsAt);
    if (Number.isFinite(fromMs) && startMs < fromMs) return false;
    if (Number.isFinite(toMs) && startMs > toMs) return false;
    if (needle !== undefined && needle !== "" && !matchesMockQuery(item, needle)) return false;
    if (filters.minRating === undefined) return true;
    // Backend parity: an event nobody reviewed has no average, so it is not "at least N stars".
    const summary = eventRating(item.id)?.summary;
    return summary !== undefined && summary.reviewsCount > 0 && summary.averageStars >= filters.minRating;
  });
  // Without a sort the fixture order is what the caller gets, exactly as before the sort parameter existed.
  return filters.sort === undefined ? matched : sortMockEvents(matched, filters, origin);
}

/** Mock GET /events/cards: the filtered list plus the distance, rating and venue line the list DTO does not carry (#496). */
export function catalogCards(filters: EventFilters, origin: { latitude: number; longitude: number } | null = null): CatalogCard[] {
  return filterMockEvents(
    mockEvents.filter((row) => row.published !== false),
    filters,
    origin,
  ).map((item) => ({ event: eventPromoted(item), distanceKm: mockEventDistanceKm(item, origin), rating: mockEventRatingValue(item.id), placeTitle: placeOf(item)?.title ?? null }));
}

/** Walking speed of the mock estimate: 1,4 км takes the 18 минут the design prints. */
export const MOCK_WALK_KMH = 4.7;

/** Metro speed of the mock estimate, on top of MOCK_METRO_OVERHEAD_MIN. */
export const MOCK_METRO_KMH = 18;

/** Minutes a metro trip spends outside the train: entrance, platform, exit. */
export const MOCK_METRO_OVERHEAD_MIN = 4;

/** Urban driving speed for the car tile on the map. */
export const MOCK_CAR_KMH = 28;

/**
 * Mock GET /weather (#495). The events domain stores a forecast snapshot taken at the event start and
 * nothing else, so «сейчас +19°, дождь с 19:00» is a fixture pinned to the demo day rather than a
 * reading: the mock answers the shape the future endpoint will, not a guess at the real sky. The
 * fixtures are Moscow-only, so the city of the query changes nothing here.
 */
export function mapWeatherFor(): MapWeather {
  return { temperatureC: 19, condition: "ясно", changesAt: `${MOCK_TODAY}T19:00:00+03:00`, changesTo: "дождь" };
}

/** Hours the map sheet draws: now through the evening, one column each. */
export const MAP_HOURLY_COLUMNS = 8;

/**
 * Mock GET /weather/hourly. Columns follow the chip snapshot: clear until `changesAt`, then rain.
 * `from` is the first column; missing/invalid from starts at noon of the demo day.
 */
export function mapHourlyForecast(from?: Date): EventForecast {
  const now = mapWeatherFor();
  const start = from !== undefined && Number.isFinite(from.getTime()) ? from.getTime() : Date.parse(`${MOCK_TODAY}T12:00:00+03:00`);
  const chipRain = now.changesAt === null ? Number.NaN : Date.parse(now.changesAt);
  const rainAt = Number.isFinite(chipRain) && chipRain >= start ? chipRain : start + 5 * HOUR_MS;
  const hours: EventWeatherHour[] = [];
  for (let index = 0; index < MAP_HOURLY_COLUMNS; index += 1) {
    const at = start + index * HOUR_MS;
    const raining = at >= rainAt;
    hours.push({
      at: new Date(at).toISOString(),
      temperatureC: Math.round(now.temperatureC - index * 0.5),
      conditionCode: raining ? MOCK_RAIN_CODE : 0,
      condition: raining ? "дождь" : now.condition,
      withinEvent: true,
    });
  }
  return {
    source: MOCK_FORECAST_SOURCE,
    hours,
    note: `Дождь с ${moscowTime(rainAt)}`,
  };
}

/**
 * Mock GET /travel (#504): estimates come from the straight-line distance. The map then traces the
 * matching OSM graph (foot, driving) or the metro sketch. The metro option carries an interchange
 * past the first kilometre — the mock says «1 пересадка» the way the design does.
 */
export function travelOptionsFor(placeId: string, origin: { latitude: number; longitude: number }): TravelOption[] | null {
  const place = mockPlaces.find((item) => item.id === placeId && item.published !== false);
  if (!place) return null;
  const distanceKm = Math.round(haversineKm(origin.latitude, origin.longitude, place.latitude, place.longitude) * 10) / 10;
  return [
    { mode: "walk", minutes: Math.max(1, Math.round((distanceKm / MOCK_WALK_KMH) * 60)), distanceKm, transfers: null },
    { mode: "metro", minutes: Math.max(1, Math.round((distanceKm / MOCK_METRO_KMH) * 60) + MOCK_METRO_OVERHEAD_MIN), distanceKm, transfers: distanceKm > 1 ? 1 : 0 },
    { mode: "car", minutes: Math.max(1, Math.round((distanceKm / MOCK_CAR_KMH) * 60)), distanceKm, transfers: null },
  ];
}

/** Friend participations seed: [friendIndex, eventIndex, status]. The showcase event has 7 friends, 4 of them looking for company. The showcase friends from README: Анна → выставка, Дима → матч, Катя → фестиваль. */
const MOCK_PARTICIPATION_SEED: [number, number, ParticipationStatus][] = [
  [0, 0, "wants_to_go"],
  [1, 0, "wants_to_go"],
  [2, 0, "going"],
  [3, 0, "looking_for_company"],
  [4, 0, "looking_for_company"],
  [5, 0, "looking_for_company"],
  [6, 0, "looking_for_company"],
  [0, 2, "going"],
  [1, 3, "looking_for_company"],
  [2, 4, "probably_going"],
  [0, 1, "going"],
  [1, 5, "going"],
  [2, 11, "going"],
  [3, 3, "looking_for_company"],
  [4, 7, "probably_going"],
  [5, 6, "looking_for_travel_buddy"],
];

export const mockParticipations = new Map<string, Participation>();

/**
 * Viewer status on a venue, keyed `${userId}:${placeId}` (макет, экран 03, блок «Твой статус на этой
 * площадке»). Participation is an event-level domain: a place has no such surface until the slot
 * domain lands (#492), so this store stands in for it behind the endpoint signature.
 */
export const mockPlaceStatuses = new Map<string, ParticipationStatus>();

let mockParticipationSeq = 0;

/** Bumps and returns the participation sequence; the route table writes participations from its own module, and an imported binding is read-only. */
export function nextMockParticipationSeq(): number {
  mockParticipationSeq += 1;
  return mockParticipationSeq;
}

function seedMockParticipations(): void {
  mockParticipations.clear();
  mockPlaceStatuses.clear();
  mockParticipationSeq = 0;
  for (const [friend, eventItem, status] of MOCK_PARTICIPATION_SEED) {
    mockParticipationSeq += 1;
    mockParticipations.set(`${mockFriendIds[friend]}:${mockEvents[eventItem].id}`, { id: `f0000000-0000-4000-8000-${String(mockParticipationSeq).padStart(12, "0")}`, userId: mockFriendIds[friend], eventId: mockEvents[eventItem].id, status, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
  }
  // the demo user also wants to go to the open-air cinema (Катя goes too) — backs the shared_event context of the people mock
  mockParticipationSeq += 1;
  mockParticipations.set(`${mockDemoUser.id}:${mockEvents[11].id}`, { id: `f0000000-0000-4000-8000-${String(mockParticipationSeq).padStart(12, "0")}`, userId: mockDemoUser.id, eventId: mockEvents[11].id, status: "wants_to_go", createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
}
seedMockParticipations();

/** Restores seeded participations and clears the venue statuses (test isolation). */
export function resetMockParticipations(): void {
  seedMockParticipations();
}

export function participationStats(eventId: string, userId: string): ParticipationStats {
  const counts: Record<ParticipationStatus, number> = { wants_to_go: 0, probably_going: 0, going: 0, looking_for_company: 0, looking_for_travel_buddy: 0, looking_for_after_event_company: 0 };
  let friendsCount = 0;
  for (const record of mockParticipations.values()) {
    if (record.eventId !== eventId) continue;
    counts[record.status] += 1;
    if (record.userId !== userId && mockFriendIds.includes(record.userId)) friendsCount += 1;
  }
  const mine = mockParticipations.get(`${userId}:${eventId}`);
  return { counts, friendsCount, myStatus: mine?.status ?? null };
}

/** Place friend-visit seeds: [friend index, mockEvents index] — "Анна была здесь 3 раза"-style fixtures for the park. */
const MOCK_PLACE_VISIT_SEED: [number, number][] = [
  [0, 12],
  [0, 9],
  [0, 10],
  [1, 2],
];

/** Place social page aggregate (mock): today events (MOCK_TODAY Moscow day), friend visits, place rating from the reviews of its events, popularity today, personal visits; null for an unknown place. */
export function placePageFor(placeId: string, userId: string, day = MOCK_TODAY): PlacePage | null {
  const place = mockPlaces.find((item) => item.id === placeId);
  if (!place) return null;
  const atPlace = mockEvents.filter((item) => item.placeId === placeId);
  const todayEvents = atPlace.filter((item) => moscowDateKey(item.startsAt) === day);
  const todayEventIds = new Set(todayEvents.map((item) => item.id));
  const eventIds = new Set(atPlace.map((item) => item.id));
  const scoped = mockCheckIns.filter((item) => (item.placeId !== null && item.placeId === placeId) || (item.eventId !== null && eventIds.has(item.eventId)));
  const popularityToday = scoped.filter((item) => item.placeId === placeId).length;
  const personalVisitsCount = scoped.filter((item) => item.userId === userId).length;
  const visitsByFriend = new Map<string, number>();
  for (const [friend, eventItem] of MOCK_PLACE_VISIT_SEED) {
    if (mockEvents[eventItem].placeId !== placeId) continue;
    const friendId = mockFriendIds[friend];
    visitsByFriend.set(friendId, (visitsByFriend.get(friendId) ?? 0) + 1);
  }
  const goingToday = new Set<string>();
  for (const record of mockParticipations.values()) {
    if (!todayEventIds.has(record.eventId) || !mockFriendIds.includes(record.userId)) continue;
    if (record.status === "going" || record.status === "wants_to_go") goingToday.add(record.userId);
  }
  const friendIds = new Set([...visitsByFriend.keys(), ...goingToday]);
  const friends: PlacePage["friends"] = [...friendIds].map((friendId) => mockFriends.find((friend) => friend.id === friendId)).flatMap((friend) => (friend === undefined ? [] : [{ friend, visitsCount: visitsByFriend.get(friend.id) ?? 0, goingToday: goingToday.has(friend.id) }]));
  const reviews = mockReviews.filter((item) => item.eventId !== null && eventIds.has(item.eventId));
  const rating =
    reviews.length === 0
      ? null
      : {
          summary: { eventId: null, placeId, averageStars: reviews.reduce((sum, item) => sum + item.stars, 0) / reviews.length, reviewsCount: reviews.length },
          categoryAverages: { atmosphere: null, organization: null, price: null, place: null } as EventRating["categoryAverages"],
        };
  const categoryKeys = ["atmosphere", "organization", "price", "place"] as const;
  if (rating !== null) {
    for (const key of categoryKeys) {
      const scores = reviews.flatMap((item) => (item.categoryScores[key] === undefined ? [] : [item.categoryScores[key]!]));
      rating.categoryAverages[key] = scores.length === 0 ? null : scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }
  }
  return { placeId, todayEvents, friends, rating, popularityToday, personalVisitsCount };
}

export function eventDetails(eventId: string, userId: string): object | null {
  // EventDetailsService throws NotFound for published === false: once moderation hides an event, its
  // page stops answering, organizer and all.
  const event = mockEvents.find((item) => item.id === eventId && item.published !== false);
  if (!event) return null;
  const active = mockBookings.find((booking) => booking.eventId === eventId && booking.userId === userId && booking.status === "active");
  return {
    event: eventPromoted(event),
    place: mockPlaces.find((item) => item.id === event.placeId) ?? null,
    organizer: mockOrganizers[0],
    organization: mockOrganization,
    remainingSeats: remainingSeats(eventId),
    activeBookingId: active?.id ?? null,
    checkInId: checkInFor(userId, eventId)?.id ?? null,
    // Every fixture event belongs to the one demo organization, so «в афише» is the published catalogue (#496).
    organizerEventsCount: mockEvents.filter((item) => item.published !== false).length,
  };
}

const publishedEvent = (eventId: string): Event | undefined => mockEvents.find((item) => item.id === eventId && item.published !== false);

const moscowTime = (at: number): string => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }).format(new Date(at));

/** The backend forecast comes from Open-Meteo (EventWeatherService), so the strip credits Open-Meteo and not some other provider. */
export const MOCK_FORECAST_SOURCE = "Open-Meteo";

/** Spacing of the strip columns (макет, экран 17: 14:00 · 16:00 · 18:00 · 20:00 · 22:00). */
export const MOCK_FORECAST_STEP_HOURS = 2;

/** How many columns the strip draws. */
export const MOCK_FORECAST_COLUMNS = 5;

/** WMO code the mock switches to once the stored probability says rain is coming (Open-Meteo «slight rain»). */
const MOCK_RAIN_CODE = 61;

/**
 * Mock GET /events/:id/weather/hourly (#495). The domain stores exactly one reading, taken at the
 * event start, so every column past the first is derived rather than measured: the temperature cools
 * off by a degree and a half per step and the rain, whose probability is the only thing the snapshot
 * knows about it, is placed five hours in. The shape is what the hourly endpoint will answer; the
 * numbers are a fixture and say so by never pretending to a provider we do not read.
 */
export function eventForecast(eventId: string): EventForecast | null {
  const event = publishedEvent(eventId);
  if (!event) return null;
  const start = new Date(event.startsAt).getTime();
  const end = event.endsAt === null ? start + 4 * HOUR_MS : new Date(event.endsAt).getTime();
  const base = event.weather?.temperatureC ?? 18;
  const rainChance = event.weather?.precipitationProbability ?? 0;
  const rainFrom = rainChance >= 50 ? start + 5 * HOUR_MS : null;
  const hours: EventWeatherHour[] = [];
  for (let index = 0; index < MOCK_FORECAST_COLUMNS; index += 1) {
    const at = start + index * MOCK_FORECAST_STEP_HOURS * HOUR_MS;
    const raining = rainFrom !== null && at >= rainFrom;
    hours.push({
      at: new Date(at).toISOString(),
      temperatureC: Math.round(base - index * 1.5),
      conditionCode: raining ? MOCK_RAIN_CODE : (event.weather?.conditionCode ?? 1),
      condition: raining ? "дождь" : (event.weather?.condition ?? "ясно"),
      withinEvent: at <= end,
    });
  }
  return { source: MOCK_FORECAST_SOURCE, hours, note: rainFrom === null ? null : `Дождь после ${moscowTime(rainFrom)}, вероятность ${rainChance}%` };
}

/** «Обстановка» wording per category: the same three questions a visitor asks, phrased for what they are going to. */
const MOCK_MOOD_TAGS: Record<EventCategory, Array<[string, string]>> = {
  afisha: [
    ["calm", "Спокойно"],
    ["kids_ok", "С детьми ок"],
    ["newcomers_ok", "Новичкам легко"],
  ],
  volunteering: [
    ["friendly", "Дружелюбно"],
    ["kids_ok", "С детьми ок"],
    ["newcomers_ok", "Новичкам легко"],
  ],
  tourism: [
    ["calm", "Спокойно"],
    ["walking", "Много ходить"],
    ["newcomers_ok", "Новичкам легко"],
  ],
  sport: [
    ["energetic", "Заряженно"],
    ["newcomers_ok", "Новичкам легко"],
    ["kids_ok", "С детьми ок"],
  ],
};

/** Shares of the participants behind each tag, in design order (12 · 9 · 6 out of sixteen on экран 17). */
const MOCK_MOOD_SHARES = [0.75, 0.56, 0.38];

/**
 * Mock GET /events/:id/mood-tags. There is no mood dictionary in the domain and no vote to count, so
 * the counters ride the participations: an event nobody reacted to answers an empty list rather than
 * three tags with a zero next to them.
 */
export function eventMoodTags(eventId: string): EventMoodTag[] | null {
  const event = publishedEvent(eventId);
  if (!event) return null;
  const total = [...mockParticipations.values()].filter((row) => row.eventId === eventId).length;
  return MOCK_MOOD_TAGS[event.category].flatMap(([code, label], index) => {
    const count = Math.ceil(total * MOCK_MOOD_SHARES[index]);
    return count === 0 ? [] : [{ code, label, count }];
  });
}

/** How far around the venue the «Рядом» list looks: a walk, not a trip. */
export const MOCK_NEARBY_RADIUS_M = 1200;

/**
 * Mock GET /events/:id/nearby. Nothing selects places around an event today, so the list is the
 * published venues within walking distance of this one — real fixtures at a real distance, rather
 * than invented amenities. An event without a venue has nothing to be near and answers an empty list.
 */
export function eventNearby(eventId: string): EventNearbySpot[] | null {
  const event = publishedEvent(eventId);
  if (!event) return null;
  const venue = mockPlaces.find((item) => item.id === event.placeId);
  if (venue === undefined) return [];
  return mockPlaces
    .filter((item) => item.id !== venue.id && item.published !== false)
    .map((item) => ({ id: item.id, title: item.title, category: item.category, distanceM: Math.round(haversineKm(venue.latitude, venue.longitude, item.latitude, item.longitude) * 100) * 10 }))
    .filter((spot) => spot.distanceM <= MOCK_NEARBY_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM);
}

/** Chats the viewer shares with a friend, by friend index; one slot is empty, because «Не в твоих чатах» is a line the design names out loud. */
const MOCK_COMPANION_CHATS: Array<string | null> = ["Двор", "Падел", "Соседи", "Двор", "Падел", null, "Соседи"];

/** What the viewer is into; the overlap with the lists below is the «N совпадений» badge. */
const MOCK_VIEWER_INTERESTS = ["концерты", "джаз", "прогулки", "кофе"];

/** Interests per friend index — no interest graph exists for a person, so the lists are fixtures. */
const MOCK_COMPANION_INTERESTS: string[][] = [
  ["джаз", "концерты", "ночная жизнь"],
  ["бег", "концерты", "кофе"],
  ["выставки", "прогулки"],
  ["джаз", "концерты", "кофе"],
  ["йога", "кофе", "бег"],
  ["велоспорт", "джаз", "кофе"],
  ["театр", "концерты", "кофе"],
];

/**
 * The line a person left under their status; most leave none, and the design draws the expanded card
 * only for those who did. Экран 23 opens on «Ищут», so the note belongs to someone who is actually
 * looking — a note on a person three taps away is a card nobody ever sees.
 */
const MOCK_COMPANION_NOTES: Array<string | null> = [null, null, "Возьму термос и плед. Если кто-то хочет присоединиться — пишите.", "Иду один, был на прошлом концерте — огонь. Кто со мной к сцене?", null, null, null];

/** How early the company agrees to meet: «у входа в 19:30» before a 20:00 start. */
const MOCK_GATHERING_LEAD_MIN = 30;

/** Faces the gathering teaser draws before it starts counting «и ещё N». */
const MOCK_GATHERING_FACES = 2;

/** Events both the viewer and this friend marked, this one aside: the «5 общих планов» of the design. */
function sharedParticipationCount(friendId: string, userId: string, eventId: string): number {
  const mine = new Set([...mockParticipations.values()].filter((row) => row.userId === userId && row.eventId !== eventId).map((row) => row.eventId));
  return [...mockParticipations.values()].filter((row) => row.userId === friendId && row.eventId !== eventId && mine.has(row.eventId)).length;
}

function companionFor(friend: Friend, index: number, status: ParticipationStatus, userId: string, eventId: string): EventCompanion {
  const interests = MOCK_COMPANION_INTERESTS[index] ?? [];
  return {
    friend,
    status,
    chatTitle: MOCK_COMPANION_CHATS[index] ?? null,
    sharedPlansCount: sharedParticipationCount(friend.id, userId, eventId),
    matchesCount: interests.filter((interest) => MOCK_VIEWER_INTERESTS.includes(interest)).length,
    interests,
    note: MOCK_COMPANION_NOTES[index] ?? null,
  };
}

/**
 * Mock GET /events/:id/companions (макет, экран 23). The counters and the statuses are real
 * participations; everything that makes a row worth reading — the shared chat, the interest matches,
 * the note — has no field in the contract and is a fixture keyed to the friend, so the same person
 * reads the same way on every visit. The gathering teaser stands in for a group that no gathering
 * record backs yet: it appears only once enough people are actually looking.
 */
export function eventCompanions(eventId: string, userId: string): EventCompanions | null {
  const event = publishedEvent(eventId);
  if (!event) return null;
  const stats = participationStats(eventId, userId);
  const companions = mockFriends.flatMap((friend, index) => {
    const record = mockParticipations.get(`${friend.id}:${eventId}`);
    return record === undefined || friend.id === userId ? [] : [companionFor(friend, index, record.status, userId, eventId)];
  });
  const gathering =
    companions.length > MOCK_GATHERING_FACES
      ? {
          members: companions.slice(0, MOCK_GATHERING_FACES).map((companion) => companion.friend),
          extraCount: companions.length - MOCK_GATHERING_FACES,
          meetingNote: `у входа в ${moscowTime(new Date(event.startsAt).getTime() - MOCK_GATHERING_LEAD_MIN * 60 * 1000)}`,
        }
      : null;
  return {
    counts: {
      going: stats.counts.going,
      wants: stats.counts.wants_to_go + stats.counts.probably_going,
      looking: stats.counts.looking_for_company + stats.counts.looking_for_travel_buddy + stats.counts.looking_for_after_event_company,
    },
    myStatus: stats.myStatus,
    companions,
    gathering,
  };
}

/**
 * Mock GET /events/:id/booking-offer (#496). The queue length is real; who holds a ticket is not
 * reported by any DTO, so a friend with an active booking counts, and on a paid event so does a
 * friend who marked «иду» — the fixtures book almost nobody, and a «going» on a ticketed event is
 * the closest honest stand-in until the endpoint exists.
 */
export function bookingOfferFor(eventId: string, userId: string): BookingOffer | null {
  const event = publishedEvent(eventId);
  if (!event) return null;
  const holders = new Set(mockBookings.filter((booking) => booking.eventId === eventId && booking.status === "active").map((booking) => booking.userId));
  if (event.isPaid) {
    for (const row of mockParticipations.values()) {
      if (row.eventId === eventId && row.status === "going") holders.add(row.userId);
    }
  }
  return { waitlistAhead: waitlistAheadCount(eventId), friendsWithTickets: mockFriends.filter((friend) => friend.id !== userId && holders.has(friend.id)) };
}
