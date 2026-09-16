// START_MODULE_CONTRACT
// PURPOSE: Typed fetch wrapper over the backend /api using zod contracts from @max-events/api-contracts.
// SCOPE: Base URL resolution, typed GET/POST methods per contract, unified ApiError handling.
// DEPENDS: @max-events/api-contracts (zod), fetch (global)
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ApiError - unified API error with HTTP status
// - ApiClient - configurable fetch wrapper with typed methods
// - apiClient - default singleton instance
// - ApiClient.login - POST /auth/login with raw MAX initData
// - EventFilters - optional catalog list filters (category/city/date)
// - ApiClient.listEvents - GET /events with serialized filters
// - serializeEventFilters - filters -> query string ("" when empty)
// - parseEventFilters - query string -> filters, invalid values dropped
// - EventDetails - event page aggregate: event, place, organizer, free seats, own active booking
// - ApiClient.getEventDetails - GET /events/:id/details?userId=
// - ApiClient.createBooking - POST /bookings
// - ApiClient.cancelBooking - DELETE /bookings/:id
// - ApiClient.getProfile - GET /users/:id/profile
// - ApiClient.updateProfile - PATCH /users/:id/profile
// - CalendarEntry - calendar item: active booking enriched with its event and place
// - ApiClient.listCalendar - GET /bookings?userId=
// END_MODULE_MAP

import { AuthResponseSchema, BookingSchema, EventCategorySchema, EventSchema, PlaceSchema, ProfileSchema, UserSchema } from "@max-events/api-contracts";
import type { AuthRequest, AuthResponse, Booking, CreateBooking, CreateEvent, CreatePlace, Event, EventCategory, Place, Profile, UpdateProfile, User } from "@max-events/api-contracts";

/** Minimal structural shape of a zod schema needed to validate responses. */
interface ZodSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

const DEFAULT_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface MethodOptions {
  /** HTTP method for requests without a body (DELETE) or overriding POST for body payloads (PATCH). */
  method?: "DELETE" | "PATCH";
  /** JSON body for POST/PATCH requests; serialized and sent as application/json. */
  body?: unknown;
}

/** Catalog list filters; a missing or empty value means "no filter". */
export interface EventFilters {
  category?: EventCategory;
  city?: string;
  /** ISO date (YYYY-MM-DD) of the event start day. */
  date?: string;
}

export function serializeEventFilters(filters: EventFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.date) params.set("date", filters.date);
  return params.toString();
}

export function parseEventFilters(search: string): EventFilters {
  const params = new URLSearchParams(search);
  const category = EventCategorySchema.safeParse(params.get("category"));
  const date = params.get("date");
  return {
    category: category.success ? category.data : undefined,
    city: params.get("city")?.trim() || undefined,
    date: date !== null && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
  };
}

const EventArraySchema: ZodSchema<Event[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of events" };
    const events: Event[] = [];
    for (const item of data) {
      const parsed = EventSchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      events.push(parsed.data);
    }
    return { success: true as const, data: events };
  },
};

/** Aggregate for the event page: everything the details screen renders in one request. */
export interface EventDetails {
  event: Event;
  place: Place | null;
  organizer: User;
  remainingSeats: number | null;
  activeBookingId: string | null;
}

const EventDetailsSchema: ZodSchema<EventDetails> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected an event details object" };
    const raw = data as Record<string, unknown>;
    const event = EventSchema.safeParse(raw.event);
    const organizer = UserSchema.safeParse(raw.organizer);
    const place = raw.place === null ? { success: true as const, data: null } : PlaceSchema.safeParse(raw.place);
    if (!event.success || !organizer.success || !place.success) return { success: false as const, error: "invalid event details" };
    if (raw.remainingSeats !== null && typeof raw.remainingSeats !== "number") return { success: false as const, error: "invalid event details" };
    if (raw.activeBookingId !== null && typeof raw.activeBookingId !== "string") return { success: false as const, error: "invalid event details" };
    return {
      success: true as const,
      data: { event: event.data, place: place.data, organizer: organizer.data, remainingSeats: raw.remainingSeats, activeBookingId: raw.activeBookingId },
    };
  },
};

/** Calendar item: active booking enriched with its event and place. */
export interface CalendarEntry {
  booking: Booking;
  event: Event;
  place: Place | null;
}

const CalendarEntrySchema: ZodSchema<CalendarEntry> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a calendar entry" };
    const raw = data as Record<string, unknown>;
    const booking = BookingSchema.safeParse(raw.booking);
    const event = EventSchema.safeParse(raw.event);
    const place = raw.place === null ? { success: true as const, data: null } : PlaceSchema.safeParse(raw.place);
    if (!booking.success || !event.success || !place.success) return { success: false as const, error: "invalid calendar entry" };
    return { success: true as const, data: { booking: booking.data, event: event.data, place: place.data } };
  },
};

const CalendarEntryArraySchema: ZodSchema<CalendarEntry[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of calendar entries" };
    const entries: CalendarEntry[] = [];
    for (const item of data) {
      const parsed = CalendarEntrySchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      entries.push(parsed.data);
    }
    return { success: true as const, data: entries };
  },
};

export class ApiClient {
  constructor(private readonly baseUrl: string = DEFAULT_BASE_URL) {}

  login(payload: AuthRequest): Promise<AuthResponse> {
    return this.request("/auth/login", AuthResponseSchema, { body: payload });
  }

  private async request<T>(path: string, schema: ZodSchema<T>, options: MethodOptions = {}): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new ApiError(0, `network error while fetching ${path}`);
    }
    if (!response.ok) {
      throw new ApiError(response.status, `API ${path} failed with ${response.status}`);
    }
    const data: unknown = await response.json().catch(() => undefined);
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError(response.status, `API ${path} returned invalid payload`);
    }
    return parsed.data;
  }

  listEvents(filters: EventFilters = {}): Promise<Event[]> {
    const query = serializeEventFilters(filters);
    return this.request(`/events${query ? `?${query}` : ""}`, EventArraySchema);
  }

  getEvent(id: string): Promise<Event> {
    return this.request(`/events/${id}`, EventSchema);
  }

  getEventDetails(id: string, userId: string): Promise<EventDetails> {
    return this.request(`/events/${id}/details?userId=${encodeURIComponent(userId)}`, EventDetailsSchema);
  }

  createEvent(payload: CreateEvent): Promise<Event> {
    return this.request("/events", EventSchema, { body: payload });
  }

  getUser(id: string): Promise<User> {
    return this.request(`/users/${id}`, UserSchema);
  }

  getProfile(userId: string): Promise<Profile> {
    return this.request(`/users/${userId}/profile`, ProfileSchema);
  }

  updateProfile(userId: string, payload: UpdateProfile): Promise<Profile> {
    return this.request(`/users/${userId}/profile`, ProfileSchema, { method: "PATCH", body: payload });
  }

  getPlace(id: string): Promise<Place> {
    return this.request(`/places/${id}`, PlaceSchema);
  }

  createPlace(payload: CreatePlace): Promise<Place> {
    return this.request("/places", PlaceSchema, { body: payload });
  }

  createBooking(payload: CreateBooking): Promise<Booking> {
    return this.request("/bookings", BookingSchema, { body: payload });
  }

  cancelBooking(bookingId: string): Promise<Booking> {
    return this.request(`/bookings/${bookingId}`, BookingSchema, { method: "DELETE" });
  }

  listCalendar(userId: string): Promise<CalendarEntry[]> {
    return this.request(`/bookings?userId=${encodeURIComponent(userId)}`, CalendarEntryArraySchema);
  }
}

export const apiClient = new ApiClient();
