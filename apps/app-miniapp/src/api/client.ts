// START_MODULE_CONTRACT
// PURPOSE: Typed fetch wrapper over the backend /api using zod contracts from @max-events/api-contracts.
// SCOPE: Base URL resolution, typed GET/POST methods per contract, unified ApiError handling, x-max-init-data auth header; client-side aggregates (EventDetails, ParticipationStats, ListSummary/ListScreen, MyCityPayload) documented here.
// DEPENDS: @max-events/api-contracts (zod), fetch (global)
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ApiError - unified API error with HTTP status
// - ApiClient - configurable fetch wrapper with typed methods
// - apiClient - default singleton instance
// - ApiClient.login - POST /auth/login with raw MAX initData
// - ApiClient.setInitData - attach the raw MAX initData sent as the x-max-init-data header on every request (backend global auth guard)
// - ApiClient.setOrganizerToken - attach the organizer bearer token sent as the authorization header on every request
// - ApiClient.organizerLogin - POST /auth/organizer/login with login/password, returns OrganizerSession
// - ApiClient.listStories / createStory - GET /stories and POST /stories (own story from a data-URL photo)
// - EventFilters - optional catalog list filters (category/city/date/minRating)
// - ApiClient.listEvents - GET /events with serialized filters
// - ApiClient.listPlaces - GET /places: venues for the catalog map markers
// - serializeEventFilters - filters -> query string ("" when empty)
// - parseEventFilters - query string -> filters, invalid values dropped
// - EventDetails - event page aggregate: event, place, organizer (nullable), free seats, own active booking
// - ApiClient.getEventDetails - GET /events/:id/details?userId=
// - ParticipationStats - event page social aggregate: per-status counters, friends count, own status
// - ApiClient.getParticipationStats - GET /events/:id/participation/stats?userId=
// - ApiClient.setParticipationStatus - PUT /events/:id/participation?userId= with { status }
// - ApiClient.deleteParticipation - DELETE /events/:id/participation?userId=
// - ApiClient.createBooking - POST /bookings (BookingWithSeats: the payment of a paid event rides along)
// - ApiClient.cancelBooking - DELETE /bookings/:id (BookingWithSeats: a succeeded payment comes back refunded)
// - ApiClient.payBooking - POST /bookings/:id/payment (initiate/continue the in-app payment; BookingWithSeats)
// - ApiClient.joinWaitlist - POST /waitlist?userId= with { eventId }
// - ApiClient.getMyWaitlistEntry - GET /waitlist/me?eventId=&userId= (404 -> null)
// - ApiClient.confirmWaitlistOffer - POST /waitlist/:id/confirm
// - ApiClient.declineWaitlistOffer - POST /waitlist/:id/decline
// - CreateCheckIn - check-in payload (user + exactly one of event/place)
// - ApiClient.createCheckIn - POST /check-ins
// - ApiClient.getVisitStats - GET /users/:id/visit-stats: VisitStats
// - ApiClient.getAchievements - GET /users/:id/achievements: Achievement[]
// - MyCityPayload - my-city screen aggregate: summary counters + memory points
// - ApiClient.getMyCity - GET /users/:id/my-city
// - ApiClient.getProfile - GET /profile (current user)
// - ApiClient.updateProfile - PATCH /profile (current user)
// - CalendarEntry - calendar item: active booking enriched with its event and place
// - ApiClient.listCalendar - GET /calendar: active bookings split upcoming/past by the server, flattened for the screens
// - ApiClient.listSubscriptions - GET /subscriptions: follows of the authenticated user, each with a readable title
// - ApiClient.createSubscription - POST /subscriptions (organizer | place | interest; idempotent per target on the backend)
// - ApiClient.removeSubscription - DELETE /subscriptions/:id, returns the removed follow
// - ApiClient.listFriends - GET /friends: friend list of the authenticated user
// - ApiClient.getFriendsActivity - GET /friends/activity?userId=
// - ApiClient.getFriendAvailability - GET /friends/availability?eventId=: free/busy/unknown per friend
// - CreateGathering - gathering launch payload (event + friend ids + proposed meeting time)
// - ApiClient.createGathering - POST /gatherings
// - ApiClient.getGathering - GET /gatherings/:id
// - ApiClient.respondToGathering - PATCH /gatherings/:id/response with { response } (invitee answer; the host and outsiders get 403 from the backend)
// - ApiClient.getTaste - GET /taste: the viewer's taste graph (empty arrays until they visit something)
// - ApiClient.getAfterMe - GET /taste/after-me: what the graph suggests next
// - ApiClient.getToday - GET /today[?lat=&lng=]: "What to do today?" digest (summary + typed-label cards)
// - ApiClient.getNearbyTimeline - GET /nearby?latitude=&longitude=: four-bucket nearby timeline (NearbyTimeline)
// - ApiClient.getLeisureOptions - GET /nearby/free?hours=&mood=&latitude=&longitude=: leisure chains for a free window
// - LeisureQuery - free-window leisure payload (hours 1..8, mood, coordinates)
// - ApiClient.listPlans - GET /plans[?lat=&lng=]: plan cards (plan + event + distance to the meeting point)
// - ApiClient.getPlan - GET /plans/:id: single plan card
// - ApiClient.createPlan - POST /plans: a plan made by hand, optionally repeating
// - ApiClient.cancelPlan - DELETE /plans/:id?scope=occurrence|series
// - ApiClient.createAutoPlan - POST /plans/auto: saved draft plan + travel minutes + food picks + dinner->road->meetup->event timeline
// - ApiClient.createDayRoute - POST /routes: day route timeline from 2..8 event/place stops with walking legs
// - ApiClient.optimizeDayRoute - POST /routes/optimize: same stops reordered with saved minutes/km
// - ListSummary - lists screen aggregate: list + item count + id of the item saving the checked event (null when not saved) + participants (shared collections, mock)
// - ApiClient.listLists - GET /lists?userId=[&eventId=]: preset lists with counters
// - ListItemCard - list screen aggregate: list item enriched with its event and the participant who added it (null outside shared collections)
// - ListScreen - one-list aggregate: list + participants + item cards (shared collections surface)
// - ApiClient.getList - GET /lists/:id
// - AddListItem - save-to-list payload (owner user + saved event)
// - ApiClient.createList - POST /lists: a list of one's own
// - ApiClient.renameList - PATCH /lists/:id (a preset refuses, 403)
// - ApiClient.deleteList - DELETE /lists/:id, returns the removed list (a preset refuses, 403)
// - ApiClient.addListItem - POST /lists/:id/items with { userId, eventId }
// - ApiClient.removeListItem - DELETE /lists/:id/items/:itemId
// - FeedPost - impression post aggregate: author, event, text, like counter/state, comments
// - FeedComment - post comment attributed to its author
// - CreateFeedPost - impression publication payload (author, event, text, optional photo); the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token)
// - ApiClient.listFeedPosts - GET /feed[?eventId=|?placeId=]: posts newest first, one event or one place for the wall
// - ApiClient.createFeedPost - POST /feed
// - ApiClient.toggleFeedLike - POST /feed/:id/like?userId= (like/unlike toggle; userId is mock-only, ignored by the real backend)
// - ApiClient.addFeedComment - POST /feed/:id/comments with { userId, text } (userId is mock-only, ignored by the real backend)
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
// - CreateReport - report submission payload (user + exactly one of event/place/feed post + reason); the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token)
// - Report - report entity (contract shape)
// - ApiClient.listOpenReports - GET /reports?status=open (moderators only, 403 otherwise)
// - ApiClient.resolveReport - POST /reports/:id/resolve
// - ApiClient.unpublishTarget - POST /moderation/unpublish
// - ApiClient.banOrganizer - POST /moderation/ban
// - ApiClient.createReport - POST /reports
// - ApiClient.assistQuery - POST /assist: NL query -> explained picks (summary + criteria + items)
// - ApiClient.assistDay - POST /assist/day: "План на субботу" -> stops timeline + planDraft (+ persisted plan when save=true)
// - ApiClient.getDiscovery - GET /discovery: reverse discovery summary "Твои люди открыли N мест"
// - ApiClient.listFriendPlaces - GET /discovery/friend-places: places friends visited, for the map layer
// - ApiClient.getFriendRoute - GET /discovery/friends/:userId/route: a friend's chronological route of unseen places
// - ApiClient.getPeople - GET /people[?lat=&lng=]: people matching with shared-interest/event context (lat/lng mirror the backend parseOrigin names)
// - ApiClient.getPromotionPlacements - GET /promotions/placements: banners, pins, boosted ids (#205)
// - ApiClient.getTargetedPromotions - GET /promotions/for-me: targeted collections with explanations (#205)
// - OrganizerEvent - contract event plus the draft flag read from the raw `published` field (returned by toEventDto; a missing flag reads as published)
// - OrganizerPlace - contract place plus the draft flag read from the raw `published` field (returned by toPlaceDto; a missing flag reads as published)
// - UpdateOrganizerEvent - minimal event edit payload (backend PATCH /events/:id whitelist)
// - UpdateOrganizerPlace - place edit payload (backend PATCH /places/:id validates CreatePlaceSchema.partial())
// - ApiClient.listOrganizerEvents / createOrganizerEvent / updateOrganizerEvent / publishOrganizerEvent - organizer event surface (GET/POST /organizer/events, PATCH /events/:id, POST /organizer/events/:id/publish); create always yields a draft, publish always yields a published item
// - ApiClient.listOrganizerPlaces / createOrganizerPlace / updateOrganizerPlace / publishOrganizerPlace - organizer place surface (GET/POST /organizer/places, PATCH /places/:id, POST /organizer/places/:id/publish)
// - ApiClient.createWeGroup / listWeGroups / getWeGroup - «Мы» group lifecycle (POST/GET /we-groups, GET /we-groups/:id; every response is the full WeGroupScreen aggregate)
// - ApiClient.addWeGroupEvent / addWeGroupPlace / archiveWeGroup - group writes (POST /we-groups/:id/events|places|archive)
// - ApiClient.getPlanBudget - GET /plans/:id/budget: expenses + per-person totals + debts, all computed server-side
// - ApiClient.addPlanExpense - POST /plans/:id/expenses, returns the recomputed PlanBudget
// - ApiClient.createVote - POST /votes: shared event vote (title + 2..10 unique events + >=1 friend participants)
// - ApiClient.getVote - GET /votes/:id: vote with option tallies and the server-computed winner
// - ApiClient.castBallot - POST /votes/:id/ballots: one-tap vote; a repeated ballot replaces the previous one (backend semantics)
// - StatsPeriodQuery - optional from/to window for the organizer reports
// - statsPeriodQuery - period into a ?from&to query string
// - ApiClient.getEventSales - GET /organizer/events/:id/sales[?from&to]: EventSalesReport of frozen ticket sales (#196)
// - ApiClient.getOrganizerEventStats - GET /organizer/events/:id/stats[?from&to]: OrganizerEventStats counters (#196)
// - ApiClient.recordPageView - POST /views (#196)
// - trackPageView - fire-and-forget page helper over recordPageView (errors swallowed, #196)
// - ApiClient.getEventOrganizerRating / getOrganizerRating - GET /events/:id/organizer-rating and /organizers/:userId/rating (#199; nullable envelope)
// - ApiClient.listCampaigns / createCampaign - organizer promo campaigns (GET/POST /organizer/events/:id/campaigns, #206)
// - ApiClient.listPromotions / createPromotion / markPromotionPaid - organizer promotion campaigns (GET/POST /organizer/events/:id/promotions, POST .../:campaignId/paid, #206)
// - ApiClient.getWhereto - GET /whereto?company=&mood=&budget=: guided "Куда пойдём?" suggestions (up to 5 events, #371)
// - ApiClient.listOrganizerPromos / createOrganizerPromo / setOrganizerEarlyAccess - organizer promocodes and the early-access window (GET/POST /organizer/events/:id/promocodes, POST .../early-access, #372)
// END_MODULE_MAP

import { IdSchema, LeisureOptionSchema, NearbyTimelineSchema, PlacePageSchema, PlanBudgetSchema, PromotionPlacementsSchema, TargetedPromotionsResponseSchema, VoteSchema, WeGroupScreenSchema, type PlacePage } from "@max-events/api-contracts";
import { AchievementSchema, AuthResponseSchema, AutoPlanProposalSchema, BookingWithSeatsSchema, CalendarResponseSchema, CheckInSchema, DayRouteSchema, DiscoveryResponseSchema, EventCategorySchema, EventSchema, FeedPostSchema, FriendActivityByFriendSchema, FriendAvailabilitySchema, FriendPlaceVisitSchema, FriendRouteSchema, FriendSchema, FriendSuggestionSchema, FriendsSyncStatusSchema, GatheringSchema, ListItemSchema, ListSchema, MemoryPointSchema, MicroEventSchema, AfterMeResponseSchema, MyCitySummarySchema, OptimizeRouteSchema, OrganizationSchema, ParticipationSchema, SubscriptionSchema, TasteProfileSchema, ParticipationStatusSchema, PeopleResponseSchema, PlaceSchema, PlanCardSchema, ProfileSchema, RatingSummarySchema, ReportSchema, ReviewSchema, TodayResponseSchema, UserSchema, VisitStatsSchema, WaitlistEntrySchema, AssistResponseSchema, AssistDayResponseSchema, WheretoResponseSchema } from "@max-events/api-contracts";
import type {
  AfterMeResponse,
  CreatePlanWrite,
  PlanCancelScope,
  UnpublishWrite,
  TasteProfile,
  Achievement,
  AuthRequest,
  AuthResponse,
  AutoPlanProposal,
  Booking,
  BookingWithSeats,
  CheckIn,
  CreateBooking,
  CreateEvent,
  CreatePlace,
  CreatePlanExpenseWrite,
  CreateVoteWrite,
  CreateWeGroupWrite,
  DayRoute,
  DiscoveryResponse,
  Event,
  EventCategory,
  FeedComment as ContractFeedComment,
  FeedPost as ContractFeedPost,
  Friend,
  FriendActivityByFriend,
  FriendAvailability,
  FriendSuggestion,
  FriendsSyncStatus,
  FriendPlaceVisit,
  FriendRoute,
  Gathering,
  InviteeResponse,
  LeisureMood,
  LeisureOption,
  List,
  ListItem,
  MemoryPoint,
  MicroEvent,
  MyCitySummary,
  NearbyTimeline,
  OptimizeRoute,
  Participation,
  ParticipationStatus,
  PeopleResponse,
  Place,
  PlanBudget,
  PlanCard,
  Profile,
  PromotionPlacements,
  RatingSummary,
  Report as ContractReport,
  Review,
  ReviewCategoryScores,
  RouteStopWrite,
  TargetedPromotionsResponse,
  TodayResponse,
  UpdateProfile,
  User,
  VisitStats,
  Vote,
  WaitlistEntry,
  WeGroupScreen,
  WheretoQuery,
  WheretoResponse,
  AssistResponse,
  AssistDayResponse,
} from "@max-events/api-contracts";
import { EarlyAccessWriteSchema, EventSalesReportSchema, OrganizerEventStatsSchema, OrganizerRatingResponseSchema, OrganizerSessionSchema, PromoCampaignSchema, PromoCodeSchema, PromotionCampaignSchema, StorySchema } from "@max-events/api-contracts";
import type { CreatePromoCampaignWrite, CreatePromoCodeWrite, CreatePromotionWrite, CreateSubscription, EarlyAccessWrite, EventSalesReport, Organization, OrganizerEventStats, OrganizerLoginWrite, OrganizerRatingResponse, OrganizerSession, PromoCampaign, PromoCode, PromotionCampaign, RecordPageViewWrite, Story, Subscription } from "@max-events/api-contracts";

/** Minimal structural shape of a zod schema needed to validate responses. */
interface ZodSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

const IdArraySchema: ZodSchema<string[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected ids" };
    const ids: string[] = [];
    for (const item of data) {
      const parsed = IdSchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: "invalid id" };
      ids.push(parsed.data);
    }
    return { success: true as const, data: ids };
  },
};

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
  /** Inclusive range start (YYYY-MM-DD); sent as date_from. */
  dateFrom?: string;
  /** Inclusive range end (YYYY-MM-DD); sent as date_to. */
  dateTo?: string;
  /** Average review score the event must reach, 1..5; an event nobody reviewed never qualifies. */
  minRating?: number;
  limit?: number;
  offset?: number;
}

export function serializeEventFilters(filters: EventFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.date) params.set("date", filters.date);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  // snake_case: the backend query contract spells it min_rating, next to date_from/date_to.
  if (filters.minRating) params.set("min_rating", String(filters.minRating));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  return params.toString();
}

export function parseEventFilters(search: string): EventFilters {
  const params = new URLSearchParams(search);
  const category = EventCategorySchema.safeParse(params.get("category"));
  const date = params.get("date");
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");
  const minRatingRaw = params.get("min_rating");
  const minRating = minRatingRaw === null ? Number.NaN : Number(minRatingRaw);
  const limitRaw = params.get("limit");
  const offsetRaw = params.get("offset");
  const limit = limitRaw === null ? Number.NaN : Number(limitRaw);
  const offset = offsetRaw === null ? Number.NaN : Number(offsetRaw);
  const day = (value: string | null) => (value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);
  const filters: EventFilters = {};
  if (category.success) filters.category = category.data;
  const city = params.get("city")?.trim();
  if (city) filters.city = city;
  const parsedDate = day(date);
  if (parsedDate) filters.date = parsedDate;
  const parsedFrom = day(dateFrom);
  if (parsedFrom) filters.dateFrom = parsedFrom;
  const parsedTo = day(dateTo);
  if (parsedTo) filters.dateTo = parsedTo;
  // A value the backend would reject with a 400 is dropped here, like an unknown category.
  if (Number.isInteger(minRating) && minRating >= 1 && minRating <= 5) filters.minRating = minRating;
  if (Number.isInteger(limit) && limit >= 1 && limit <= 100) filters.limit = limit;
  if (Number.isInteger(offset) && offset >= 0) filters.offset = offset;
  return filters;
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

/** Calendar item: active booking enriched with its event and place. */
export interface CalendarEntry {
  booking: Booking;
  event: Event;
  place: Place | null;
}

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

/** Check-in payload: the user plus exactly one of eventId/placeId; the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token). */
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

/** Save-to-list payload: the owner user and the saved event; the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token). */
export interface AddListItem {
  userId: string;
  eventId?: string;
  placeId?: string;
}

/** Rating aggregate for the event page: contract summary plus per-category averages (null when nobody scored that category). */
export interface EventRating {
  summary: RatingSummary;
  categoryAverages: { atmosphere: number | null; organization: number | null; price: number | null; place: number | null };
}

/** Review submission payload: the author, the event, the scores and the optional text; the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token). */
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

/** Report submission payload: the author, the reported target (exactly one of event/place/feed post) and the reason. */
export interface CreateReport {
  userId: string;
  eventId?: string;
  placeId?: string;
  feedPostId?: string;
  reason: ReportReason;
}

/** Report entity (contract shape: targetType/targetId/status). */
export type Report = ContractReport;

/** Feed comment attributed to its author. */
export type FeedComment = ContractFeedComment;

/** Impression post aggregate: author, event, text, like counter/state and comments; the photo is a CSS placeholder. */
export type FeedPost = ContractFeedPost;

/** Impression publication payload: the author, the event the post is about and the text. */
/** Reporting window for the organizer stats and sales endpoints; omitted sides mean "all time". */
export interface StatsPeriodQuery {
  from?: string;
  to?: string;
}

export function statsPeriodQuery(period: StatsPeriodQuery): string {
  const parts = [period.from ? `from=${encodeURIComponent(period.from)}` : "", period.to ? `to=${encodeURIComponent(period.to)}` : ""].filter((part) => part !== "");
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

export interface CreateFeedPost {
  userId: string;
  eventId: string;
  text: string;
  /** Optional photo for the post; the server stores the url as given. */
  photoUrl?: string | null;
}

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

/** Free-window leisure query: hours 1..8 plus the mood. */
export interface LeisureQuery {
  hours: number;
  mood: LeisureMood;
  latitude: number;
  longitude: number;
}

/** Micro-event creation payload: the author plus what/when/where (exactly one of locationText/placeId) and the participant limit. */
export interface CreateMicroEvent {
  userId: string;
  title: string;
  startsAt: string;
  locationText?: string;
  placeId?: string;
  participantsLimit: number;
}

/** Organizer panel item: the contract entity plus the draft flag. The backend organizer DTO omits `published`, so a missing flag reads as published (drafts are only distinguishable when the payload carries published=false). */
export type OrganizerEvent = Event & { draft: boolean };
export type OrganizerPlace = Place & { draft: boolean };

/** Minimal editable event fields (backend PATCH /events/:id whitelist via pickEventFields). */
export type UpdateOrganizerEvent = Partial<Pick<CreateEvent, "title" | "startsAt" | "endsAt" | "isPaid" | "priceRub" | "paymentUrl" | "capacity">>;

/** Editable place fields (backend PATCH /places/:id validates CreatePlaceSchema.partial()). */
export type UpdateOrganizerPlace = Partial<CreatePlace>;

function organizerItem<T>(schema: ZodSchema<T>, data: unknown): (T & { draft: boolean }) | null {
  const parsed = schema.safeParse(data);
  if (!parsed.success) return null;
  const draft = typeof data === "object" && data !== null && (data as Record<string, unknown>).published === false;
  return { ...parsed.data, draft };
}

const OrganizerEventEntitySchema: ZodSchema<OrganizerEvent> = {
  safeParse(data: unknown) {
    const item = organizerItem(EventSchema, data);
    return item === null ? { success: false as const, error: "invalid organizer event" } : { success: true as const, data: item };
  },
};

const OrganizerPlaceEntitySchema: ZodSchema<OrganizerPlace> = {
  safeParse(data: unknown) {
    const item = organizerItem(PlaceSchema, data);
    return item === null ? { success: false as const, error: "invalid organizer place" } : { success: true as const, data: item };
  },
};

const OrganizerEventArraySchema: ZodSchema<OrganizerEvent[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of organizer events" };
    const events: OrganizerEvent[] = [];
    for (const item of data) {
      const parsed = OrganizerEventEntitySchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      events.push(parsed.data);
    }
    return { success: true as const, data: events };
  },
};

const OrganizerPlaceArraySchema: ZodSchema<OrganizerPlace[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of organizer places" };
    const places: OrganizerPlace[] = [];
    for (const item of data) {
      const parsed = OrganizerPlaceEntitySchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      places.push(parsed.data);
    }
    return { success: true as const, data: places };
  },
};

const PageViewResultSchema: ZodSchema<{ recorded: boolean }> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null || typeof (data as Record<string, unknown>).recorded !== "boolean") return { success: false as const, error: "expected a page-view result" };
    return { success: true as const, data: data as { recorded: boolean } };
  },
};

export class ApiClient {
  private initData: string | null = null;
  private organizerToken: string | null = null;

  constructor(private readonly baseUrl: string = DEFAULT_BASE_URL) {}

  /** Attach (or clear) the raw MAX initData sent as the x-max-init-data header on every request. */
  setInitData(initData: string | null): void {
    this.initData = initData;
  }

  /** Attach (or clear) the organizer bearer token sent as the authorization header on every request. */
  setOrganizerToken(token: string | null): void {
    this.organizerToken = token;
  }

  login(payload: AuthRequest): Promise<AuthResponse> {
    return this.request("/auth/login", AuthResponseSchema, { body: payload });
  }

  organizerLogin(payload: OrganizerLoginWrite): Promise<OrganizerSession> {
    return this.request("/auth/organizer/login", OrganizerSessionSchema, { body: payload });
  }

  listStories(): Promise<Story[]> {
    return this.request("/stories", StorySchema.array());
  }

  createStory(imageUrl: string): Promise<Story> {
    return this.request("/stories", StorySchema, { body: { imageUrl } });
  }

  /** For an endpoint that answers 204: there is no body to validate, only a status to respect. */
  private async requestVoid(path: string, options: MethodOptions = {}): Promise<void> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.initData !== null) headers["x-max-init-data"] = this.initData;
    if (this.organizerToken !== null) headers["authorization"] = `Bearer ${this.organizerToken}`;
    if (options.body !== undefined) headers["content-type"] = "application/json";
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { method: options.method ?? "POST", headers, body: options.body !== undefined ? JSON.stringify(options.body) : undefined });
    } catch {
      throw new ApiError(0, `network error while fetching ${path}`);
    }
    if (!response.ok) throw new ApiError(response.status, `API ${path} failed with ${response.status}`);
  }

  private async request<T>(path: string, schema: ZodSchema<T>, options: MethodOptions = {}): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.initData !== null) {
      headers["x-max-init-data"] = this.initData;
    }
    if (this.organizerToken !== null) {
      headers["authorization"] = `Bearer ${this.organizerToken}`;
    }
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

  getProfile(): Promise<Profile> {
    return this.request("/profile", ProfileSchema);
  }

  updateProfile(payload: UpdateProfile): Promise<Profile> {
    return this.request("/profile", ProfileSchema, { method: "PATCH", body: payload });
  }

  getPlace(id: string): Promise<Place> {
    return this.request(`/places/${id}`, PlaceSchema);
  }

  createBooking(payload: CreateBooking): Promise<BookingWithSeats> {
    return this.request("/bookings", BookingWithSeatsSchema, { body: payload });
  }

  payBooking(bookingId: string): Promise<BookingWithSeats> {
    return this.request(`/bookings/${bookingId}/payment`, BookingWithSeatsSchema, { method: "POST" });
  }

  cancelBooking(bookingId: string): Promise<BookingWithSeats> {
    return this.request(`/bookings/${bookingId}`, BookingWithSeatsSchema, { method: "DELETE" });
  }

  /** Join the event waitlist; the userId param is ignored server-side, identity comes from initData. */
  joinWaitlist(eventId: string, userId: string): Promise<WaitlistEntry> {
    return this.request(`/waitlist?userId=${encodeURIComponent(userId)}`, WaitlistEntrySchema, { body: { eventId } });
  }

  async getMyWaitlistEntry(eventId: string, userId: string): Promise<WaitlistEntry | null> {
    const query = new URLSearchParams({ eventId, userId });
    try {
      return await this.request(`/waitlist/me?${query.toString()}`, WaitlistEntrySchema);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  confirmWaitlistOffer(entryId: string): Promise<WaitlistEntry> {
    return this.request(`/waitlist/${entryId}/confirm`, WaitlistEntrySchema, { method: "POST" });
  }

  declineWaitlistOffer(entryId: string): Promise<WaitlistEntry> {
    return this.request(`/waitlist/${entryId}/decline`, WaitlistEntrySchema, { method: "POST" });
  }

  createCheckIn(payload: CreateCheckIn): Promise<CheckIn> {
    return this.request("/check-ins", CheckInSchema, { body: payload });
  }

  getVisitStats(userId: string): Promise<VisitStats> {
    return this.request(`/users/${userId}/visit-stats`, VisitStatsSchema);
  }

  getAchievements(userId: string): Promise<Achievement[]> {
    return this.request(`/users/${userId}/achievements`, AchievementSchema.array());
  }

  getMyCity(userId: string): Promise<MyCityPayload> {
    return this.request(`/users/${userId}/my-city`, MyCityPayloadSchema);
  }

  async listCalendar(): Promise<CalendarEntry[]> {
    const response = await this.request("/calendar", CalendarResponseSchema);
    return [...response.upcoming, ...response.past];
  }

  listSubscriptions(): Promise<Subscription[]> {
    return this.request("/subscriptions", SubscriptionSchema.array());
  }

  createSubscription(payload: CreateSubscription): Promise<Subscription> {
    return this.request("/subscriptions", SubscriptionSchema, { body: payload });
  }

  removeSubscription(id: string): Promise<Subscription> {
    return this.request(`/subscriptions/${id}`, SubscriptionSchema, { method: "DELETE" });
  }

  listFriends(): Promise<Friend[]> {
    return this.request("/friends", FriendSchema.array());
  }

  listFriendSuggestions(): Promise<FriendSuggestion[]> {
    return this.request("/friends/suggestions", FriendSuggestionSchema.array());
  }

  getFriendsSyncStatus(): Promise<FriendsSyncStatus> {
    return this.request("/friends/sync", FriendsSyncStatusSchema);
  }

  replaceFriendFollows(userIds: string[]): Promise<string[]> {
    return this.request("/friends/follows", IdArraySchema, { method: "PUT", body: { userIds } });
  }

  closeVote(voteId: string): Promise<Vote> {
    return this.request(`/votes/${voteId}/close`, VoteSchema, { method: "POST" });
  }

  getFriendsActivity(userId: string): Promise<FriendActivityByFriend[]> {
    return this.request(`/friends/activity?userId=${encodeURIComponent(userId)}`, FriendActivityByFriendSchema.array());
  }

  getFriendAvailability(eventId: string): Promise<FriendAvailability[]> {
    return this.request(`/friends/availability?eventId=${encodeURIComponent(eventId)}`, FriendAvailabilitySchema.array());
  }

  createGathering(payload: CreateGathering): Promise<Gathering> {
    return this.request("/gatherings", GatheringSchema, { body: payload });
  }

  getGathering(id: string): Promise<Gathering> {
    return this.request(`/gatherings/${id}`, GatheringSchema);
  }

  respondToGathering(gatheringId: string, response: InviteeResponse): Promise<Gathering> {
    return this.request(`/gatherings/${gatheringId}/response`, GatheringSchema, { method: "PATCH", body: { response } });
  }

  getTaste(): Promise<TasteProfile> {
    return this.request("/taste", TasteProfileSchema);
  }

  getAfterMe(): Promise<AfterMeResponse> {
    return this.request("/taste/after-me", AfterMeResponseSchema);
  }

  getToday(origin: { latitude: number; longitude: number } | null = null): Promise<TodayResponse> {
    const query = origin === null ? "" : `?${new URLSearchParams({ lat: String(origin.latitude), lng: String(origin.longitude) }).toString()}`;
    return this.request(`/today${query}`, TodayResponseSchema);
  }

  getNearbyTimeline(latitude: number, longitude: number): Promise<NearbyTimeline> {
    const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
    return this.request(`/nearby?${query.toString()}`, NearbyTimelineSchema);
  }

  getLeisureOptions(query: LeisureQuery): Promise<LeisureOption[]> {
    const params = new URLSearchParams({ hours: String(query.hours), mood: query.mood, latitude: String(query.latitude), longitude: String(query.longitude) });
    return this.request(`/nearby/free?${params.toString()}`, LeisureOptionSchema.array());
  }

  listPlans(origin: { latitude: number; longitude: number } | null = null): Promise<PlanCard[]> {
    const query = origin === null ? "" : `?${new URLSearchParams({ lat: String(origin.latitude), lng: String(origin.longitude) }).toString()}`;
    return this.request(`/plans${query}`, PlanCardSchema.array());
  }

  getPlan(id: string): Promise<PlanCard> {
    return this.request(`/plans/${id}`, PlanCardSchema);
  }

  createPlan(payload: CreatePlanWrite): Promise<PlanCard> {
    return this.request("/plans", PlanCardSchema, { body: payload });
  }

  /** Cancels one meeting by default; "series" takes the repeats with it. */
  async cancelPlan(planId: string, scope: PlanCancelScope = "occurrence"): Promise<void> {
    await this.requestVoid(`/plans/${planId}?scope=${scope}`, { method: "DELETE" });
  }

  createAutoPlan(eventId: string, latitude: number, longitude: number): Promise<AutoPlanProposal> {
    return this.request("/plans/auto", AutoPlanProposalSchema, { body: { eventId, latitude, longitude } });
  }

  createDayRoute(stops: RouteStopWrite[], latitude?: number, longitude?: number): Promise<DayRoute> {
    return this.request("/routes", DayRouteSchema, { body: { stops, latitude, longitude } });
  }

  optimizeDayRoute(stops: RouteStopWrite[], latitude?: number, longitude?: number): Promise<OptimizeRoute> {
    return this.request("/routes/optimize", OptimizeRouteSchema, { body: { stops, latitude, longitude } });
  }

  listLists(userId: string, eventId?: string): Promise<ListSummary[]> {
    const query = new URLSearchParams({ userId });
    if (eventId !== undefined) query.set("eventId", eventId);
    return this.request(`/lists?${query.toString()}`, ListSummaryArraySchema);
  }

  createList(title: string): Promise<List> {
    return this.request("/lists", ListSchema, { body: { title } });
  }

  renameList(listId: string, title: string): Promise<List> {
    return this.request(`/lists/${listId}`, ListSchema, { method: "PATCH", body: { title } });
  }

  deleteList(listId: string): Promise<List> {
    return this.request(`/lists/${listId}`, ListSchema, { method: "DELETE" });
  }

  addListItem(listId: string, payload: AddListItem): Promise<ListItem> {
    return this.request(`/lists/${listId}/items`, ListItemSchema, { body: payload });
  }

  removeListItem(listId: string, itemId: string): Promise<ListItem> {
    return this.request(`/lists/${listId}/items/${itemId}`, ListItemSchema, { method: "DELETE" });
  }

  getList(listId: string): Promise<ListScreen> {
    return this.request(`/lists/${listId}`, ListScreenSchema);
  }

  listFeedPosts(eventId?: string, placeId?: string): Promise<FeedPost[]> {
    const query = eventId !== undefined ? `?eventId=${encodeURIComponent(eventId)}` : placeId !== undefined ? `?placeId=${encodeURIComponent(placeId)}` : "";
    return this.request(`/feed${query}`, FeedPostSchema.array());
  }

  createFeedPost(payload: CreateFeedPost): Promise<FeedPost> {
    return this.request("/feed", FeedPostSchema, { body: payload });
  }

  /** Toggle a feed like; the userId param is ignored server-side, identity comes from initData. */
  toggleFeedLike(postId: string, userId: string): Promise<FeedPost> {
    return this.request(`/feed/${postId}/like?userId=${encodeURIComponent(userId)}`, FeedPostSchema, { method: "POST" });
  }

  addFeedComment(postId: string, payload: { userId: string; text: string }): Promise<FeedPost> {
    return this.request(`/feed/${postId}/comments`, FeedPostSchema, { body: payload });
  }

  getEventRating(eventId: string): Promise<EventRating> {
    return this.request(`/events/${eventId}/rating`, EventRatingSchema);
  }

  getPlacePage(placeId: string, userId: string): Promise<PlacePage> {
    return this.request(`/places/${placeId}/page?userId=${encodeURIComponent(userId)}`, PlacePageSchema);
  }

  createReview(payload: CreateReview): Promise<Review> {
    return this.request("/reviews", ReviewSchema, { body: payload });
  }

  /** Moderator queue: the backend answers 403 unless the viewer is in MODERATOR_MAX_USER_IDS. */
  listOpenReports(): Promise<Report[]> {
    return this.request("/reports?status=open", ReportSchema.array());
  }

  resolveReport(reportId: string): Promise<Report> {
    return this.request(`/reports/${reportId}/resolve`, ReportSchema, { body: {} });
  }

  async unpublishTarget(payload: UnpublishWrite): Promise<void> {
    await this.requestVoid("/moderation/unpublish", { method: "POST", body: payload });
  }

  async banOrganizer(userId: string): Promise<void> {
    await this.requestVoid("/moderation/ban", { method: "POST", body: { userId } });
  }

  createReport(payload: CreateReport): Promise<Report> {
    return this.request("/reports", ReportSchema, { body: payload });
  }

  listMicroEvents(): Promise<MicroEvent[]> {
    return this.request("/micro-events", MicroEventSchema.array());
  }

  createMicroEvent(payload: CreateMicroEvent): Promise<MicroEvent> {
    return this.request("/micro-events", MicroEventSchema, { body: payload });
  }

  /** Join a micro-event; the userId param is ignored server-side, identity comes from initData. */
  joinMicroEvent(id: string, userId: string): Promise<MicroEvent> {
    return this.request(`/micro-events/${id}/join?userId=${encodeURIComponent(userId)}`, MicroEventSchema, { method: "POST" });
  }

  /** Leave a micro-event; the userId param is ignored server-side, identity comes from initData. */
  leaveMicroEvent(id: string, userId: string): Promise<MicroEvent> {
    return this.request(`/micro-events/${id}/join?userId=${encodeURIComponent(userId)}`, MicroEventSchema, { method: "DELETE" });
  }

  assistQuery(query: string): Promise<AssistResponse> {
    return this.request("/assist", AssistResponseSchema, { body: { query } });
  }

  assistDay(query: string, save?: boolean): Promise<AssistDayResponse> {
    return this.request("/assist/day", AssistDayResponseSchema, { body: { query, ...(save === undefined ? {} : { save }) } });
  }

  getDiscovery(): Promise<DiscoveryResponse> {
    return this.request("/discovery", DiscoveryResponseSchema);
  }

  /** The «друзья были здесь» map layer: places friends checked in at, the viewer's own visits included. */
  listFriendPlaces(): Promise<FriendPlaceVisit[]> {
    return this.request("/discovery/friend-places", FriendPlaceVisitSchema.array());
  }

  getFriendRoute(userId: string): Promise<FriendRoute> {
    return this.request(`/discovery/friends/${encodeURIComponent(userId)}/route`, FriendRouteSchema);
  }

  getPeople(origin: { latitude: number; longitude: number } | null = null): Promise<PeopleResponse> {
    const query = origin === null ? "" : `?${new URLSearchParams({ lat: String(origin.latitude), lng: String(origin.longitude) }).toString()}`;
    return this.request(`/people${query}`, PeopleResponseSchema);
  }

  getWhereto(query: WheretoQuery): Promise<WheretoResponse> {
    const params = new URLSearchParams({ company: query.company, mood: query.mood, budget: query.budget });
    return this.request(`/whereto?${params.toString()}`, WheretoResponseSchema);
  }

  getPromotionPlacements(): Promise<PromotionPlacements> {
    return this.request("/promotions/placements", PromotionPlacementsSchema);
  }

  getTargetedPromotions(): Promise<TargetedPromotionsResponse> {
    return this.request("/promotions/for-me", TargetedPromotionsResponseSchema);
  }

  listOrganizerEvents(): Promise<OrganizerEvent[]> {
    return this.request("/organizer/events", OrganizerEventArraySchema);
  }

  async createOrganizerEvent(payload: CreateEvent): Promise<OrganizerEvent> {
    const created = await this.request("/organizer/events", OrganizerEventEntitySchema, { body: payload });
    return { ...created, draft: true };
  }

  updateOrganizerEvent(id: string, patch: UpdateOrganizerEvent): Promise<OrganizerEvent> {
    return this.request(`/events/${id}`, OrganizerEventEntitySchema, { method: "PATCH", body: patch });
  }

  async publishOrganizerEvent(id: string): Promise<OrganizerEvent> {
    const published = await this.request(`/organizer/events/${id}/publish`, OrganizerEventEntitySchema, { method: "POST" });
    return { ...published, draft: false };
  }

  listOrganizerPlaces(): Promise<OrganizerPlace[]> {
    return this.request("/organizer/places", OrganizerPlaceArraySchema);
  }

  async createOrganizerPlace(payload: CreatePlace): Promise<OrganizerPlace> {
    const created = await this.request("/organizer/places", OrganizerPlaceEntitySchema, { body: payload });
    return { ...created, draft: true };
  }

  updateOrganizerPlace(id: string, patch: UpdateOrganizerPlace): Promise<OrganizerPlace> {
    return this.request(`/places/${id}`, OrganizerPlaceEntitySchema, { method: "PATCH", body: patch });
  }

  async publishOrganizerPlace(id: string): Promise<OrganizerPlace> {
    const published = await this.request(`/organizer/places/${id}/publish`, OrganizerPlaceEntitySchema, { method: "POST" });
    return { ...published, draft: false };
  }

  getEventSales(eventId: string, period: StatsPeriodQuery = {}): Promise<EventSalesReport> {
    return this.request(`/organizer/events/${eventId}/sales${statsPeriodQuery(period)}`, EventSalesReportSchema);
  }

  getOrganizerEventStats(eventId: string, period: StatsPeriodQuery = {}): Promise<OrganizerEventStats> {
    return this.request(`/organizer/events/${eventId}/stats${statsPeriodQuery(period)}`, OrganizerEventStatsSchema);
  }

  recordPageView(payload: RecordPageViewWrite): Promise<{ recorded: boolean }> {
    return this.request("/views", PageViewResultSchema, { body: payload });
  }

  getEventOrganizerRating(eventId: string): Promise<OrganizerRatingResponse> {
    return this.request(`/events/${eventId}/organizer-rating`, OrganizerRatingResponseSchema);
  }

  getOrganizerRating(userId: string): Promise<OrganizerRatingResponse> {
    return this.request(`/organizers/${userId}/rating`, OrganizerRatingResponseSchema);
  }

  listCampaigns(eventId: string): Promise<PromoCampaign[]> {
    return this.request(`/organizer/events/${eventId}/campaigns`, PromoCampaignSchema.array());
  }

  createCampaign(eventId: string, payload: CreatePromoCampaignWrite): Promise<PromoCampaign> {
    return this.request(`/organizer/events/${eventId}/campaigns`, PromoCampaignSchema, { body: payload });
  }

  listPromotions(eventId: string): Promise<PromotionCampaign[]> {
    return this.request(`/organizer/events/${eventId}/promotions`, PromotionCampaignSchema.array());
  }

  createPromotion(eventId: string, payload: CreatePromotionWrite): Promise<PromotionCampaign> {
    return this.request(`/organizer/events/${eventId}/promotions`, PromotionCampaignSchema, { body: payload });
  }

  markPromotionPaid(eventId: string, campaignId: string, paidAt?: string): Promise<PromotionCampaign> {
    return this.request(`/organizer/events/${eventId}/promotions/${campaignId}/paid`, PromotionCampaignSchema, { body: paidAt === undefined ? {} : { paidAt } });
  }

  listOrganizerPromos(eventId: string): Promise<PromoCode[]> {
    return this.request(`/organizer/events/${eventId}/promocodes`, PromoCodeSchema.array());
  }

  createOrganizerPromo(eventId: string, payload: CreatePromoCodeWrite): Promise<PromoCode> {
    return this.request(`/organizer/events/${eventId}/promocodes`, PromoCodeSchema, { body: payload });
  }

  setOrganizerEarlyAccess(eventId: string, bookingOpensAt: string): Promise<EarlyAccessWrite> {
    return this.request(`/organizer/events/${eventId}/early-access`, EarlyAccessWriteSchema, { body: { bookingOpensAt } });
  }

  createWeGroup(payload: CreateWeGroupWrite): Promise<WeGroupScreen> {
    return this.request("/we-groups", WeGroupScreenSchema, { body: payload });
  }

  listWeGroups(): Promise<WeGroupScreen[]> {
    return this.request("/we-groups", WeGroupScreenSchema.array());
  }

  getWeGroup(id: string): Promise<WeGroupScreen> {
    return this.request(`/we-groups/${id}`, WeGroupScreenSchema);
  }

  addWeGroupEvent(id: string, eventId: string): Promise<WeGroupScreen> {
    return this.request(`/we-groups/${id}/events`, WeGroupScreenSchema, { body: { eventId } });
  }

  addWeGroupPlace(id: string, placeId: string): Promise<WeGroupScreen> {
    return this.request(`/we-groups/${id}/places`, WeGroupScreenSchema, { body: { placeId } });
  }

  archiveWeGroup(id: string): Promise<WeGroupScreen> {
    return this.request(`/we-groups/${id}/archive`, WeGroupScreenSchema, { method: "POST" });
  }

  getPlanBudget(planId: string): Promise<PlanBudget> {
    return this.request(`/plans/${planId}/budget`, PlanBudgetSchema);
  }

  addPlanExpense(planId: string, payload: CreatePlanExpenseWrite): Promise<PlanBudget> {
    return this.request(`/plans/${planId}/expenses`, PlanBudgetSchema, { body: payload });
  }

  createVote(payload: CreateVoteWrite): Promise<Vote> {
    return this.request("/votes", VoteSchema, { body: payload });
  }

  getVote(id: string): Promise<Vote> {
    return this.request(`/votes/${id}`, VoteSchema);
  }

  castBallot(voteId: string, eventId: string): Promise<Vote> {
    return this.request(`/votes/${voteId}/ballots`, VoteSchema, { body: { eventId } });
  }
}

export const apiClient = new ApiClient();

/** Fire-and-forget page-view tracking (#196): a tracking failure must never break a page, so the rejection is swallowed here. */
export function trackPageView(payload: RecordPageViewWrite): void {
  void apiClient.recordPageView(payload).catch(() => {});
}
