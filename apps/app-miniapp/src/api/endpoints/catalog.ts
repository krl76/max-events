// START_MODULE_CONTRACT
// PURPOSE: Catalog endpoints of the api client: the event and place listings, the event page aggregate, the participation block and the map context of экран 16 (weather, travel time).
// SCOPE: Event filters (serialize/parse), GET /events[/:id[/details]], GET /events/cards with its plain-listing fallback, GET /places[/:id[/page]], the /events/:id/participation surface, GET /weather, GET /weather/hourly and GET /travel; client-side aggregates EventDetails, ParticipationStats, CatalogCard, MapWeather and TravelOption live here.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventSort - catalog ordering the list may ask for: soonest / nearest / best rated (#497)
// - EVENT_SORTS - the orderings in design order, so a screen cannot invent a fourth
// - EventFilters - optional catalog list filters (category/city/date/dateFrom/dateTo/minRating/query/sort/limit/offset)
// - serializeEventFilters - filters -> query string ("" when empty)
// - parseEventFilters - query string -> filters, invalid values dropped
// - CatalogCard - list card of экран 08: GET /events/cards (event, distanceKm, rating, placeTitle)
// - catalogCardsFromEvents - catalog cards built out of GET /events + GET /places, for a server that does not answer GET /events/cards yet
// - eventCompanionsFrom - экран 23 built out of the participation stats and the friends on the event, for a server that does not answer GET /events/:id/companions yet
// - MapWeather - city weather behind the map chip (макет, экран 16): now plus the change to come (#495)
// - TravelMode - how the traveller gets there: on foot or by metro (#504)
// - TravelOption - one way to the object: minutes, distance and transfers (#504)
// - EventDetails - event page aggregate: event, place, organizer (nullable), free seats, own active booking
// - ParticipationStats - event page social aggregate: per-status counters, friends count, own status
// - PlaceParticipation - viewer status on a venue (макет, экран 03); the place-level twin of Participation, which the slot domain will own (#492)
// - EventWeatherHour - one column of the hourly weather strip of экран 17 (#495)
// - EventForecast - hourly forecast for the event window: attribution source, the columns and the warning line (#495)
// - EventMoodTag - one «Обстановка» tag of экран 17 with how many participants marked it; no such dictionary exists yet
// - EventNearbySpot - one «Рядом» row of экран 17: a venue around the event with the walking distance in metres
// - EventCompanion - one person of экран 23: their participation status, where you know them from, interest matches and their note
// - EventGatheringTeaser - the «Собирается компания» block of экран 23: who is already agreeing and where they meet
// - EventCompanions - экран 23 aggregate: the three tab counters, the viewer status, the people and the gathering teaser
// - BookingOffer - экран 18 aggregate the booking sheet needs on top of EventDetails: the queue length ahead and the friends already holding tickets (#496)
// - withCatalog - ApiClient.listEvents / listEventCards / listPlaces / getEvent / getEventDetails / getPlace / getPlacePage / getMapWeather / getMapHourlyWeather / getTravelOptions / getParticipationStats / setParticipationStatus / deleteParticipation / setPlaceParticipationStatus / getEventForecast / listEventMoodTags / listEventNearby / getEventCompanions / getBookingOffer
// END_MODULE_MAP

import { EventCategorySchema, EventFriendsSummarySchema, EventSchema, FriendSchema, OrganizationSchema, ParticipationSchema, ParticipationStatusSchema, PlacePageSchema, PlaceSchema, UserSchema } from "@max-events/api-contracts";
import type { Event, EventCategory, EventFriend, Friend, Organization, Participation, ParticipationStatus, Place, PlacePage, User } from "@max-events/api-contracts";
import { ApiError, isEndpointMissing } from "./transport";
import type { ApiMixin, ZodSchema } from "./transport";

/**
 * Catalog ordering (#497). GET /events accepts these as `sort=`; «Сегодня рядом» asks for `near`,
 * the plain list for `soon`.
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
  /** Full-text needle over the title and description, sent as `q`. */
  query?: string;
  /** Ordering of the answer, sent as `sort`. */
  sort?: EventSort;
  /** Inclusive range start (YYYY-MM-DD); sent as date_from. */
  dateFrom?: string;
  /** Inclusive range end (YYYY-MM-DD); sent as date_to. */
  dateTo?: string;
  /** Page window of the catalog list (1..100 / 0..); the screen pages by these, the URL never carries them. */
  limit?: number;
  offset?: number;
  lat?: number;
  lng?: number;
}

const isDay = (value: string | null): value is string => value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function serializeEventFilters(filters: EventFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.date) params.set("date", filters.date);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  // snake_case: the backend query contract spells it min_rating, next to date_from/date_to.
  if (filters.minRating) params.set("min_rating", String(filters.minRating));
  if (filters.query?.trim()) params.set("q", filters.query.trim());
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  if (filters.lat !== undefined) params.set("lat", String(filters.lat));
  if (filters.lng !== undefined) params.set("lng", String(filters.lng));
  return params.toString();
}

export function parseEventFilters(search: string): EventFilters {
  const params = new URLSearchParams(search);
  const category = EventCategorySchema.safeParse(params.get("category"));
  const date = params.get("date");
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");
  const minRating = Number(params.get("min_rating"));
  const limitRaw = params.get("limit");
  const offsetRaw = params.get("offset");
  const limit = limitRaw === null ? Number.NaN : Number(limitRaw);
  const offset = offsetRaw === null ? Number.NaN : Number(offsetRaw);
  const sort = params.get("sort");
  return {
    category: category.success ? category.data : undefined,
    city: params.get("city")?.trim() || undefined,
    date: isDay(date) ? date : undefined,
    dateFrom: isDay(dateFrom) ? dateFrom : undefined,
    dateTo: isDay(dateTo) ? dateTo : undefined,
    // A value the backend would reject with a 400 is dropped here, like an unknown category.
    minRating: Number.isInteger(minRating) && minRating >= 1 && minRating <= 5 ? minRating : undefined,
    query: params.get("q")?.trim() || undefined,
    sort: isEventSort(sort) ? sort : undefined,
    limit: Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : undefined,
    offset: Number.isInteger(offset) && offset >= 0 ? offset : undefined,
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
  /** «34 события в афише» under the organizer name (макет, экран 17); optional and null until a backend counts them (#496). */
  organizerEventsCount?: number | null;
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
    // Absent, not just null: a backend that predates the organizer counter must not blank the page either.
    if (raw.organizerEventsCount !== null && raw.organizerEventsCount !== undefined && typeof raw.organizerEventsCount !== "number") return { success: false as const, error: "invalid event details" };
    return {
      success: true as const,
      data: { event: event.data, place: place.data, organizer: organizer.data, organization: organization.data, remainingSeats: raw.remainingSeats, activeBookingId: raw.activeBookingId, checkInId: raw.checkInId, organizerEventsCount: raw.organizerEventsCount ?? null },
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

/**
 * One column of the hourly strip of экран 17. The events domain snapshots a single forecast taken at
 * the event start (EventWeatherService.attach, #495) — there is no hourly surface at all — so this is
 * the shape that endpoint will answer. `withinEvent` marks the hours the event actually covers: the
 * design dims the tail past the end rather than dropping it, because «что будет, когда всё кончится»
 * is exactly what the strip is read for.
 */
export interface EventWeatherHour {
  /** ISO timestamp of the hour this column stands for. */
  at: string;
  temperatureC: number;
  /** WMO code, so a screen picks its glyph without parsing the ru wording. */
  conditionCode: number;
  condition: string;
  withinEvent: boolean;
}

/** Hourly forecast for the event window plus the attribution and the warning under it (#495). */
export interface EventForecast {
  /** Who the forecast comes from. It is printed on screen, so the provider is data, never a literal in the markup. */
  source: string;
  hours: EventWeatherHour[];
  /** «Дождь после 19:00, вероятность 70%»; null when nothing is expected. */
  note: string | null;
}

const parseWeatherHour = (raw: unknown): EventWeatherHour | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const hour = raw as Record<string, unknown>;
  if (typeof hour.at !== "string" || typeof hour.temperatureC !== "number") return null;
  if (typeof hour.conditionCode !== "number" || typeof hour.condition !== "string" || typeof hour.withinEvent !== "boolean") return null;
  return { at: hour.at, temperatureC: hour.temperatureC, conditionCode: hour.conditionCode, condition: hour.condition, withinEvent: hour.withinEvent };
};

const EventForecastSchema: ZodSchema<EventForecast> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected an event forecast object" };
    const raw = data as Record<string, unknown>;
    if (typeof raw.source !== "string" || !Array.isArray(raw.hours) || !isNullableString(raw.note)) return { success: false as const, error: "invalid event forecast" };
    const hours: EventWeatherHour[] = [];
    for (const item of raw.hours) {
      const hour = parseWeatherHour(item);
      if (hour === null) return { success: false as const, error: "invalid event forecast" };
      hours.push(hour);
    }
    return { success: true as const, data: { source: raw.source, hours, note: raw.note } };
  },
};

/**
 * One «Обстановка» tag of экран 17: what the room felt like, and how many participants said so. The
 * domain has no tag dictionary — the post-event fact tags (#500) are a different, review-time list —
 * so both the codes and the counters are mock-backed behind the signature the endpoint will take.
 */
export interface EventMoodTag {
  code: string;
  label: string;
  count: number;
}

const EventMoodTagsSchema: ZodSchema<EventMoodTag[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected a mood tag array" };
    const tags: EventMoodTag[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) return { success: false as const, error: "invalid mood tag" };
      const raw = item as Record<string, unknown>;
      if (typeof raw.code !== "string" || typeof raw.label !== "string" || typeof raw.count !== "number") return { success: false as const, error: "invalid mood tag" };
      tags.push({ code: raw.code, label: raw.label, count: raw.count });
    }
    return { success: true as const, data: tags };
  },
};

/**
 * One «Рядом» row of экран 17: a venue around the event and how far it is on foot. Nothing selects
 * places around an event today, so this stands in for that endpoint; the distance is in metres,
 * because the design prints «200 м» and rounding to kilometres would erase the whole answer.
 */
export interface EventNearbySpot {
  id: string;
  title: string;
  distanceM: number;
  category: Place["category"];
}

const EventNearbySchema: ZodSchema<EventNearbySpot[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected a nearby spot array" };
    const spots: EventNearbySpot[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) return { success: false as const, error: "invalid nearby spot" };
      const raw = item as Record<string, unknown>;
      const category = PlaceSchema.shape.category.safeParse(raw.category);
      if (typeof raw.id !== "string" || typeof raw.title !== "string" || typeof raw.distanceM !== "number" || !category.success) return { success: false as const, error: "invalid nearby spot" };
      spots.push({ id: raw.id, title: raw.title, distanceM: raw.distanceM, category: category.data });
    }
    return { success: true as const, data: spots };
  },
};

/**
 * One person of экран 23. Participation carries the status and nothing else, so everything that makes
 * the row worth reading — the chat you both sit in, the plans you shared, the interests that overlap
 * and the line they wrote — is mock-backed behind this signature.
 */
export interface EventCompanion {
  friend: Friend;
  status: ParticipationStatus;
  /** «Из чата «Двор»»; null for someone outside your chats — the design says so out loud. */
  chatTitle: string | null;
  sharedPlansCount: number;
  /** How many interests overlap with yours; 0 renders no badge rather than «0 совпадений». */
  matchesCount: number;
  interests: string[];
  /** The line they left under their status; null when they left none. */
  note: string | null;
}

/** The «Собирается компания» block of экран 23: who is already agreeing and where they meet. */
export interface EventGatheringTeaser {
  members: Friend[];
  /** Everyone past the faces the block draws, so «и ещё 2» is a number and not a guess. */
  extraCount: number;
  /** «у входа в 19:30» — the place and time they settled on. */
  meetingNote: string;
}

/** Экран 23 aggregate: the three tab counters, the viewer status, the people and the gathering teaser. */
export interface EventCompanions {
  counts: { going: number; wants: number; looking: number };
  myStatus: ParticipationStatus | null;
  companions: EventCompanion[];
  gathering: EventGatheringTeaser | null;
}

const parseCompanion = (raw: unknown): EventCompanion | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const friend = FriendSchema.safeParse(row.friend);
  const status = ParticipationStatusSchema.safeParse(row.status);
  if (!friend.success || !status.success || !isNullableString(row.chatTitle) || !isNullableString(row.note)) return null;
  if (typeof row.sharedPlansCount !== "number" || typeof row.matchesCount !== "number" || !Array.isArray(row.interests)) return null;
  if (row.interests.some((interest) => typeof interest !== "string")) return null;
  return { friend: friend.data, status: status.data, chatTitle: row.chatTitle, sharedPlansCount: row.sharedPlansCount, matchesCount: row.matchesCount, interests: row.interests as string[], note: row.note };
};

const EventCompanionsSchema: ZodSchema<EventCompanions> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected an event companions object" };
    const raw = data as Record<string, unknown>;
    const counts = raw.counts as Record<string, unknown> | undefined;
    if (typeof counts !== "object" || counts === null) return { success: false as const, error: "invalid event companions" };
    if (typeof counts.going !== "number" || typeof counts.wants !== "number" || typeof counts.looking !== "number") return { success: false as const, error: "invalid event companions" };
    const myStatus = raw.myStatus === null ? { success: true as const, data: null } : ParticipationStatusSchema.safeParse(raw.myStatus);
    if (!myStatus.success || !Array.isArray(raw.companions)) return { success: false as const, error: "invalid event companions" };
    const companions: EventCompanion[] = [];
    for (const item of raw.companions) {
      const companion = parseCompanion(item);
      if (companion === null) return { success: false as const, error: "invalid event companions" };
      companions.push(companion);
    }
    let gathering: EventGatheringTeaser | null = null;
    if (raw.gathering !== null && raw.gathering !== undefined) {
      const teaser = raw.gathering as Record<string, unknown>;
      const members = FriendSchema.array().safeParse(teaser.members);
      if (!members.success || typeof teaser.extraCount !== "number" || typeof teaser.meetingNote !== "string") return { success: false as const, error: "invalid event companions" };
      gathering = { members: members.data, extraCount: teaser.extraCount, meetingNote: teaser.meetingNote };
    }
    return { success: true as const, data: { counts: { going: counts.going, wants: counts.wants, looking: counts.looking }, myStatus: myStatus.data, companions, gathering } };
  },
};

/**
 * What экран 18 needs on top of EventDetails, which already carries the price, the capacity and the
 * free seats. Neither number below exists in a DTO today (#496): the waitlist answers a position only
 * to the person standing in it, and nothing reports who among your friends already has a ticket.
 */
export interface BookingOffer {
  /** How many people are already queued — «7 впереди» before you join. */
  waitlistAhead: number;
  friendsWithTickets: Friend[];
}

const BookingOfferSchema: ZodSchema<BookingOffer> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a booking offer object" };
    const raw = data as Record<string, unknown>;
    const friends = FriendSchema.array().safeParse(raw.friendsWithTickets);
    if (typeof raw.waitlistAhead !== "number" || !friends.success) return { success: false as const, error: "invalid booking offer" };
    return { success: true as const, data: { waitlistAhead: raw.waitlistAhead, friendsWithTickets: friends.data } };
  },
};

/**
 * Экран 23 assembled from the two endpoints a server without GET /events/:id/companions does have:
 * the participation stats behind the three counters and the friends on the event behind the rows.
 * What makes a row worth reading past the name and the status — the shared chat, the shared plans,
 * the interest matches, the note — has no field anywhere, so a row carries none of it and the badges
 * it would draw are simply not drawn. Nothing selects «the gathering of this event» either, so the
 * «Собирается компания» teaser stays absent rather than being guessed at from the same friends.
 */
export function eventCompanionsFrom(stats: ParticipationStats, friends: EventFriend[]): EventCompanions {
  return {
    counts: {
      going: stats.counts.going,
      wants: stats.counts.wants_to_go + stats.counts.probably_going,
      looking: stats.counts.looking_for_company + stats.counts.looking_for_travel_buddy + stats.counts.looking_for_after_event_company,
    },
    myStatus: stats.myStatus,
    companions: friends.map((row) => ({ friend: row.friend, status: row.participationStatus, chatTitle: null, sharedPlansCount: 0, matchesCount: 0, interests: [], note: null })),
    gathering: null,
  };
}

/**
 * Catalog cards assembled from the plain listing, for a server that does not answer GET /events/cards
 * yet. Only the venue line has a source there — the distance and the rating are the #496 gap and stay
 * empty, because a card that prints «0,0 км» has answered a question it cannot answer.
 */
export function catalogCardsFromEvents(events: Event[], places: Place[]): CatalogCard[] {
  return events.map((event) => ({ event, distanceKm: null, rating: null, placeTitle: places.find((item) => item.id === event.placeId)?.title ?? null }));
}

/**
 * Whether GET /events/cards was refused because the path is not routed. A server without it reads
 * `cards` as the :id of GET /events/:id and answers 400 to the uuid pipe long before any handler —
 * so on this path, and only on it, a 400 means the same thing as the 404 of an unrouted path.
 */
function isCatalogCardsMissing(error: unknown): boolean {
  return isEndpointMissing(error) || (error instanceof ApiError && error.status === 400);
}

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
    async listEventCards(filters: EventFilters = {}, origin: { latitude: number; longitude: number } | null = null): Promise<CatalogCard[]> {
      const filterQuery = serializeEventFilters(filters);
      const params = new URLSearchParams(filterQuery);
      if (origin !== null) {
        params.set("latitude", String(origin.latitude));
        params.set("longitude", String(origin.longitude));
      }
      const query = params.toString();
      try {
        return await this.request(`/events/cards${query ? `?${query}` : ""}`, CatalogCardsSchema);
      } catch (error) {
        if (!isCatalogCardsMissing(error)) throw error;
        const fallbackQuery = serializeEventFilters(origin === null ? filters : { ...filters, lat: origin.latitude, lng: origin.longitude });
        const [events, places] = await Promise.all([this.request(`/events${fallbackQuery ? `?${fallbackQuery}` : ""}`, EventSchema.array()), this.request("/places", PlaceSchema.array())]);
        return catalogCardsFromEvents(events, places);
      }
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

    /** City weather behind the map chip (макет, экран 16); GET /weather?city= or lat/lng of the viewer. */
    getMapWeather(city: string, origin?: { latitude: number; longitude: number }): Promise<MapWeather> {
      const query =
        origin === undefined
          ? `city=${encodeURIComponent(city)}`
          : `lat=${encodeURIComponent(String(origin.latitude))}&lng=${encodeURIComponent(String(origin.longitude))}`;
      return this.request(`/weather?${query}`, MapWeatherSchema);
    }

    /** Hourly forecast at the viewer point; GET /weather/hourly?lat=&lng=&from=&to=. */
    getMapHourlyWeather(origin: { latitude: number; longitude: number }, from: Date, to: Date): Promise<EventForecast> {
      const params = new URLSearchParams({
        lat: String(origin.latitude),
        lng: String(origin.longitude),
        from: from.toISOString(),
        to: to.toISOString(),
      });
      return this.request(`/weather/hourly?${params.toString()}`, EventForecastSchema);
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

    /** Hourly weather over the event window (макет, экран 17); GET /events/:id/weather/hourly. */
    getEventForecast(eventId: string): Promise<EventForecast> {
      return this.request(`/events/${eventId}/weather/hourly`, EventForecastSchema);
    }

    /** «Обстановка» tags of экран 17; GET /events/:id/mood-tags. */
    listEventMoodTags(eventId: string): Promise<EventMoodTag[]> {
      return this.request(`/events/${eventId}/mood-tags`, EventMoodTagsSchema);
    }

    /** «Рядом» venues around the event (макет, экран 17); GET /events/:id/nearby. */
    listEventNearby(eventId: string): Promise<EventNearbySpot[]> {
      return this.request(`/events/${eventId}/nearby`, EventNearbySchema);
    }

    /**
     * Экран 23 aggregate: counters, the viewer status, the people and the gathering teaser; the matches
     * are mock-only. A server without this path answers the counters and the friends separately, so the
     * screen is assembled from those (eventCompanionsFrom) instead of failing whole.
     */
    async getEventCompanions(eventId: string, userId: string): Promise<EventCompanions> {
      try {
        return await this.request(`/events/${eventId}/companions?userId=${encodeURIComponent(userId)}`, EventCompanionsSchema);
      } catch (error) {
        if (!isEndpointMissing(error)) throw error;
        const [stats, friends] = await Promise.all([this.request(`/events/${eventId}/participation/stats?userId=${encodeURIComponent(userId)}`, ParticipationStatsSchema), this.request(`/events/${eventId}/friends`, EventFriendsSummarySchema)]);
        return eventCompanionsFrom(stats, friends.friends);
      }
    }

    /** What экран 18 needs past EventDetails: the queue length and the friends already holding tickets (#496). */
    getBookingOffer(eventId: string, userId: string): Promise<BookingOffer> {
      return this.request(`/events/${eventId}/booking-offer?userId=${encodeURIComponent(userId)}`, BookingOfferSchema);
    }
  };
}
