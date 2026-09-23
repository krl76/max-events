// START_MODULE_CONTRACT
// PURPOSE: Catalog endpoints of the api client: the event and place listings, the event page aggregate, the participation block and the map context of экран 16 (weather, travel time).
// SCOPE: Event filters (serialize/parse), GET /events[/:id[/details]], GET /events/cards, GET /places[/:id[/page]], the /events/:id/participation surface, GET /weather and GET /travel; client-side aggregates EventDetails, ParticipationStats, CatalogCard, MapWeather and TravelOption live here.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventSort - catalog ordering the list may ask for: soonest / nearest / best rated (#497)
// - EVENT_SORTS - the orderings in design order, so a screen cannot invent a fourth
// - EventFilters - optional catalog list filters (category/city/date/minRating/query/sort)
// - serializeEventFilters - filters -> query string ("" when empty)
// - parseEventFilters - query string -> filters, invalid values dropped
// - CatalogCard - list card of экран 08: the event plus the distance, rating and venue line the list DTO does not carry (#496)
// - MapWeather - city weather behind the map chip (макет, экран 16): now plus the change to come (#495)
// - TravelMode - how the traveller gets there: on foot or by metro (#504)
// - TravelOption - one way to the object: minutes, distance and transfers (#504)
// - EventDetails - event page aggregate: event, place, organizer (nullable), free seats, own active booking
// - ParticipationStats - event page social aggregate: per-status counters, friends count, own status
// - PlaceParticipation - viewer status on a venue (макет, экран 03); the place-level twin of Participation, which the slot domain will own (#492)
// - withCatalog - ApiClient.listEvents / listEventCards / listPlaces / getEvent / getEventDetails / getPlace / getPlacePage / getMapWeather / getTravelOptions / getParticipationStats / setParticipationStatus / deleteParticipation / setPlaceParticipationStatus
// END_MODULE_MAP

import { EventCategorySchema, EventSchema, OrganizationSchema, ParticipationSchema, ParticipationStatusSchema, PlacePageSchema, PlaceSchema, UserSchema } from "@max-events/api-contracts";
import type { Event, EventCategory, Organization, Participation, ParticipationStatus, Place, PlacePage, User } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/**
 * Catalog ordering (#497). The backend orders by start time and nothing else, so this is the
 * parameter that endpoint will take: «Сегодня рядом» asks for `near`, the plain list for `soon`.
 */
export type EventSort = "soon" | "near" | "rating";

export const EVENT_SORTS: readonly EventSort[] = ["soon", "near", "rating"];

const isEventSort = (value: string | null): value is EventSort => value !== null && (EVENT_SORTS as readonly string[]).includes(value);

/** Catalog list filters; a missing or empty value means "no filter". */
export interface EventFilters {
  category?: EventCategory;
  city?: string;
  /** ISO date (YYYY-MM-DD) of the event start day. */
  date?: string;
  /** Average review score the event must reach, 1..5; an event nobody reviewed never qualifies. */
  minRating?: number;
  /** Full-text needle over the title, description and venue; there is no such endpoint yet (#497). */
  query?: string;
  /** Ordering of the answer; the backend hardcodes «soonest first» today (#497). */
  sort?: EventSort;
}

export function serializeEventFilters(filters: EventFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.date) params.set("date", filters.date);
  // snake_case: the backend query contract spells it min_rating, next to date_from/date_to.
  if (filters.minRating) params.set("min_rating", String(filters.minRating));
  if (filters.query?.trim()) params.set("q", filters.query.trim());
  if (filters.sort) params.set("sort", filters.sort);
  return params.toString();
}

export function parseEventFilters(search: string): EventFilters {
  const params = new URLSearchParams(search);
  const category = EventCategorySchema.safeParse(params.get("category"));
  const date = params.get("date");
  const minRating = Number(params.get("min_rating"));
  const sort = params.get("sort");
  return {
    category: category.success ? category.data : undefined,
    city: params.get("city")?.trim() || undefined,
    date: date !== null && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    // A value the backend would reject with a 400 is dropped here, like an unknown category.
    minRating: Number.isInteger(minRating) && minRating >= 1 && minRating <= 5 ? minRating : undefined,
    query: params.get("q")?.trim() || undefined,
    sort: isEventSort(sort) ? sort : undefined,
  };
}

const isNullableNumber = (value: unknown): value is number | null => value === null || typeof value === "number";

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";

/**
 * One card of the списки экрана 08 («Для вас», «Сегодня рядом»). The list DTO carries an Event and
 * nothing else — no distance, no rating, no venue name (#496) — so those three arrive nullable here:
 * a card that cannot measure a distance says nothing instead of printing a zero.
 */
export interface CatalogCard {
  event: Event;
  /** «2,1 км»; null until the list DTO carries the distance (#496). */
  distanceKm: number | null;
  /** «4.8»; null until the list DTO carries the rating (#496). */
  rating: number | null;
  /** «Парк Горького» — the venue line under the title; null for an event without a place. */
  placeTitle: string | null;
}

function parseCatalogCard(raw: unknown): CatalogCard | null {
  if (typeof raw !== "object" || raw === null) return null;
  const card = raw as Record<string, unknown>;
  const event = EventSchema.safeParse(card.event);
  if (!event.success || !isNullableNumber(card.distanceKm) || !isNullableNumber(card.rating) || !isNullableString(card.placeTitle)) return null;
  return { event: event.data, distanceKm: card.distanceKm, rating: card.rating, placeTitle: card.placeTitle };
}

const CatalogCardsSchema: ZodSchema<CatalogCard[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected a catalog card array" };
    const cards: CatalogCard[] = [];
    for (const item of data) {
      const card = parseCatalogCard(item);
      if (card === null) return { success: false as const, error: "invalid catalog card" };
      cards.push(card);
    }
    return { success: true as const, data: cards };
  },
};

/**
 * What the weather chip of экран 16 prints: «+19° · дождь в 19:00». The events domain stores a
 * forecast snapshot taken at the event start (#495) — there is no «weather here, now» surface at
 * all — so this is the shape that endpoint will answer. The change is nullable: a day with nothing
 * coming shows the temperature alone rather than an invented turn in the weather.
 */
export interface MapWeather {
  temperatureC: number;
  condition: string;
  /** ISO timestamp the change starts at; null when nothing is expected. */
  changesAt: string | null;
  /** «дождь» — what is expected at changesAt; null together with changesAt. */
  changesTo: string | null;
}

const MapWeatherSchema: ZodSchema<MapWeather> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a map weather object" };
    const raw = data as Record<string, unknown>;
    if (typeof raw.temperatureC !== "number" || typeof raw.condition !== "string") return { success: false as const, error: "invalid map weather" };
    if (!isNullableString(raw.changesAt) || !isNullableString(raw.changesTo)) return { success: false as const, error: "invalid map weather" };
    return { success: true as const, data: { temperatureC: raw.temperatureC, condition: raw.condition, changesAt: raw.changesAt, changesTo: raw.changesTo } };
  },
};

/** How the traveller gets there. The routing domain knows distance and nothing about transport (#504). */
export type TravelMode = "walk" | "metro";

/** One way to the selected object (макет, экран 16): «18 мин · пешком · 1,4 км», «9 мин · метро · 1 пересадка». */
export interface TravelOption {
  mode: TravelMode;
  minutes: number;
  /** Route length, km; null when the mode does not measure one (#504). */
  distanceKm: number | null;
  /** Interchanges on the way; null for modes without them, like walking (#504). */
  transfers: number | null;
}

const TRAVEL_MODES: readonly TravelMode[] = ["walk", "metro"];

const TravelOptionsSchema: ZodSchema<TravelOption[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected a travel option array" };
    const options: TravelOption[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) return { success: false as const, error: "invalid travel option" };
      const raw = item as Record<string, unknown>;
      if (typeof raw.mode !== "string" || !TRAVEL_MODES.includes(raw.mode as TravelMode)) return { success: false as const, error: "invalid travel option" };
      if (typeof raw.minutes !== "number" || !isNullableNumber(raw.distanceKm) || !isNullableNumber(raw.transfers)) return { success: false as const, error: "invalid travel option" };
      options.push({ mode: raw.mode as TravelMode, minutes: raw.minutes, distanceKm: raw.distanceKm, transfers: raw.transfers });
    }
    return { success: true as const, data: options };
  },
};

/** Aggregate for the event page: everything the details screen renders in one request. */
export interface EventDetails {
  event: Event;
  place: Place | null;
  /** The event organizer; null for events without an organizerUserId. */
  organizer: User | null;
  /** The organization that organizer publishes for; null when they belong to none. */
  organization: Organization | null;
  remainingSeats: number | null;
  activeBookingId: string | null;
  checkInId: string | null;
}

const EventDetailsSchema: ZodSchema<EventDetails> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected an event details object" };
    const raw = data as Record<string, unknown>;
    const event = EventSchema.safeParse(raw.event);
    const organizer = raw.organizer === null ? { success: true as const, data: null } : UserSchema.safeParse(raw.organizer);
    // Absent, not just null: a backend that predates the organization field must not blank the page.
    const organization = raw.organization === null || raw.organization === undefined ? { success: true as const, data: null } : OrganizationSchema.safeParse(raw.organization);
    const place = raw.place === null ? { success: true as const, data: null } : PlaceSchema.safeParse(raw.place);
    if (!event.success || !organizer.success || !organization.success || !place.success) return { success: false as const, error: "invalid event details" };
    if (raw.remainingSeats !== null && typeof raw.remainingSeats !== "number") return { success: false as const, error: "invalid event details" };
    if (raw.activeBookingId !== null && typeof raw.activeBookingId !== "string") return { success: false as const, error: "invalid event details" };
    if (raw.checkInId !== null && typeof raw.checkInId !== "string") return { success: false as const, error: "invalid event details" };
    return {
      success: true as const,
      data: { event: event.data, place: place.data, organizer: organizer.data, organization: organization.data, remainingSeats: raw.remainingSeats, activeBookingId: raw.activeBookingId, checkInId: raw.checkInId },
    };
  },
};

/** Social block aggregate for the event page: per-status counters, friends on the event, own status. */
export interface ParticipationStats {
  counts: Record<ParticipationStatus, number>;
  friendsCount: number;
  myStatus: ParticipationStatus | null;
}

const ParticipationStatsSchema: ZodSchema<ParticipationStats> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a participation stats object" };
    const raw = data as Record<string, unknown>;
    if (typeof raw.counts !== "object" || raw.counts === null || typeof raw.friendsCount !== "number") return { success: false as const, error: "invalid participation stats" };
    const counts = { wants_to_go: 0, probably_going: 0, going: 0, looking_for_company: 0, looking_for_travel_buddy: 0, looking_for_after_event_company: 0 } as Record<ParticipationStatus, number>;
    for (const [status, value] of Object.entries(raw.counts)) {
      const parsed = ParticipationStatusSchema.safeParse(status);
      if (!parsed.success || typeof value !== "number") return { success: false as const, error: "invalid participation stats" };
      counts[parsed.data] = value;
    }
    const myStatus = raw.myStatus === null ? { success: true as const, data: null } : ParticipationStatusSchema.safeParse(raw.myStatus);
    if (!myStatus.success) return { success: false as const, error: "invalid participation stats" };
    return { success: true as const, data: { counts, friendsCount: raw.friendsCount, myStatus: myStatus.data } };
  },
};

/**
 * Viewer status on a venue (макет, экран 03, блок «Твой статус на этой площадке»). Participation is
 * an event-level domain today — a place has no such surface until the slot domain lands (#492) — so
 * this is the shape that endpoint will answer: the same closed status enum, keyed by place.
 */
export interface PlaceParticipation {
  placeId: string;
  status: ParticipationStatus | null;
}

const PlaceParticipationSchema: ZodSchema<PlaceParticipation> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a place participation object" };
    const raw = data as Record<string, unknown>;
    const status = raw.status === null ? { success: true as const, data: null } : ParticipationStatusSchema.safeParse(raw.status);
    if (typeof raw.placeId !== "string" || !status.success) return { success: false as const, error: "invalid place participation" };
    return { success: true as const, data: { placeId: raw.placeId, status: status.data } };
  },
};

export function withCatalog<TBase extends ApiMixin>(Base: TBase) {
  return class CatalogEndpoints extends Base {
    listEvents(filters: EventFilters = {}): Promise<Event[]> {
      const query = serializeEventFilters(filters);
      return this.request(`/events${query ? `?${query}` : ""}`, EventSchema.array());
    }

    /**
     * The same list as listEvents, enriched with what a card of экран 08 prints. A separate path
     * rather than a wider /events: the plain listing is what every other screen reads, and the
     * distance/rating gap (#496) belongs to the card surface, not to the Event entity.
     */
    listEventCards(filters: EventFilters = {}, origin: { latitude: number; longitude: number } | null = null): Promise<CatalogCard[]> {
      const params = new URLSearchParams(serializeEventFilters(filters));
      if (origin !== null) {
        params.set("latitude", String(origin.latitude));
        params.set("longitude", String(origin.longitude));
      }
      const query = params.toString();
      return this.request(`/events/cards${query ? `?${query}` : ""}`, CatalogCardsSchema);
    }

    listPlaces(): Promise<Place[]> {
      return this.request("/places", PlaceSchema.array());
    }

    getEvent(id: string): Promise<Event> {
      return this.request(`/events/${id}`, EventSchema);
    }

    getEventDetails(id: string, userId: string): Promise<EventDetails> {
      return this.request(`/events/${id}/details?userId=${encodeURIComponent(userId)}`, EventDetailsSchema);
    }

    getPlace(id: string): Promise<Place> {
      return this.request(`/places/${id}`, PlaceSchema);
    }

    getPlacePage(placeId: string, userId: string): Promise<PlacePage> {
      return this.request(`/places/${placeId}/page?userId=${encodeURIComponent(userId)}`, PlacePageSchema);
    }

    /** City weather behind the map chip (макет, экран 16); mock-only until a «weather now» surface exists (#495). */
    getMapWeather(city: string): Promise<MapWeather> {
      return this.request(`/weather?city=${encodeURIComponent(city)}`, MapWeatherSchema);
    }

    /**
     * Ways from the viewer to one place (макет, экран 16). Routing answers a distance and no modes
     * of transport at all (#504), so both the path and the shape stand in for the endpoint that will.
     */
    getTravelOptions(placeId: string, origin: { latitude: number; longitude: number }): Promise<TravelOption[]> {
      const params = new URLSearchParams({ placeId, latitude: String(origin.latitude), longitude: String(origin.longitude) });
      return this.request(`/travel?${params.toString()}`, TravelOptionsSchema);
    }

    getParticipationStats(eventId: string, userId: string): Promise<ParticipationStats> {
      return this.request(`/events/${eventId}/participation/stats?userId=${encodeURIComponent(userId)}`, ParticipationStatsSchema);
    }

    /** Set participation status (PUT); the userId param is ignored server-side, identity comes from initData. */
    setParticipationStatus(eventId: string, userId: string, status: ParticipationStatus): Promise<Participation> {
      return this.request(`/events/${eventId}/participation?userId=${encodeURIComponent(userId)}`, ParticipationSchema, { method: "PUT", body: { status } });
    }

    /** Delete participation (DELETE); the userId param is ignored server-side, identity comes from initData. */
    deleteParticipation(eventId: string, userId: string): Promise<Participation> {
      return this.request(`/events/${eventId}/participation?userId=${encodeURIComponent(userId)}`, ParticipationSchema, { method: "DELETE" });
    }

    /** Set the viewer status on a venue (PUT); status null clears it. Mock-only until the slot domain lands (#492). */
    setPlaceParticipationStatus(placeId: string, userId: string, status: ParticipationStatus | null): Promise<PlaceParticipation> {
      return this.request(`/places/${placeId}/participation?userId=${encodeURIComponent(userId)}`, PlaceParticipationSchema, { method: "PUT", body: { status } });
    }
  };
}
