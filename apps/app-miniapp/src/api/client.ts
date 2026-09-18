// START_MODULE_CONTRACT
// PURPOSE: Typed fetch wrapper over the backend /api using zod contracts from @max-events/api-contracts.
// SCOPE: Base URL resolution, typed GET/POST methods per contract, unified ApiError handling; mock-only surfaces (EventRating aggregate, CreateReview, Report) documented here.
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
// - ApiClient.listPlaces - GET /places: venues for the catalog map markers
// - serializeEventFilters - filters -> query string ("" when empty)
// - parseEventFilters - query string -> filters, invalid values dropped
// - EventDetails - event page aggregate: event, place, organizer, free seats, own active booking
// - ApiClient.getEventDetails - GET /events/:id/details?userId=
// - ParticipationStats - event page social aggregate: per-status counters, friends count, own status
// - ApiClient.getParticipationStats - GET /events/:id/participation/stats?userId=
// - ApiClient.setParticipationStatus - PUT /events/:id/participation?userId= with { status }
// - ApiClient.deleteParticipation - DELETE /events/:id/participation?userId=
// - ApiClient.createBooking - POST /bookings
// - ApiClient.cancelBooking - DELETE /bookings/:id
// - CreateCheckIn - check-in payload (user + exactly one of event/place)
// - ApiClient.createCheckIn - POST /check-ins
// - ApiClient.getVisitStats - GET /users/:id/visit-stats: VisitStats
// - ApiClient.getAchievements - GET /users/:id/achievements: Achievement[]
// - MyCityPayload - my-city screen aggregate: summary counters + memory points
// - ApiClient.getMyCity - GET /users/:id/my-city
// - ApiClient.getProfile - GET /users/:id/profile
// - ApiClient.updateProfile - PATCH /users/:id/profile
// - CalendarEntry - calendar item: active booking enriched with its event and place
// - ApiClient.listCalendar - GET /bookings?userId=
// - ApiClient.getFriendsActivity - GET /friends/activity?userId=
// - ApiClient.getFriendAvailability - GET /friends/availability: free/busy/unknown per friend
// - CreateGathering - gathering launch payload (event + friend ids + proposed meeting time)
// - ApiClient.createGathering - POST /gatherings
// - ApiClient.getGathering - GET /gatherings/:id
// - ApiClient.getToday - GET /today: "What to do today?" digest (summary + typed-label cards)
// - ApiClient.listPlans - GET /plans: plan cards (plan + event + distance to the meeting point)
// - ApiClient.getPlan - GET /plans/:id: single plan card
// - ListSummary - lists screen aggregate: list + item count + id of the item saving the checked event (null when not saved) + participants (shared collections, mock)
// - ApiClient.listLists - GET /lists?userId=[&eventId=]: preset lists with counters
// - ListItemCard - list screen aggregate: list item enriched with its event and the participant who added it (null outside shared collections)
// - ApiClient.getListItems - GET /lists/:id/items
// - ListScreen - one-list aggregate: list + participants + item cards (shared collections surface)
// - ApiClient.getList - GET /lists/:id
// - AddListItem - save-to-list payload (owner user + saved event)
// - ApiClient.addListItem - POST /lists/:id/items with { userId, eventId }
// - ApiClient.removeListItem - DELETE /lists/:id/items/:itemId
// - FeedPost - impression post aggregate: author, event, text, like counter/state, comments (mock surface)
// - FeedComment - post comment attributed to its author
// - CreateFeedPost - impression publication payload (author, event, text)
// - ApiClient.listFeedPosts - GET /feed[?eventId=]: posts newest first, one event for the wall
// - ApiClient.createFeedPost - POST /feed
// - ApiClient.toggleFeedLike - POST /feed/:id/like?userId= (like/unlike toggle)
// - ApiClient.addFeedComment - POST /feed/:id/comments with { userId, text }
// - EventRating - event page rating aggregate: RatingSummary + per-category averages
// - ApiClient.getEventRating - GET /events/:id/rating
// - ApiClient.getPlacePage - GET /places/:id/page?userId=: PlacePage social aggregate
// - CreateMicroEvent - micro-event creation payload (author, what/when/where, limit)
// - ApiClient.listMicroEvents - GET /micro-events
// - ApiClient.createMicroEvent - POST /micro-events
// - ApiClient.joinMicroEvent - POST /micro-events/:id/join?userId=
// - ApiClient.leaveMicroEvent - DELETE /micro-events/:id/join?userId=
// - CreateReview - review submission payload (user + event + scores)
// - ApiClient.createReview - POST /reviews
// - REPORT_REASONS - report reason presets
// - ReportReason - union of the report reason presets
// - CreateReport - report submission payload (user + event + reason)
// - Report - report entity (mock surface)
// - ApiClient.createReport - POST /reports
// END_MODULE_MAP

import { PlacePageSchema, type PlacePage } from "@max-events/api-contracts";
import { AchievementSchema, AuthResponseSchema, BookingSchema, CheckInSchema, EventCategorySchema, EventSchema, FriendActivityByFriendSchema, FriendAvailabilitySchema, FriendSchema, GatheringSchema, ListItemSchema, ListSchema, MemoryPointSchema, MicroEventSchema, MyCitySummarySchema, ParticipationSchema, ParticipationStatusSchema, PlaceSchema, PlanCardSchema, ProfileSchema, RatingSummarySchema, ReviewSchema, TodayResponseSchema, UserSchema, VisitStatsSchema } from "@max-events/api-contracts";
import type { Achievement, AuthRequest, AuthResponse, Booking, CheckIn, CreateBooking, CreateEvent, CreatePlace, Event, EventCategory, Friend, FriendActivityByFriend, FriendAvailability, Gathering, List, ListItem, MemoryPoint, MicroEvent, MyCitySummary, Participation, ParticipationStatus, Place, PlanCard, Profile, RatingSummary, Review, ReviewCategoryScores, TodayResponse, UpdateProfile, User, VisitStats } from "@max-events/api-contracts";

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
  /** HTTP method for requests without a body (DELETE) or overriding the POST default for body payloads (PATCH/PUT). */
  method?: "DELETE" | "PATCH" | "PUT" | "POST";
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

const PlaceArraySchema: ZodSchema<Place[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of places" };
    const places: Place[] = [];
    for (const item of data) {
      const parsed = PlaceSchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      places.push(parsed.data);
    }
    return { success: true as const, data: places };
  },
};

/** Aggregate for the event page: everything the details screen renders in one request. */
export interface EventDetails {
  event: Event;
  place: Place | null;
  organizer: User;
  remainingSeats: number | null;
  activeBookingId: string | null;
  checkInId: string | null;
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
    if (raw.checkInId !== null && typeof raw.checkInId !== "string") return { success: false as const, error: "invalid event details" };
    return {
      success: true as const,
      data: { event: event.data, place: place.data, organizer: organizer.data, remainingSeats: raw.remainingSeats, activeBookingId: raw.activeBookingId, checkInId: raw.checkInId },
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

const FriendActivityArraySchema: ZodSchema<FriendActivityByFriend[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of friend activity groups" };
    const groups: FriendActivityByFriend[] = [];
    for (const item of data) {
      const parsed = FriendActivityByFriendSchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      groups.push(parsed.data);
    }
    return { success: true as const, data: groups };
  },
};

const FriendAvailabilityArraySchema: ZodSchema<FriendAvailability[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of friend availability" };
    const entries: FriendAvailability[] = [];
    for (const item of data) {
      const parsed = FriendAvailabilitySchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      entries.push(parsed.data);
    }
    return { success: true as const, data: entries };
  },
};

const GatheringEntitySchema: ZodSchema<Gathering> = {
  safeParse(data: unknown) {
    return GatheringSchema.safeParse(data);
  },
};

const PlanCardEntitySchema: ZodSchema<PlanCard> = {
  safeParse(data: unknown) {
    return PlanCardSchema.safeParse(data);
  },
};

const PlanCardArraySchema: ZodSchema<PlanCard[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of plan cards" };
    const cards: PlanCard[] = [];
    for (const item of data) {
      const parsed = PlanCardSchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      cards.push(parsed.data);
    }
    return { success: true as const, data: cards };
  },
};

/** Lists screen aggregate: a preset or custom list, its item count, the id of the item saving the checked event (null when not saved) and the participants of a shared collection (empty for personal lists). */
export interface ListSummary {
  list: List;
  itemsCount: number;
  savedItemId: string | null;
  participants: Friend[];
}

const ListSummaryArraySchema: ZodSchema<ListSummary[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of list summaries" };
    const summaries: ListSummary[] = [];
    for (const entry of data) {
      if (typeof entry !== "object" || entry === null) return { success: false as const, error: "expected a list summary" };
      const raw = entry as Record<string, unknown>;
      const list = ListSchema.safeParse(raw.list);
      if (!list.success || typeof raw.itemsCount !== "number" || (raw.savedItemId !== null && typeof raw.savedItemId !== "string")) return { success: false as const, error: "invalid list summary" };
      const participants: Friend[] = [];
      if (Array.isArray(raw.participants)) {
        for (const participant of raw.participants) {
          const parsed = FriendSchema.safeParse(participant);
          if (!parsed.success) return { success: false as const, error: "invalid list summary" };
          participants.push(parsed.data);
        }
      }
      summaries.push({ list: list.data, itemsCount: raw.itemsCount, savedItemId: raw.savedItemId, participants });
    }
    return { success: true as const, data: summaries };
  },
};

/** List screen aggregate: a list item enriched with its event and the participant who added it (null outside shared collections). */
export interface ListItemCard {
  item: ListItem;
  event: Event;
  addedBy: Friend | null;
}

const ListItemCardArraySchema: ZodSchema<ListItemCard[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of list item cards" };
    const cards: ListItemCard[] = [];
    for (const entry of data) {
      if (typeof entry !== "object" || entry === null) return { success: false as const, error: "expected a list item card" };
      const raw = entry as Record<string, unknown>;
      const item = ListItemSchema.safeParse(raw.item);
      const event = EventSchema.safeParse(raw.event);
      if (!item.success || !event.success) return { success: false as const, error: "invalid list item card" };
      if (raw.addedBy === undefined || raw.addedBy === null) {
        cards.push({ item: item.data, event: event.data, addedBy: null });
        continue;
      }
      const addedBy = FriendSchema.safeParse(raw.addedBy);
      if (!addedBy.success) return { success: false as const, error: "invalid list item card" };
      cards.push({ item: item.data, event: event.data, addedBy: addedBy.data });
    }
    return { success: true as const, data: cards };
  },
};

/** One-list aggregate: the list itself, its participants (shared collections) and its item cards. */
export interface ListScreen {
  list: List;
  participants: Friend[];
  items: ListItemCard[];
}

const ListScreenSchema: ZodSchema<ListScreen> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a list screen payload" };
    const raw = data as Record<string, unknown>;
    const list = ListSchema.safeParse(raw.list);
    const items = ListItemCardArraySchema.safeParse(raw.items);
    if (!list.success || !items.success || !Array.isArray(raw.participants)) return { success: false as const, error: "invalid list screen payload" };
    const participants: Friend[] = [];
    for (const participant of raw.participants) {
      const parsed = FriendSchema.safeParse(participant);
      if (!parsed.success) return { success: false as const, error: "invalid list screen payload" };
      participants.push(parsed.data);
    }
    return { success: true as const, data: { list: list.data, participants, items: items.data } };
  },
};

const ListItemEntitySchema: ZodSchema<ListItem> = {
  safeParse(data: unknown) {
    return ListItemSchema.safeParse(data);
  },
};

const AchievementArraySchema: ZodSchema<Achievement[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of achievements" };
    const achievements: Achievement[] = [];
    for (const item of data) {
      const parsed = AchievementSchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      achievements.push(parsed.data);
    }
    return { success: true as const, data: achievements };
  },
};

/** My-city screen aggregate: summary counters and the personal memory points. */
export interface MyCityPayload {
  summary: MyCitySummary;
  points: MemoryPoint[];
}

const MyCityPayloadSchema: ZodSchema<MyCityPayload> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a my-city payload" };
    const raw = data as Record<string, unknown>;
    const summary = MyCitySummarySchema.safeParse(raw.summary);
    if (!summary.success || !Array.isArray(raw.points)) return { success: false as const, error: "invalid my-city payload" };
    const points: MemoryPoint[] = [];
    for (const item of raw.points) {
      const parsed = MemoryPointSchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      points.push(parsed.data);
    }
    return { success: true as const, data: { summary: summary.data, points } };
  },
};

/** Check-in payload: the user plus exactly one of eventId/placeId. */
export interface CreateCheckIn {
  userId: string;
  eventId?: string;
  placeId?: string;
}

/** Gathering launch payload: event, invited friends, proposed meeting time. */
export interface CreateGathering {
  eventId: string;
  friendIds: string[];
  proposedMeetingAt: string;
}

/** Save-to-list payload: the owner user and the saved event. */
export interface AddListItem {
  userId: string;
  eventId: string;
}

/** Rating aggregate for the event page: contract summary plus per-category averages (null when nobody scored that category). */
export interface EventRating {
  summary: RatingSummary;
  categoryAverages: { atmosphere: number | null; organization: number | null; price: number | null; place: number | null };
}

/** Review submission payload: the author, the event, the scores and the optional text. */
export interface CreateReview {
  userId: string;
  eventId: string;
  stars: number;
  categoryScores?: ReviewCategoryScores;
  wouldGoAgain: boolean;
  text?: string;
}

/** Report reason presets offered by the report button. */
export const REPORT_REASONS = ["spam", "abuse", "inaccurate", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Report submission payload: the author, the reported event and the reason. */
export interface CreateReport {
  userId: string;
  eventId: string;
  reason: ReportReason;
}

/** Report entity (mock surface while the backend report endpoint does not exist yet). */
export interface Report {
  id: string;
  userId: string;
  eventId: string;
  reason: ReportReason;
  createdAt: string;
}

/** Feed comment attributed to its author (mock surface while the backend impressions endpoints do not exist yet). */
export interface FeedComment {
  id: string;
  author: Friend;
  text: string;
}

/** Impression post aggregate: author, event, text, like counter/state and comments; the photo is a CSS placeholder. */
export interface FeedPost {
  id: string;
  author: Friend;
  eventId: string;
  text: string;
  likesCount: number;
  likedByMe: boolean;
  comments: FeedComment[];
}

/** Impression publication payload: the author, the event the post is about and the text. */
export interface CreateFeedPost {
  userId: string;
  eventId: string;
  text: string;
}

const FeedPostEntitySchema: ZodSchema<FeedPost> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a feed post" };
    const raw = data as Record<string, unknown>;
    const author = FriendSchema.safeParse(raw.author);
    if (!author.success || typeof raw.id !== "string" || typeof raw.eventId !== "string" || typeof raw.text !== "string" || typeof raw.likesCount !== "number" || typeof raw.likedByMe !== "boolean" || !Array.isArray(raw.comments)) {
      return { success: false as const, error: "invalid feed post" };
    }
    const comments: FeedComment[] = [];
    for (const entry of raw.comments) {
      if (typeof entry !== "object" || entry === null) return { success: false as const, error: "invalid feed post" };
      const comment = entry as Record<string, unknown>;
      const commentAuthor = FriendSchema.safeParse(comment.author);
      if (!commentAuthor.success || typeof comment.id !== "string" || typeof comment.text !== "string") return { success: false as const, error: "invalid feed post" };
      comments.push({ id: comment.id, author: commentAuthor.data, text: comment.text });
    }
    return { success: true as const, data: { id: raw.id, author: author.data, eventId: raw.eventId, text: raw.text, likesCount: raw.likesCount, likedByMe: raw.likedByMe, comments } };
  },
};

const FeedPostArraySchema: ZodSchema<FeedPost[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of feed posts" };
    const posts: FeedPost[] = [];
    for (const item of data) {
      const parsed = FeedPostEntitySchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      posts.push(parsed.data);
    }
    return { success: true as const, data: posts };
  },
};

const ReviewEntitySchema: ZodSchema<Review> = {
  safeParse(data: unknown) {
    return ReviewSchema.safeParse(data);
  },
};

const EventRatingSchema: ZodSchema<EventRating> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected an event rating" };
    const raw = data as Record<string, unknown>;
    const summary = RatingSummarySchema.safeParse(raw.summary);
    if (!summary.success || typeof raw.categoryAverages !== "object" || raw.categoryAverages === null) return { success: false as const, error: "invalid event rating" };
    const averages = raw.categoryAverages as Record<string, unknown>;
    const categoryAverages = { atmosphere: null, organization: null, price: null, place: null } as EventRating["categoryAverages"];
    for (const key of ["atmosphere", "organization", "price", "place"] as const) {
      const value = averages[key];
      if (value !== undefined && value !== null && typeof value !== "number") return { success: false as const, error: "invalid event rating" };
      categoryAverages[key] = typeof value === "number" ? value : null;
    }
    return { success: true as const, data: { summary: summary.data, categoryAverages } };
  },
};

const ReportEntitySchema: ZodSchema<Report> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a report" };
    const raw = data as Record<string, unknown>;
    if (typeof raw.id !== "string" || typeof raw.userId !== "string" || typeof raw.eventId !== "string" || typeof raw.createdAt !== "string" || !REPORT_REASONS.includes(raw.reason as ReportReason)) {
      return { success: false as const, error: "invalid report" };
    }
    return { success: true as const, data: { id: raw.id, userId: raw.userId, eventId: raw.eventId, reason: raw.reason as ReportReason, createdAt: raw.createdAt } };
  },
};

const MicroEventEntitySchema: ZodSchema<MicroEvent> = {
  safeParse(data: unknown) {
    return MicroEventSchema.safeParse(data);
  },
};

const MicroEventArraySchema: ZodSchema<MicroEvent[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of micro-events" };
    const items: MicroEvent[] = [];
    for (const item of data) {
      const parsed = MicroEventSchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      items.push(parsed.data);
    }
    return { success: true as const, data: items };
  },
};

/** Micro-event creation payload: the author plus what/when/where (exactly one of locationText/placeId) and the participant limit. */
export interface CreateMicroEvent {
  userId: string;
  title: string;
  startsAt: string;
  locationText?: string;
  placeId?: string;
  participantsLimit: number;
}

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

  listPlaces(): Promise<Place[]> {
    return this.request("/places", PlaceArraySchema);
  }

  getEvent(id: string): Promise<Event> {
    return this.request(`/events/${id}`, EventSchema);
  }

  getEventDetails(id: string, userId: string): Promise<EventDetails> {
    return this.request(`/events/${id}/details?userId=${encodeURIComponent(userId)}`, EventDetailsSchema);
  }

  getParticipationStats(eventId: string, userId: string): Promise<ParticipationStats> {
    return this.request(`/events/${eventId}/participation/stats?userId=${encodeURIComponent(userId)}`, ParticipationStatsSchema);
  }

  setParticipationStatus(eventId: string, userId: string, status: ParticipationStatus): Promise<Participation> {
    return this.request(`/events/${eventId}/participation?userId=${encodeURIComponent(userId)}`, ParticipationSchema, { method: "PUT", body: { status } });
  }

  deleteParticipation(eventId: string, userId: string): Promise<Participation> {
    return this.request(`/events/${eventId}/participation?userId=${encodeURIComponent(userId)}`, ParticipationSchema, { method: "DELETE" });
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

  createCheckIn(payload: CreateCheckIn): Promise<CheckIn> {
    return this.request("/check-ins", CheckInSchema, { body: payload });
  }

  getVisitStats(userId: string): Promise<VisitStats> {
    return this.request(`/users/${userId}/visit-stats`, VisitStatsSchema);
  }

  getAchievements(userId: string): Promise<Achievement[]> {
    return this.request(`/users/${userId}/achievements`, AchievementArraySchema);
  }

  getMyCity(userId: string): Promise<MyCityPayload> {
    return this.request(`/users/${userId}/my-city`, MyCityPayloadSchema);
  }

  listCalendar(userId: string): Promise<CalendarEntry[]> {
    return this.request(`/bookings?userId=${encodeURIComponent(userId)}`, CalendarEntryArraySchema);
  }

  getFriendsActivity(userId: string): Promise<FriendActivityByFriend[]> {
    return this.request(`/friends/activity?userId=${encodeURIComponent(userId)}`, FriendActivityArraySchema);
  }

  getFriendAvailability(): Promise<FriendAvailability[]> {
    return this.request("/friends/availability", FriendAvailabilityArraySchema);
  }

  createGathering(payload: CreateGathering): Promise<Gathering> {
    return this.request("/gatherings", GatheringEntitySchema, { body: payload });
  }

  getGathering(id: string): Promise<Gathering> {
    return this.request(`/gatherings/${id}`, GatheringEntitySchema);
  }

  getToday(): Promise<TodayResponse> {
    return this.request("/today", TodayResponseSchema);
  }

  listPlans(): Promise<PlanCard[]> {
    return this.request("/plans", PlanCardArraySchema);
  }

  getPlan(id: string): Promise<PlanCard> {
    return this.request(`/plans/${id}`, PlanCardEntitySchema);
  }

  listLists(userId: string, eventId?: string): Promise<ListSummary[]> {
    const query = new URLSearchParams({ userId });
    if (eventId !== undefined) query.set("eventId", eventId);
    return this.request(`/lists?${query.toString()}`, ListSummaryArraySchema);
  }

  getListItems(listId: string): Promise<ListItemCard[]> {
    return this.request(`/lists/${listId}/items`, ListItemCardArraySchema);
  }

  addListItem(listId: string, payload: AddListItem): Promise<ListItem> {
    return this.request(`/lists/${listId}/items`, ListItemEntitySchema, { body: payload });
  }

  removeListItem(listId: string, itemId: string): Promise<ListItem> {
    return this.request(`/lists/${listId}/items/${itemId}`, ListItemEntitySchema, { method: "DELETE" });
  }

  getList(listId: string): Promise<ListScreen> {
    return this.request(`/lists/${listId}`, ListScreenSchema);
  }

  listFeedPosts(eventId?: string): Promise<FeedPost[]> {
    return this.request(`/feed${eventId !== undefined ? `?eventId=${encodeURIComponent(eventId)}` : ""}`, FeedPostArraySchema);
  }

  createFeedPost(payload: CreateFeedPost): Promise<FeedPost> {
    return this.request("/feed", FeedPostEntitySchema, { body: payload });
  }

  toggleFeedLike(postId: string, userId: string): Promise<FeedPost> {
    return this.request(`/feed/${postId}/like?userId=${encodeURIComponent(userId)}`, FeedPostEntitySchema, { method: "POST" });
  }

  addFeedComment(postId: string, payload: { userId: string; text: string }): Promise<FeedPost> {
    return this.request(`/feed/${postId}/comments`, FeedPostEntitySchema, { body: payload });
  }

  getEventRating(eventId: string): Promise<EventRating> {
    return this.request(`/events/${eventId}/rating`, EventRatingSchema);
  }

  getPlacePage(placeId: string, userId: string): Promise<PlacePage> {
    return this.request(`/places/${placeId}/page?userId=${encodeURIComponent(userId)}`, PlacePageSchema);
  }

  createReview(payload: CreateReview): Promise<Review> {
    return this.request("/reviews", ReviewEntitySchema, { body: payload });
  }

  createReport(payload: CreateReport): Promise<Report> {
    return this.request("/reports", ReportEntitySchema, { body: payload });
  }

  listMicroEvents(): Promise<MicroEvent[]> {
    return this.request("/micro-events", MicroEventArraySchema);
  }

  createMicroEvent(payload: CreateMicroEvent): Promise<MicroEvent> {
    return this.request("/micro-events", MicroEventEntitySchema, { body: payload });
  }

  joinMicroEvent(id: string, userId: string): Promise<MicroEvent> {
    return this.request(`/micro-events/${id}/join?userId=${encodeURIComponent(userId)}`, MicroEventEntitySchema, { method: "POST" });
  }

  leaveMicroEvent(id: string, userId: string): Promise<MicroEvent> {
    return this.request(`/micro-events/${id}/join?userId=${encodeURIComponent(userId)}`, MicroEventEntitySchema, { method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
