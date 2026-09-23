// START_MODULE_CONTRACT
// PURPOSE: Catalog endpoints of the api client: the event and place listings, the event page aggregate and the participation block.
// SCOPE: Event filters (serialize/parse), GET /events[/:id[/details]], GET /places[/:id[/page]], the /events/:id/participation surface; client-side aggregates EventDetails and ParticipationStats live here.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventFilters - optional catalog list filters (category/city/date/minRating)
// - serializeEventFilters - filters -> query string ("" when empty)
// - parseEventFilters - query string -> filters, invalid values dropped
// - EventDetails - event page aggregate: event, place, organizer (nullable), free seats, own active booking
// - ParticipationStats - event page social aggregate: per-status counters, friends count, own status
// - withCatalog - ApiClient.listEvents / listPlaces / getEvent / getEventDetails / getPlace / getPlacePage / getParticipationStats / setParticipationStatus / deleteParticipation
// END_MODULE_MAP

import { EventCategorySchema, EventSchema, OrganizationSchema, ParticipationSchema, ParticipationStatusSchema, PlacePageSchema, PlaceSchema, UserSchema } from "@max-events/api-contracts";
import type { Event, EventCategory, Organization, Participation, ParticipationStatus, Place, PlacePage, User } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/** Catalog list filters; a missing or empty value means "no filter". */
export interface EventFilters {
  category?: EventCategory;
  city?: string;
  /** ISO date (YYYY-MM-DD) of the event start day. */
  date?: string;
  /** Average review score the event must reach, 1..5; an event nobody reviewed never qualifies. */
  minRating?: number;
}

export function serializeEventFilters(filters: EventFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.date) params.set("date", filters.date);
  // snake_case: the backend query contract spells it min_rating, next to date_from/date_to.
  if (filters.minRating) params.set("min_rating", String(filters.minRating));
  return params.toString();
}

export function parseEventFilters(search: string): EventFilters {
  const params = new URLSearchParams(search);
  const category = EventCategorySchema.safeParse(params.get("category"));
  const date = params.get("date");
  const minRating = Number(params.get("min_rating"));
  return {
    category: category.success ? category.data : undefined,
    city: params.get("city")?.trim() || undefined,
    date: date !== null && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    // A value the backend would reject with a 400 is dropped here, like an unknown category.
    minRating: Number.isInteger(minRating) && minRating >= 1 && minRating <= 5 ? minRating : undefined,
  };
}

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

export function withCatalog<TBase extends ApiMixin>(Base: TBase) {
  return class CatalogEndpoints extends Base {
    listEvents(filters: EventFilters = {}): Promise<Event[]> {
      const query = serializeEventFilters(filters);
      return this.request(`/events${query ? `?${query}` : ""}`, EventSchema.array());
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
  };
}
