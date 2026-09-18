// START_MODULE_CONTRACT
// PURPOSE: Mock API layer for the catalog, event page, profile, calendar, friends feed, shared plans, check-ins, achievements, my-city, post-event reviews, reports, UGC micro-events, the place social page, the nearby timeline/leisure surface, reverse discovery and people matching while backend endpoints (M2–M5, P2) do not exist yet.
// SCOPE: In-memory Moscow fixtures (events/places/organizers, incl. two past events with a seeded demo booking for the review flow, plus MOCK_TODAY-curated events filling the nearby buckets), in-memory bookings, FIFO waitlist with timed confirmation offers, check-ins, seeded friend profiles (interests/privacy) and friend place visits, plan cards, autoplan drafts, day routes, preset lists, seeded reviews with rating aggregates and deduplicated reports, open micro-events with join/leave counters, achievements and my-city derived from check-ins, pure fixture filtering, nearby timeline buckets and leisure chains relative to MOCK_NOW, reverse discovery of friend places the demo user has not visited, people matching on seeded interests/participations, NL assist with deterministic criteria parsing, history/partner explanations, Saturday stops and rate-limit parity, fetch interceptor enabled by VITE_USE_MOCK=1 in main.tsx.
// DEPENDS: ./client.js (parseEventFilters, EventFilters, CreateGathering, AddListItem, ListSummary, ListItemCard, CreateMicroEvent, CreateReview, CreateReport, Report, EventRating), @max-events/api-contracts (Event, Place, User, Booking, Profile, PlanCard, List, ListItem, CheckIn, VisitStats, Achievement, MyCitySummary, MemoryPoint, MicroEvent, Review, WaitlistEntry, NearbyCard, NearbyTimeline, NearbyBucket, LeisureMood, LeisureOption, AutoPlanProposal, DayRoute, OptimizeRoute, RoutePoint, AssistCriteria, AssistQueryWrite, AssistResponse, AssistPick, AssistDayResponse, DiscoveryFriendPlaces, DiscoveryResponse, FriendRoute, PeopleCandidate, PeopleMatchContext, PeopleResponse, CreateBookingSchema, CreateAutoPlanWriteSchema, CreateDayRouteWriteSchema, MicroEventSchema, ReviewSchema, UpdateProfileSchema, LeisureMoodSchema, AssistQueryWriteSchema, IdSchema)
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockPlaces - Moscow venue fixtures (incl. two food spots — Депо and the Gorky Park food court feeding the autoplan food picks)
// - mockEvents - Moscow event fixtures (all four categories, paid and free, incl. two past events for the review flow, one event "today" for the place page, two MOCK_TODAY daytime events filling the nearby now/inAnHour buckets)
// - MOCK_TODAY - the fixed demo "today" (Moscow day key) the place page fixtures are curated for
// - MOCK_NOW - the fixed demo "now" (noon of MOCK_TODAY) the nearby timeline buckets and leisure window are computed from
// - mockNearbyBucket - event start -> now / inAnHour / evening / tomorrow against MOCK_NOW (backend parity)
// - nearbyTimeline - four-bucket nearby timeline from fixtures, haversine distance from the requested coords (mock GET /nearby)
// - leisureOptions - deterministic per-mood leisure chains from fixtures inside the free window (mock GET /nearby/free)
// - mockOrganizers - demo organizer fixture for event details
// - resetMockMicroEvents - restore seeded micro-events (test isolation)
// - microEvents - open micro-events soonest first
// - createMockMicroEvent - create a micro event, author counts as the first participant (mock POST)
// - joinMockMicroEvent - join with the counter, idempotent (mock POST /join)
// - leaveMockMicroEvent - leave with the counter, idempotent (mock DELETE /join)
// - resetMockFeed - restore seeded impression posts (test isolation)
// - feedPosts - impression posts newest first, optionally only one event (the event wall)
// - toggleMockFeedLike - like/unlike toggle with the counter, idempotent per state (mock POST)
// - addMockFeedComment - append a comment attributed to its author (mock POST)
// - createMockFeedPost - publish an impression post as its author (mock POST)
// - mockDemoUser - demo user returned by mock auth outside MAX (VITE_USE_MOCK=1)
// - mockFriendIds - friend user ids of the demo user (social counters fixtures)
// - mockFriends - friend fixtures for the "Your people are going" feed
// - friendActivityByFriend - friend participations grouped by friend (feed payload)
// - friendAvailability - per-friend free/busy/unknown for the gathering flow (mock)
// - createMockGathering - in-memory gathering with deterministic invitee responses (mock POST)
// - resetMockGatherings - clear in-memory gatherings (test isolation)
// - mockPlans - plan card fixtures for the plans list and plan screens (backend P1-7-b does not exist yet)
// - resetMockPlans - restore seeded plan cards, dropping autoplan drafts (test isolation)
// - planCards - plan fixtures sorted by the soonest meeting first
// - planCard - single plan card by plan id (or null)
// - createMockAutoPlan - autoplan after «Пойду»: saved draft plan + walk estimate + food picks + dinner->road->meetup->event timeline (mock POST /plans/auto, backend parity)
// - buildMockDayRoute - resolve 2..8 event/place stops to points and haversine walking legs (mock POST /routes, backend parity)
// - optimizeMockDayRoute - keep-first permutation minimizing the total distance, with savings (mock POST /routes/optimize)
// - MOCK_ASSIST_RATE_LIMIT - assist rate limit (backend AssistRateLimiter parity: 20 hits / 10 min)
// - resetMockAssist - clear the assist rate-limit window (test isolation)
// - mockParseAssistQuery - deterministic NL criteria heuristics (backend parse-nl parity)
// - mockAssistMatches - criteria matching over fixtures from MOCK_NOW, max 7 (backend matchAssistEvents parity)
// - mockAssistSuggest - explained picks with history/partner explanations (mock POST /assist, backend AssistService.suggest parity)
// - mockAssistSaturdayKey - next Saturday (today counts) Moscow day key from MOCK_NOW (backend nextSaturdayKey parity)
// - mockAssistDay - Saturday stops + planDraft, plan persisted when save=true (mock POST /assist/day, backend planSaturday parity)
// - filterMockEvents - apply catalog filters to fixtures (date matches the local day of startsAt)
// - LIST_PRESET_TITLES - ru titles of the six preset lists (mock seeds them as List.title)
// - SHARED_LIST_ID - id of the seeded shared collection of the demo user and the first friend
// - SHARED_COLLECTION_TITLE - ru title of the seeded shared collection
// - listSummaries - preset lists of a user with item counters, the saved-item id for the checked event and shared-collection participants
// - listItemCards - items of one list enriched with their events and the participant who added them, newest first (mock)
// - listScreen - one-list aggregate: list + participants + item cards (shared collections surface)
// - addMockListItem - in-memory list membership, idempotent (mock POST)
// - removeMockListItem - in-memory list membership removal (mock DELETE)
// - resetMockLists - clear in-memory lists (test isolation)
// - resetMockReviews - restore seeded reviews (test isolation)
// - eventRating - rating summary and per-category averages for an event from the mock reviews
// - createMockReview - create or replace the review of a user for an event (mock POST /reviews)
// - resetMockReports - clear in-memory reports (test isolation)
// - createMockReport - in-memory deduplicated report (mock POST /reports, duplicate -> 409)
// - resetMockBookings - clear in-memory bookings (test isolation)
// - OFFER_TTL_MS - 15-minute confirmation window of a waitlist offer
// - resetMockWaitlist - clear the in-memory waitlist (test isolation)
// - joinMockWaitlist - join the queue of a sold-out event (mock POST /waitlist; duplicate/seats available/active booking -> 409)
// - myMockWaitlistEntry - active (waiting|offered) entry of a user with its FIFO position, or null (mock GET /waitlist/me)
// - confirmMockWaitlistOffer - confirm an offer into a booking on the reserved seat (mock POST /waitlist/:id/confirm)
// - declineMockWaitlistOffer - cancel an entry; a declined offer passes the seat to the next waiting entry; confirmed/expired -> 409 (mock POST /waitlist/:id/decline)
// - resetMockCheckIns - clear in-memory check-ins (test isolation)
// - resetMockProfiles - restore the seeded friend profiles (test isolation)
// - discoverySummary - per-friend unseen places minus the demo user's check-ins, privacy-gated (mock GET /discovery, backend DiscoveryService.summary parity)
// - friendRoute - chronological unseen places of one friend; own/not-friend/hidden map to 403/404/403 (mock GET /discovery/friends/:userId/route, backend parity)
// - peopleSuggest - mockFriends matched on seeded interests or a shared upcoming event with distances from the requested coords (mock GET /people, backend PeopleService parity)
// - resetMockParticipations - restore seeded participations (test isolation)
// - checkInFor - check-in of a user for an event, or null (mock state for the event page button)
// - createMockCheckIn - in-memory check-in for an event or a place, idempotent (mock POST)
// - visitStatsFor - visit statistics derived from the check-ins of a user
// - achievementsFor - the four README achievements with progress derived from visit stats
// - myCityFor - my-city summary and memory points derived from the check-ins of a user
// - participationStats - per-event status counters, friends count and own status
// - calendarEntries - active bookings of a user enriched with event and place
// - todayPicks - "What to do today?" digest from fixtures (summary counters + three curated cards)
// - placePageFor - place social page aggregate: today events, friend visits, place rating, popularity, personal visits (mock)
// - installMockApi - intercept global fetch for /api/events, /api/places, /api/places/:id/page, /api/events/:id/rating, /api/events/:id/participation, /api/bookings, /api/calendar, /api/waitlist[/me|/:id/confirm|/:id/decline], /api/check-ins, /api/users/:id/visit-stats, /api/users/:id/achievements, /api/users/:id/my-city, /api/profile, /api/friends[/activity|/availability], /api/gatherings, /api/plans[/auto], /api/routes[/optimize], /api/lists[/:id[/items[/:itemId]]], /api/feed[/:id/like|comments], /api/reviews, /api/reports, /api/micro-events, /api/today, /api/nearby[/free], /api/discovery[/friends/:userId/route], /api/people and /api/assist[/day], return a restore function
// END_MODULE_MAP

import type { Achievement, AssistCriteria, AssistDayResponse, AssistPick, AssistQueryWrite, AssistResponse, AutoPlanProposal, AutoPlanTimelineEntry, Booking, CheckIn, CreateAutoPlanWrite, CreateDayRouteWrite, DayRoute, DiscoveryFriendPlaces, DiscoveryResponse, Event, Friend, FriendActivityByFriend, FriendAvailability, FriendRoute, Gathering, InviteeResponse, LeisureMood, LeisureOption, LeisureStop, List, ListItem, ListPreset, MemoryPoint, MicroEvent, MyCitySummary, NearbyBucket, NearbyCard, NearbyTimeline, OptimizeRoute, Participation, ParticipationStatus, PeopleCandidate, PeopleMatchContext, PeopleResponse, Place, PlacePage, PlanCard, Profile, Review, RouteLeg, RoutePoint, TodayEventCard, TodayResponse, User, VisitStats, WaitlistEntry } from "@max-events/api-contracts";
import { AssistQueryWriteSchema, CreateAutoPlanWriteSchema, CreateBookingSchema, CreateDayRouteWriteSchema, DEFAULT_PRIVACY, DEFAULT_SMART_ALERTS, EventCategorySchema, IdSchema, LeisureMoodSchema, ListPresetSchema, MicroEventSchema, ParticipationStatusSchema, ReviewSchema, TimestampSchema, UpdateProfileSchema } from "@max-events/api-contracts";
import { parseEventFilters, REPORT_REASONS, type AddListItem, type CreateFeedPost, type CreateGathering, type CreateMicroEvent, type CreateReport, type CreateReview, type EventFilters, type EventRating, type FeedComment, type FeedPost, type ListItemCard, type ListSummary, type ParticipationStats, type Report } from "./client";

const PLACE_STAMP = "2026-08-01T12:00:00+03:00";

function place(input: Omit<Place, "createdAt" | "updatedAt">): Place {
  return { ...input, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };
}

export const mockPlaces: Place[] = [place({ id: "b0000001-0000-4000-8000-000000000001", title: "Парк Горького", address: "Крымский Вал, 9", city: "Москва", category: "park", latitude: 55.7298, longitude: 37.6019 }), place({ id: "b0000002-0000-4000-8000-000000000002", title: "ГМИИ им. А. С. Пушкина", address: "ул. Волхонка, 12", city: "Москва", category: "museum", latitude: 55.7447, longitude: 37.6055 }), place({ id: "b0000003-0000-4000-8000-000000000003", title: "«Лужники»", address: "Лужнецкая набережная, 24", city: "Москва", category: "sport", latitude: 55.7158, longitude: 37.5543 }), place({ id: "b0000004-0000-4000-8000-000000000004", title: "Депо. Москва", address: "Тверская Застава, 1", city: "Москва", category: "food", latitude: 55.7758, longitude: 37.5936 }), place({ id: "b0000005-0000-4000-8000-000000000005", title: "Фудкорт «Веранда» у Парка Горького", address: "Крымский Вал, 2", city: "Москва", category: "food", latitude: 55.7315, longitude: 37.604 })];

type EventInput = Pick<Event, "id" | "title" | "category" | "city" | "startsAt" | "isPaid" | "priceRub"> & Partial<Event>;

function event(input: EventInput): Event {
  return { description: "", placeId: null, endsAt: null, paymentUrl: null, capacity: null, chatLink: null, promoted: false, ...input };
}

/** "Today" for the place social page (P2-11-c): the demo day the today-block fixtures were curated for. */
export const MOCK_TODAY = "2026-09-12";

/** Moscow-calendar day key of an ISO timestamp (backend moscow-date parity). */
function moscowDateKey(startsAt: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(startsAt));
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
  event({ id: "c000000c-0000-4000-8000-00000000000c", title: "Гастрофестиваль в «Депо»", category: "afisha", city: "Москва", startsAt: "2026-09-27T12:00:00+03:00", endsAt: "2026-09-27T22:00:00+03:00", placeId: mockPlaces[3].id, isPaid: true, priceRub: 700, paymentUrl: "https://tickets.example.com/gastro-festival" }),
  event({ id: "c000000d-0000-4000-8000-00000000000d", title: "Прогулка-знакомство по Парку Горького", category: "tourism", city: "Москва", startsAt: "2026-09-05T10:00:00+03:00", placeId: mockPlaces[0].id, isPaid: false, priceRub: null }),
  event({ id: "c000000e-0000-4000-8000-00000000000e", title: "Открытая репетиция камерного оркестра", category: "afisha", city: "Москва", startsAt: "2026-09-08T19:00:00+03:00", isPaid: false, priceRub: null }),
  event({ id: "c000000f-0000-4000-8000-00000000000f", title: "Летний концерт на Пушкинской набережной", category: "afisha", city: "Москва", startsAt: `${MOCK_TODAY}T19:00:00+03:00`, placeId: mockPlaces[0].id, isPaid: false, priceRub: null, capacity: 200 }),
  event({ id: "c0000010-0000-4000-8000-000000000010", title: "Дневной кофе-маркет в «Депо»", category: "afisha", city: "Москва", startsAt: `${MOCK_TODAY}T12:30:00+03:00`, placeId: mockPlaces[3].id, isPaid: false, priceRub: null, promoted: true }),
  event({ id: "c0000011-0000-4000-8000-000000000011", title: "Лекция об импрессионистах", category: "afisha", city: "Москва", startsAt: `${MOCK_TODAY}T15:00:00+03:00`, placeId: mockPlaces[1].id, isPaid: false, priceRub: null }),
];

export function filterMockEvents(events: Event[], filters: EventFilters): Event[] {
  const city = filters.city?.toLowerCase();
  return events.filter((item) => (filters.category === undefined || item.category === filters.category) && (city === undefined || item.city.toLowerCase() === city) && (filters.date === undefined || item.startsAt.slice(0, 10) === filters.date));
}

export const mockOrganizers: User[] = [{ id: "d0000001-0000-4000-8000-000000000001", maxUserId: "organizer-1", firstName: "Анна", lastName: "Соколова", avatarUrl: null, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP }];

/** Demo identity for mock auth outside MAX (VITE_USE_MOCK=1); the id matches the demo user id used by the booking/profile fixtures. */
export const mockDemoUser: User = { id: "a0000000-0000-4000-8000-000000000001", maxUserId: "demo", firstName: "Демо", lastName: null, avatarUrl: null, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };

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

const mockParticipations = new Map<string, Participation>();
let mockParticipationSeq = 0;

function seedMockParticipations(): void {
  mockParticipations.clear();
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

export function resetMockParticipations(): void {
  seedMockParticipations();
}

/** Mock availability per friend (by mockFriends index); the backend P1-6-b does not exist yet. */
const MOCK_AVAILABILITY: FriendAvailability["availability"][] = ["free", "busy", "unknown", "free", "free", "busy", "unknown"];

export function friendAvailability(): FriendAvailability[] {
  return mockFriends.map((friend, index) => ({ friend, availability: MOCK_AVAILABILITY[index] }));
}

/** Deterministic invitee answer per friend (by mockFriends index): Дима accepted, Катя considering, Андрей-like busy mix. */
const MOCK_INVITEE_RESPONSE: InviteeResponse[] = ["accepted", "accepted", "considering", "busy", "accepted", "considering", "busy"];

const mockGatherings = new Map<string, Gathering>();
let mockGatheringSeq = 0;

export function resetMockGatherings(): void {
  mockGatherings.clear();
  mockGatheringSeq = 0;
}

/** Creates an in-memory gathering: known event, known friends, valid proposed time, deterministic per-fixture responses. */
export function createMockGathering(payload: CreateGathering): Gathering | null {
  const event = mockEvents.find((item) => item.id === payload.eventId);
  if (!event || payload.friendIds.length === 0 || !payload.friendIds.every((id) => mockFriendIds.includes(id))) return null;
  if (!TimestampSchema.safeParse(payload.proposedMeetingAt).success) return null;
  const now = new Date().toISOString();
  mockGatheringSeq += 1;
  const gathering: Gathering = {
    id: `d0000000-0000-4000-8000-${String(mockGatheringSeq).padStart(12, "0")}`,
    event,
    invitees: payload.friendIds.map((id) => {
      const index = mockFriendIds.indexOf(id);
      return { friend: mockFriends[index], response: MOCK_INVITEE_RESPONSE[index] };
    }),
    proposedMeetingAt: payload.proposedMeetingAt,
    status: "awaiting_responses",
    createdAt: now,
    updatedAt: now,
  };
  mockGatherings.set(gathering.id, gathering);
  return gathering;
}

/** Plans fixtures for the plans list and plan screens (backend P1-7-b does not exist yet); events reference mockEvents, distance is precomputed to the meeting point. */
export const mockPlans: PlanCard[] = [
  {
    plan: {
      id: "90000000-0000-4000-8000-000000000001",
      eventId: mockEvents[0].id,
      participants: [
        { friend: mockFriends[0], status: "confirmed" },
        { friend: mockFriends[1], status: "confirmed" },
        { friend: mockFriends[2], status: "invited" },
      ],
      meetingPoint: "у метро Смоленская",
      meetingAt: "2026-09-19T18:20:00+03:00",
      createdAt: PLACE_STAMP,
      updatedAt: PLACE_STAMP,
    },
    event: mockEvents[0],
    distanceMeters: 850,
  },
  {
    plan: {
      id: "90000000-0000-4000-8000-000000000002",
      eventId: mockEvents[2].id,
      participants: [
        { friend: mockFriends[3], status: "confirmed" },
        { friend: mockFriends[4], status: "declined" },
      ],
      meetingPoint: "у входа в Парк Горького",
      meetingAt: "2026-09-20T09:30:00+03:00",
      createdAt: PLACE_STAMP,
      updatedAt: PLACE_STAMP,
    },
    event: mockEvents[2],
    distanceMeters: 1200,
  },
];

const MOCK_PLAN_SEED = [...mockPlans];
let mockPlanSeq = MOCK_PLAN_SEED.length;

/** Restore the seeded plan cards, dropping autoplan drafts (test isolation). */
export function resetMockPlans(): void {
  mockPlans.length = 0;
  mockPlans.push(...MOCK_PLAN_SEED);
  mockPlanSeq = MOCK_PLAN_SEED.length;
}

/** Plans of the demo user enriched with event and distance, soonest meeting first. */
export function planCards(): PlanCard[] {
  return [...mockPlans].sort((a, b) => a.plan.meetingAt.localeCompare(b.plan.meetingAt));
}

/** Single plan card by plan id, or null. */
export function planCard(id: string): PlanCard | null {
  return mockPlans.find((card) => card.plan.id === id) ?? null;
}

/** Preset list titles per ListPreset; the lists UI renders List.title as-is. */
export const LIST_PRESET_TITLES: Record<ListPreset, string> = {
  want_to_go: "Хочу сходить",
  favorites: "Избранное",
  weekend: "На выходные",
  with_children: "С детьми",
  with_friends: "С друзьями",
  try_later: "Попробовать потом",
};

/** Preset list items seeded on list creation: [preset, mockEvents index]. */
const MOCK_LIST_SEED: [ListPreset, number][] = [
  ["want_to_go", 0],
  ["favorites", 1],
];

const mockLists = new Map<string, List[]>();
const mockListItems: ListItem[] = [];
const mockListItemAuthors = new Map<string, Friend>();
let mockListSeq = 0;
let mockListItemSeq = 0;

export function resetMockLists(): void {
  mockLists.clear();
  mockListItems.length = 0;
  mockListItemAuthors.clear();
  mockListSeq = 0;
  mockListItemSeq = 0;
}

/** The seeded shared collection of the demo user and the first friend; both add items, «Отправить в чат» shares it. */
export const SHARED_LIST_ID = "70000000-0000-4000-8000-0000000000c0";
export const SHARED_COLLECTION_TITLE = "Совместное: идеи на выходные";

const SHARED_LIST_PARTICIPANTS = (): Friend[] => [{ id: mockDemoUser.id, name: "Демо", avatarUrl: null }, mockFriends[0]];

/** Seeded shared-collection items: [mockEvents index, author friend index] (the demo user is index -1). */
const MOCK_SHARED_LIST_SEED: [number, number][] = [
  [6, -1],
  [7, 0],
];

function listItem(listId: string, eventId: string, addedBy: Friend | null = null): ListItem {
  mockListItemSeq += 1;
  const item: ListItem = { id: `71000000-0000-4000-8000-${String(mockListItemSeq).padStart(12, "0")}`, listId, eventId, placeId: null, addedAt: PLACE_STAMP };
  if (addedBy !== null) mockListItemAuthors.set(item.id, addedBy);
  return item;
}

/** The six preset lists of a user plus the shared collection for its participants, created with their seed items on first request. */
function listsFor(userId: string): List[] {
  let lists = mockLists.get(userId);
  if (lists) return lists;
  lists = ListPresetSchema.options.map((preset) => {
    mockListSeq += 1;
    return { id: `70000000-0000-4000-8000-${String(mockListSeq).padStart(12, "0")}`, userId, preset, title: LIST_PRESET_TITLES[preset], createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };
  });
  for (const [preset, eventIndex] of MOCK_LIST_SEED) {
    const list = lists.find((candidate) => candidate.preset === preset);
    if (list) mockListItems.push(listItem(list.id, mockEvents[eventIndex].id));
  }
  if (userId === mockDemoUser.id || userId === mockFriendIds[0]) {
    lists.push({ id: SHARED_LIST_ID, userId, preset: null, title: SHARED_COLLECTION_TITLE, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
    if (!mockListItems.some((item) => item.listId === SHARED_LIST_ID)) {
      for (const [eventIndex, authorIndex] of MOCK_SHARED_LIST_SEED) {
        mockListItems.push(listItem(SHARED_LIST_ID, mockEvents[eventIndex].id, authorIndex === -1 ? SHARED_LIST_PARTICIPANTS()[0] : mockFriends[authorIndex]));
      }
    }
  }
  mockLists.set(userId, lists);
  return lists;
}

function findList(listId: string): List | undefined {
  for (const lists of mockLists.values()) {
    const found = lists.find((list) => list.id === listId);
    if (found) return found;
  }
  return undefined;
}

/** Preset lists of a user with item counters, shared-collection participants; savedItemId points at the item saving eventId (null when not saved). */
export function listSummaries(userId: string, eventId: string | null): ListSummary[] {
  return listsFor(userId).map((list) => {
    const items = mockListItems.filter((item) => item.listId === list.id);
    return { list, itemsCount: items.length, savedItemId: items.find((item) => item.eventId === eventId)?.id ?? null, participants: list.id === SHARED_LIST_ID ? SHARED_LIST_PARTICIPANTS() : [] };
  });
}

/** Items of one list enriched with their events and the participant who added them (null outside shared collections), newest first; null for an unknown list. */
export function listItemCards(listId: string): ListItemCard[] | null {
  if (!findList(listId)) return null;
  return mockListItems
    .filter((item) => item.listId === listId && item.eventId !== null)
    .flatMap((item) => {
      const event = mockEvents.find((candidate) => candidate.id === item.eventId);
      return event ? [{ item, event, addedBy: mockListItemAuthors.get(item.id) ?? null }] : [];
    })
    .reverse();
}

/** One-list aggregate for the list screen: the list, its participants (shared collections) and its item cards; null for an unknown list. */
export function listScreen(listId: string): { list: List; participants: Friend[]; items: ListItemCard[] } | null {
  const list = findList(listId);
  if (!list) return null;
  return { list, participants: list.id === SHARED_LIST_ID ? SHARED_LIST_PARTICIPANTS() : [], items: listItemCards(listId) ?? [] };
}

/** Adds an event to a list, idempotent, attributed to the adding user; "no_list"/"no_event" map to 404 in the interceptor. */
export function addMockListItem(listId: string, payload: AddListItem): ListItem | "no_list" | "no_event" {
  if (!findList(listId)) return "no_list";
  if (!mockEvents.some((event) => event.id === payload.eventId)) return "no_event";
  const existing = mockListItems.find((item) => item.listId === listId && item.eventId === payload.eventId);
  if (existing) return existing;
  const item = listItem(listId, payload.eventId, mockUserAsFriend(payload.userId));
  mockListItems.push(item);
  return item;
}

/** Removes an item from a list; null when the list or the item is unknown. */
export function removeMockListItem(listId: string, itemId: string): ListItem | null {
  const index = mockListItems.findIndex((item) => item.listId === listId && item.id === itemId);
  if (index === -1) return null;
  return mockListItems.splice(index, 1)[0];
}

type ReviewSeed = { friend: number; event: number; stars: number; categoryScores?: Review["categoryScores"]; wouldGoAgain: boolean; text?: string };

/** Seeded friend reviews for the showcase event and the park place events so both pages show aggregates out of the box. */
const MOCK_REVIEW_SEED: ReviewSeed[] = [
  { friend: 0, event: 0, stars: 5, categoryScores: { atmosphere: 5, organization: 5, price: 4, place: 5 }, wouldGoAgain: true, text: "Атмосфера замечательная, обязательно приду снова!" },
  { friend: 1, event: 0, stars: 4, categoryScores: { atmosphere: 4, organization: 5, price: 3, place: 4 }, wouldGoAgain: true },
  { friend: 2, event: 0, stars: 5, categoryScores: { atmosphere: 5, organization: 4 }, wouldGoAgain: false, text: "Всё понравилось, но пришлось долго искать вход." },
  { friend: 3, event: 12, stars: 4, categoryScores: { atmosphere: 4, place: 4 }, wouldGoAgain: true, text: "Парк отличное место для прогулок." },
  { friend: 4, event: 2, stars: 5, categoryScores: { atmosphere: 5, place: 5 }, wouldGoAgain: true },
];

const mockReviews: Review[] = [];
let mockReviewSeq = 0;

function seedMockReviews(): void {
  mockReviews.length = 0;
  mockReviewSeq = 0;
  for (const seed of MOCK_REVIEW_SEED) {
    mockReviewSeq += 1;
    mockReviews.push({ id: `80000000-0000-4000-8000-${String(mockReviewSeq).padStart(12, "0")}`, userId: mockFriendIds[seed.friend], eventId: mockEvents[seed.event].id, placeId: null, stars: seed.stars, categoryScores: seed.categoryScores ?? {}, wouldGoAgain: seed.wouldGoAgain, photos: [], text: seed.text ?? null, createdAt: PLACE_STAMP });
  }
}
seedMockReviews();

export function resetMockReviews(): void {
  seedMockReviews();
}

/** Rating summary and per-category averages for an event from the mock reviews; null for an unknown event. */
export function eventRating(eventId: string): EventRating | null {
  if (!mockEvents.some((item) => item.id === eventId)) return null;
  const reviews = mockReviews.filter((item) => item.eventId === eventId);
  const averageStars = reviews.length === 0 ? 0 : reviews.reduce((sum, item) => sum + item.stars, 0) / reviews.length;
  const categoryAverage = (category: keyof Review["categoryScores"]): number | null => {
    const scores = reviews.flatMap((item) => (item.categoryScores[category] === undefined ? [] : [item.categoryScores[category]!]));
    return scores.length === 0 ? null : scores.reduce((sum, score) => sum + score, 0) / scores.length;
  };
  return {
    summary: { eventId, placeId: null, averageStars, reviewsCount: reviews.length },
    categoryAverages: { atmosphere: categoryAverage("atmosphere"), organization: categoryAverage("organization"), price: categoryAverage("price"), place: categoryAverage("place") },
  };
}

/** Creates or replaces the review of a user for an event (one review per user and event); "no_event"/"invalid" map to 404/400 in the interceptor. */
export function createMockReview(payload: CreateReview): Review | "no_event" | "invalid" {
  if (!mockEvents.some((item) => item.id === payload.eventId)) return "no_event";
  mockReviewSeq += 1;
  const review: Review = { id: `80000000-0000-4000-8000-${String(mockReviewSeq).padStart(12, "0")}`, userId: payload.userId, eventId: payload.eventId, placeId: null, stars: payload.stars, categoryScores: payload.categoryScores ?? {}, wouldGoAgain: payload.wouldGoAgain, photos: [], text: payload.text ?? null, createdAt: new Date().toISOString() };
  if (!ReviewSchema.safeParse(review).success) return "invalid";
  const existing = mockReviews.findIndex((item) => item.userId === payload.userId && item.eventId === payload.eventId);
  if (existing !== -1) {
    mockReviews[existing] = review;
    return review;
  }
  mockReviews.push(review);
  return review;
}

const mockReports: Report[] = [];
let mockReportSeq = 0;

export function resetMockReports(): void {
  mockReports.length = 0;
  mockReportSeq = 0;
}

/** Creates a report; a repeat report of the same user for the same event returns "duplicate" (mock 409), an unknown event or reason — "no_target"/"invalid". */
export function createMockReport(payload: CreateReport): Report | "duplicate" | "no_target" | "invalid" {
  if (!mockEvents.some((item) => item.id === payload.eventId)) return "no_target";
  if (!REPORT_REASONS.includes(payload.reason)) return "invalid";
  if (mockReports.some((item) => item.userId === payload.userId && item.targetId === payload.eventId)) return "duplicate";
  mockReportSeq += 1;
  const report: Report = { id: `81000000-0000-4000-8000-${String(mockReportSeq).padStart(12, "0")}`, userId: payload.userId, targetType: "event", targetId: payload.eventId, reason: payload.reason, status: "open", createdAt: new Date().toISOString() };
  mockReports.push(report);
  return report;
}

type MicroEventSeed = Omit<MicroEvent, "createdAt">;

const MICRO_EVENT_SEED: MicroEventSeed[] = [
  { id: "20000000-0000-4000-8000-000000000001", authorId: mockFriendIds[0], title: "Играем в баскетбол", startsAt: "2026-09-19T19:00:00+03:00", locationText: "Стритбол-площадка у Парка Горького", placeId: null, participantsLimit: 6, participantsCount: 3, status: "open" },
  { id: "20000000-0000-4000-8000-000000000002", authorId: mockFriendIds[1], title: "Прогулка по Парку Горького", startsAt: "2026-09-20T14:00:00+03:00", locationText: null, placeId: mockPlaces[0].id, participantsLimit: 4, participantsCount: 2, status: "open" },
];

const mockMicroEvents: MicroEvent[] = [];
const mockMicroMemberships = new Set<string>();
let mockMicroSeq = 0;

function seedMockMicroEvents(): void {
  mockMicroEvents.length = 0;
  mockMicroMemberships.clear();
  mockMicroSeq = MICRO_EVENT_SEED.length;
  for (const seed of MICRO_EVENT_SEED) mockMicroEvents.push({ ...seed, createdAt: PLACE_STAMP });
}
seedMockMicroEvents();

export function resetMockMicroEvents(): void {
  seedMockMicroEvents();
}

/** Open micro events soonest first. */
export function microEvents(): MicroEvent[] {
  return [...mockMicroEvents].filter((item) => item.status === "open").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Creates a micro event from the UGC form; the author counts as the first participant; "no_place"/"invalid" map to 404/400 in the interceptor. */
export function createMockMicroEvent(payload: CreateMicroEvent): MicroEvent | "no_place" | "invalid" {
  if (payload.userId === "") return "invalid";
  const placeId = payload.placeId ?? null;
  if (placeId !== null && !mockPlaces.some((item) => item.id === placeId)) return "no_place";
  mockMicroSeq += 1;
  const candidate: MicroEvent = {
    id: `20000000-0000-4000-8000-${String(mockMicroSeq).padStart(12, "0")}`,
    authorId: payload.userId,
    title: payload.title,
    startsAt: payload.startsAt,
    locationText: payload.locationText ?? null,
    placeId,
    participantsLimit: payload.participantsLimit,
    participantsCount: 1,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  if (!MicroEventSchema.safeParse(candidate).success) return "invalid";
  mockMicroEvents.push(candidate);
  mockMicroMemberships.add(`${payload.userId}:${candidate.id}`);
  return candidate;
}

/** Joins an open micro event; already-joined is idempotent, a full or cancelled one — "full"/"closed" (mock 409). */
export function joinMockMicroEvent(id: string, userId: string): MicroEvent | null | "full" | "closed" {
  const target = mockMicroEvents.find((item) => item.id === id);
  if (!target) return null;
  const key = `${userId}:${id}`;
  if (target.status === "cancelled") return "closed";
  if (mockMicroMemberships.has(key)) return target;
  if (target.participantsCount >= target.participantsLimit) return "full";
  target.participantsCount += 1;
  mockMicroMemberships.add(key);
  return target;
}

/** Leaves a micro event; not-joined is idempotent, an unknown one — null (mock 404). */
export function leaveMockMicroEvent(id: string, userId: string): MicroEvent | null {
  const target = mockMicroEvents.find((item) => item.id === id);
  if (!target) return null;
  if (mockMicroMemberships.delete(`${userId}:${id}`)) target.participantsCount -= 1;
  return target;
}

type FeedSeed = { author: number; event: number; text: string; likes: number; comments?: { author: number; text: string }[] };

/** Seeded impression posts (Instagram-style feed); the photo is a CSS placeholder, authors are friends. */
const MOCK_FEED_SEED: FeedSeed[] = [
  { author: 0, event: 1, text: "Выставка впечатляет — очередь к картине на входе.", likes: 3, comments: [{ author: 1, text: "Тоже иду на выходных!" }] },
  { author: 1, event: 5, text: "Матч был огонь, трибуны горели до финального свистка.", likes: 1 },
  { author: 2, event: 11, text: "Гастрофестиваль: обязательно попробуйте сырные ряды.", likes: 2, comments: [{ author: 0, text: "Скинь фото сырной лавки" }] },
];

const mockFeedPosts: FeedPost[] = [];
const mockFeedLikes = new Set<string>();
let mockFeedSeq = 0;
let mockFeedCommentSeq = 0;

function seedMockFeed(): void {
  mockFeedPosts.length = 0;
  mockFeedLikes.clear();
  mockFeedCommentSeq = 0;
  MOCK_FEED_SEED.forEach((seed, index) => {
    mockFeedSeq = index + 1;
    mockFeedPosts.push({
      id: `30000000-0000-4000-8000-${String(mockFeedSeq).padStart(12, "0")}`,
      author: mockFriends[seed.author],
      eventId: mockEvents[seed.event].id,
      text: seed.text,
      likesCount: seed.likes,
      likedByMe: false,
      comments: (seed.comments ?? []).map((comment) => {
        mockFeedCommentSeq += 1;
        return { id: `31000000-0000-4000-8000-${String(mockFeedCommentSeq).padStart(12, "0")}`, author: mockFriends[comment.author], text: comment.text };
      }),
    });
  });
}
seedMockFeed();

export function resetMockFeed(): void {
  seedMockFeed();
}

function mockUserAsFriend(userId: string): FeedPost["author"] {
  return mockFriends.find((friend) => friend.id === userId) ?? { id: userId, name: "Демо", avatarUrl: null };
}

/** Impression posts newest first; with an eventId — only the posts of that event (the event wall). */
export function feedPosts(eventId: string | null): FeedPost[] {
  return [...mockFeedPosts].reverse().filter((post) => eventId === null || post.eventId === eventId);
}

/** Likes/unlikes a post as the user; the returned post carries the new counter and state; null for an unknown post. */
export function toggleMockFeedLike(postId: string, userId: string): FeedPost | null {
  const post = mockFeedPosts.find((item) => item.id === postId);
  if (!post) return null;
  const key = `${userId}:${postId}`;
  if (mockFeedLikes.has(key)) {
    mockFeedLikes.delete(key);
    post.likesCount -= 1;
    post.likedByMe = false;
  } else {
    mockFeedLikes.add(key);
    post.likesCount += 1;
    post.likedByMe = true;
  }
  return post;
}

/** Appends a comment attributed to its author; null for an unknown post (mock 404). */
export function addMockFeedComment(postId: string, payload: { userId: string; text: string }): FeedPost | null {
  const post = mockFeedPosts.find((item) => item.id === postId);
  if (!post) return null;
  mockFeedCommentSeq += 1;
  const comment: FeedComment = { id: `31000000-0000-4000-8000-${String(mockFeedCommentSeq).padStart(12, "0")}`, author: mockUserAsFriend(payload.userId), text: payload.text };
  post.comments.push(comment);
  return post;
}

/** Publishes an impression post as its author; null for an unknown event (mock 404). */
export function createMockFeedPost(payload: CreateFeedPost): FeedPost | null {
  if (!mockEvents.some((event) => event.id === payload.eventId)) return null;
  mockFeedSeq += 1;
  const post: FeedPost = { id: `30000000-0000-4000-8000-${String(mockFeedSeq).padStart(12, "0")}`, author: mockUserAsFriend(payload.userId), eventId: payload.eventId, text: payload.text, likesCount: 0, likedByMe: false, comments: [] };
  mockFeedPosts.push(post);
  return post;
}

/** Friends feed grouped by friend: every friend with the events they attend, soonest event first, groups by soonest event. */
export function friendActivityByFriend(): FriendActivityByFriend[] {
  const byFriend = new Map<string, FriendActivityByFriend>();
  for (const friend of mockFriends) byFriend.set(friend.id, { friend, events: [] });
  for (const record of mockParticipations.values()) {
    const group = byFriend.get(record.userId);
    const event = mockEvents.find((item) => item.id === record.eventId);
    if (!group || !event) continue;
    group.events.push({ event, participationStatus: record.status });
  }
  const groups = [...byFriend.values()].filter((group) => group.events.length > 0);
  for (const group of groups) group.events.sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
  return groups.sort((a, b) => a.events[0].event.startsAt.localeCompare(b.events[0].event.startsAt));
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

const mockBookings: Booking[] = [];
let mockBookingSeq = 0;

/** Module-load seed: active booking of the demo user on a past fixture event, so the post-event review flow ("Как прошло?") is reachable in the demo; test resets clear it. */
function seedMockBookings(): void {
  mockBookingSeq += 1;
  mockBookings.push({ id: `e0000000-0000-4000-8000-${String(mockBookingSeq).padStart(12, "0")}`, userId: mockDemoUser.id, eventId: "c000000d-0000-4000-8000-00000000000d", status: "active", createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
}
seedMockBookings();

export function resetMockBookings(): void {
  mockBookings.length = 0;
  mockBookingSeq = 0;
}

/** Confirmation window of a waitlist offer (mirrors the backend OFFER_TTL_MS). */
export const OFFER_TTL_MS = 15 * 60 * 1000;

const mockWaitlist: WaitlistEntry[] = [];
let mockWaitlistSeq = 0;

export function resetMockWaitlist(): void {
  mockWaitlist.length = 0;
  mockWaitlistSeq = 0;
}

/** Queue entries of an event (waiting|offered) in FIFO order. */
function waitlistQueue(eventId: string): WaitlistEntry[] {
  return mockWaitlist.filter((entry) => entry.eventId === eventId && (entry.status === "waiting" || entry.status === "offered")).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function withWaitlistPosition(entry: WaitlistEntry): WaitlistEntry {
  const queue = waitlistQueue(entry.eventId);
  const index = queue.findIndex((item) => item.id === entry.id);
  return { ...entry, position: index === -1 ? queue.length + 1 : index + 1 };
}

/** Offers a freed seat to the first waiting entry (15-minute confirmation window); the offered seat stays reserved. */
function offerNextMockWaitlist(eventId: string, now: Date): void {
  const next = waitlistQueue(eventId).find((entry) => entry.status === "waiting");
  if (!next) return;
  next.status = "offered";
  next.offeredUntil = new Date(now.getTime() + OFFER_TTL_MS).toISOString();
  next.updatedAt = now.toISOString();
}

/** Lazy offer expiry: a due offer flips to expired and the seat passes to the next waiting entry. */
function refreshMockWaitlist(eventId: string, now: Date = new Date()): void {
  for (const entry of mockWaitlist) {
    if (entry.eventId !== eventId || entry.status !== "offered" || entry.offeredUntil === null) continue;
    if (new Date(entry.offeredUntil).getTime() > now.getTime()) continue;
    entry.status = "expired";
    entry.offeredUntil = null;
    entry.updatedAt = now.toISOString();
    offerNextMockWaitlist(eventId, now);
  }
}

/** Joins the queue of a sold-out event; "no_event"/"seats_available"/"duplicate"/"booked" map to 404/409 in the interceptor. */
export function joinMockWaitlist(eventId: string, userId: string): WaitlistEntry | "no_event" | "seats_available" | "duplicate" | "booked" {
  if (!mockEvents.some((item) => item.id === eventId)) return "no_event";
  if ((remainingSeats(eventId) ?? 1) > 0) return "seats_available";
  if (mockBookings.some((booking) => booking.eventId === eventId && booking.userId === userId && booking.status === "active")) return "booked";
  if (waitlistQueue(eventId).some((entry) => entry.userId === userId)) return "duplicate";
  const now = new Date().toISOString();
  mockWaitlistSeq += 1;
  const entry: WaitlistEntry = { id: `82000000-0000-4000-8000-${String(mockWaitlistSeq).padStart(12, "0")}`, userId, eventId, position: 0, status: "waiting", offeredUntil: null, createdAt: now, updatedAt: now };
  mockWaitlist.push(entry);
  return withWaitlistPosition(entry);
}

/** Active (waiting|offered) entry of a user for an event with its FIFO position, or null (mock GET /waitlist/me). */
export function myMockWaitlistEntry(eventId: string, userId: string): WaitlistEntry | null {
  refreshMockWaitlist(eventId);
  const entry = waitlistQueue(eventId).find((item) => item.userId === userId);
  return entry === undefined ? null : withWaitlistPosition(entry);
}

/** Confirms an offer into a booking on the reserved seat (no capacity re-check); null/"not_offered"/"offer_expired" map to 404/409 in the interceptor. */
export function confirmMockWaitlistOffer(entryId: string): WaitlistEntry | null | "not_offered" | "offer_expired" {
  const entry = mockWaitlist.find((item) => item.id === entryId);
  if (!entry) return null;
  refreshMockWaitlist(entry.eventId);
  if (entry.status === "confirmed") return withWaitlistPosition(entry);
  if (entry.status === "expired") return "offer_expired";
  if (entry.status !== "offered" || entry.offeredUntil === null) return "not_offered";
  const position = withWaitlistPosition(entry).position;
  const now = new Date().toISOString();
  mockBookingSeq += 1;
  mockBookings.push({ id: `e0000000-0000-4000-8000-${String(mockBookingSeq).padStart(12, "0")}`, userId: entry.userId, eventId: entry.eventId, status: "active", createdAt: now, updatedAt: now });
  entry.status = "confirmed";
  entry.offeredUntil = null;
  entry.updatedAt = now;
  return { ...entry, position };
}

/** Cancels a queue entry; a declined offer passes the reserved seat to the next waiting entry. Idempotent for cancelled entries; "already_confirmed"/"offer_expired" map to 409, null to 404 (mock 404). */
export function declineMockWaitlistOffer(entryId: string): WaitlistEntry | null | "already_confirmed" | "offer_expired" {
  const entry = mockWaitlist.find((item) => item.id === entryId);
  if (!entry) return null;
  refreshMockWaitlist(entry.eventId);
  if (entry.status === "cancelled") return withWaitlistPosition(entry);
  if (entry.status === "confirmed") return "already_confirmed";
  if (entry.status === "expired") return "offer_expired";
  const wasOffered = entry.status === "offered";
  const now = new Date();
  entry.status = "cancelled";
  entry.offeredUntil = null;
  entry.updatedAt = now.toISOString();
  if (wasOffered) offerNextMockWaitlist(entry.eventId, now);
  return withWaitlistPosition(entry);
}

const mockCheckIns: CheckIn[] = [];
let mockCheckInSeq = 0;

export function resetMockCheckIns(): void {
  mockCheckIns.length = 0;
  mockCheckInSeq = 0;
}

/** Check-in of a user for an event, or null (mock state for the event page button). */
export function checkInFor(userId: string, eventId: string): CheckIn | null {
  return mockCheckIns.find((item) => item.userId === userId && item.eventId === eventId) ?? null;
}

/** Creates an in-memory check-in for exactly one known event or place, idempotent per target; "no_target"/"invalid" map to 404/400 in the interceptor. */
export function createMockCheckIn(userId: string, payload: { eventId?: string; placeId?: string }): CheckIn | "no_target" | "invalid" {
  if (userId === "" || (payload.eventId === undefined) === (payload.placeId === undefined)) return "invalid";
  const known = payload.eventId !== undefined ? mockEvents.some((item) => item.id === payload.eventId) : mockPlaces.some((item) => item.id === payload.placeId);
  if (!known) return "no_target";
  const existing = mockCheckIns.find((item) => item.userId === userId && item.eventId === (payload.eventId ?? null) && item.placeId === (payload.placeId ?? null));
  if (existing) return existing;
  mockCheckInSeq += 1;
  const checkIn: CheckIn = { id: `60000000-0000-4000-8000-${String(mockCheckInSeq).padStart(12, "0")}`, userId, eventId: payload.eventId ?? null, placeId: payload.placeId ?? null, checkedInAt: new Date().toISOString() };
  mockCheckIns.push(checkIn);
  return checkIn;
}

/** Visit statistics derived from the check-ins of a user: events, unique places, per-category counters. */
export function visitStatsFor(userId: string): VisitStats {
  const mine = mockCheckIns.filter((item) => item.userId === userId);
  const placeIds = new Set<string>();
  const byCategory = new Map<string, number>();
  for (const item of mine) {
    const event = item.eventId === null ? undefined : mockEvents.find((candidate) => candidate.id === item.eventId);
    if (item.placeId !== null) placeIds.add(item.placeId);
    if (event !== undefined) {
      if (event.placeId !== null) placeIds.add(event.placeId);
      byCategory.set(event.category, (byCategory.get(event.category) ?? 0) + 1);
    }
  }
  return { userId, placesCount: placeIds.size, eventsCount: mine.filter((item) => item.eventId !== null).length, byCategory: EventCategorySchema.options.map((category) => ({ category, count: byCategory.get(category) ?? 0 })) };
}

/** The four README achievements («Исследователь города», «Музыкальный фанат», «Город за выходные», «Волонтер») with progress from visit stats. */
export function achievementsFor(stats: VisitStats): Achievement[] {
  const count = (category: string) => stats.byCategory.find((item) => item.category === category)?.count ?? 0;
  return [
    { code: "city_explorer", title: "Исследователь города", threshold: 10, progress: Math.min(stats.placesCount, 10), grantedAt: stats.placesCount >= 10 ? PLACE_STAMP : null },
    { code: "music_fan", title: "Музыкальный фанат", threshold: 5, progress: Math.min(count("afisha"), 5), grantedAt: count("afisha") >= 5 ? PLACE_STAMP : null },
    { code: "weekend_city", title: "Город за выходные", threshold: 3, progress: Math.min(stats.placesCount, 3), grantedAt: stats.placesCount >= 3 ? PLACE_STAMP : null },
    { code: "volunteer", title: "Волонтёр", threshold: 5, progress: Math.min(count("volunteering"), 5), grantedAt: count("volunteering") >= 5 ? PLACE_STAMP : null },
  ];
}

/** My-city summary and memory points derived from the check-ins of a user. */
export function myCityFor(userId: string): { summary: MyCitySummary; points: MemoryPoint[] } {
  const stats = visitStatsFor(userId);
  // ponytail: fixtures have no district data — districts ≈ unique visited places; backend supplies real districts later
  const summary: MyCitySummary = { userId, placesCount: stats.placesCount, eventsCount: stats.eventsCount, districtsCount: stats.placesCount };
  const points = mockCheckIns
    .filter((item) => item.userId === userId && item.eventId !== null)
    .flatMap((item) => {
      const event = mockEvents.find((candidate) => candidate.id === item.eventId)!;
      const lat = event.placeId === null ? null : (mockPlaces.find((candidate) => candidate.id === event.placeId)?.latitude ?? null);
      const lng = event.placeId === null ? null : (mockPlaces.find((candidate) => candidate.id === event.placeId)?.longitude ?? null);
      return lat === null || lng === null ? [] : [{ latitude: lat, longitude: lng, eventId: item.eventId, placeId: null, visitedAt: item.checkedInAt }];
    });
  return { summary, points };
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

/** "What to do today?" digest: curated cards from fixtures; the showcase friends (Анна → выставка, Катя → фестиваль) back the friends counter. */
export function todayPicks(): TodayResponse {
  const cards: TodayEventCard[] = [
    {
      event: mockEvents[1],
      labels: [
        { kind: "distance", minutes: 15 },
        { kind: "friend_attending", friendName: "Анна" },
      ],
    },
    {
      event: mockEvents[11],
      labels: [
        { kind: "distance", minutes: 20 },
        { kind: "friend_attending", friendName: "Катя" },
      ],
    },
    { event: mockEvents[9], labels: [{ kind: "free_entry" }, { kind: "spots_left", count: remainingSeats(mockEvents[9].id) ?? 0 }] },
  ];
  return {
    summary: {
      nearbyCount: mockEvents.length,
      suitableCount: cards.length,
      withFriendsCount: cards.filter((card) => card.labels.some((label) => label.kind === "friend_attending")).length,
    },
    cards,
  };
}

/** The fixed demo "now" for the nearby surface: noon of MOCK_TODAY, so the four buckets fill deterministically (12:30 -> now, 15:00 -> inAnHour, 19:00 -> evening, next morning -> tomorrow). */
export const MOCK_NOW = new Date(`${MOCK_TODAY}T12:00:00+03:00`);

const HOUR_MS = 60 * 60 * 1000;
const NEARBY_MAX_KM = 15;

/** Rough great-circle distance, backend haversine parity. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function moscowHour(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", hour12: false }).format(date));
}

/** Exclusive bucket of an event start relative to the demo now (mirrors the backend nearbyBucket). */
export function mockNearbyBucket(startsAt: string, now: Date = MOCK_NOW): NearbyBucket | null {
  const start = new Date(startsAt);
  const delta = start.getTime() - now.getTime();
  if (delta < 0) return null;
  if (delta < HOUR_MS) return "now";
  if (moscowDateKey(startsAt) === moscowDateKey(now.toISOString())) return moscowHour(start) >= 18 ? "evening" : "inAnHour";
  if (moscowDateKey(startsAt) === moscowDateKey(new Date(now.getTime() + 24 * HOUR_MS).toISOString())) return "tomorrow";
  return null;
}

/** Four-bucket nearby timeline from fixtures within 48h of the demo now and 15 km of the requested coords, promoted first then by distance (backend parity). */
export function nearbyTimeline(latitude: number, longitude: number, now: Date = MOCK_NOW): NearbyTimeline {
  const timeline: NearbyTimeline = { now: [], inAnHour: [], evening: [], tomorrow: [] };
  const cards: NearbyCard[] = [];
  const horizon = now.getTime() + 48 * HOUR_MS;
  for (const item of mockEvents) {
    if (item.placeId === null) continue;
    const place = mockPlaces.find((candidate) => candidate.id === item.placeId);
    if (!place) continue;
    const start = new Date(item.startsAt).getTime();
    if (start < now.getTime() || start > horizon) continue;
    const bucket = mockNearbyBucket(item.startsAt, now);
    if (bucket === null) continue;
    const km = haversineKm(latitude, longitude, place.latitude, place.longitude);
    if (km > NEARBY_MAX_KM) continue;
    cards.push({ event: item, place, distanceKm: Math.round(km * 10) / 10, bucket, promoted: item.promoted });
  }
  cards.sort((a, b) => Number(b.promoted) - Number(a.promoted) || a.distanceKm - b.distanceKm || a.event.startsAt.localeCompare(b.event.startsAt));
  for (const card of cards) timeline[card.bucket].push(card);
  return timeline;
}

/** Deterministic per-mood leisure chains from fixtures inside the free window; the title is the chain joined by arrows (README «Парк → выставка → бар» style). */
export function leisureOptions(hours: number, mood: LeisureMood, latitude: number, longitude: number, now: Date = MOCK_NOW): LeisureOption[] {
  const until = now.getTime() + hours * HOUR_MS;
  const events = mockEvents
    .filter((item) => {
      const start = new Date(item.startsAt).getTime();
      return start >= now.getTime() && start <= until;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const places = mockPlaces
    .map((place) => ({ place, km: haversineKm(latitude, longitude, place.latitude, place.longitude) }))
    .filter((row) => row.km <= NEARBY_MAX_KM)
    .sort((a, b) => a.km - b.km);
  const placeStop = (place: Place): LeisureStop => ({ kind: "place", placeId: place.id, eventId: null, title: place.title, startsAt: null });
  const eventStop = (item: Event): LeisureStop => ({ kind: "event", placeId: item.placeId, eventId: item.id, title: item.title, startsAt: item.startsAt });
  let stops: LeisureStop[] = [];
  if (mood === "relax") {
    const park = places.find((row) => row.place.category === "park");
    const show = events.find((item) => item.category === "afisha");
    const museum = places.find((row) => row.place.category === "museum");
    const food = places.find((row) => row.place.category === "food");
    if (park) stops.push(placeStop(park.place));
    if (show) stops.push(eventStop(show));
    else if (museum) stops.push(placeStop(museum.place));
    if (food) stops.push(placeStop(food.place));
  } else if (mood === "active") {
    const sport = events.find((item) => item.category === "sport");
    const sportPlace = places.find((row) => row.place.category === "sport");
    const park = places.find((row) => row.place.category === "park");
    if (sport) stops.push(eventStop(sport));
    else if (sportPlace) stops.push(placeStop(sportPlace.place));
    if (park) stops.push(placeStop(park.place));
  } else {
    // ponytail: the mock has no friend-participation feed for the demo window — friends chain = the window events, soonest first
    stops = events.slice(0, 3).map(eventStop);
  }
  if (stops.length === 0) return [];
  return [{ mood, title: stops.map((stop) => stop.title).join(" → "), stops }];
}

/** Coordinate query params mirroring the backend validation (missing/out-of-range -> null -> 400 in the interceptor). */
function parseMockCoords(url: URL): [number, number] | null {
  const latitude = url.searchParams.get("latitude");
  const longitude = url.searchParams.get("longitude");
  if (latitude === null || longitude === null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return [lat, lng];
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

const mockProfiles = new Map<string, Profile>();

/** Friend profile seeds for the discovery/people mocks: matching interests plus Лена hiding her routes (privacy gates parity). */
const MOCK_FRIEND_PROFILE_SEED: { interests: string[]; routesHidden: boolean }[] = [
  { interests: ["музыка", "выставки"], routesHidden: false },
  { interests: ["спорт"], routesHidden: false },
  { interests: ["кино", "музыка"], routesHidden: false },
  { interests: ["гастрономия"], routesHidden: false },
  { interests: ["музыка", "кино"], routesHidden: false },
  { interests: ["гастрономия", "спорт"], routesHidden: false },
  { interests: ["йога"], routesHidden: true },
];

function seedMockProfiles(): void {
  mockProfiles.clear();
  mockFriends.forEach((friend, index) => {
    const seed = MOCK_FRIEND_PROFILE_SEED[index];
    mockProfiles.set(friend.id, { userId: friend.id, city: "Москва", interests: [...seed.interests], smartAlerts: { ...DEFAULT_SMART_ALERTS }, privacy: seed.routesHidden ? { visitHistory: "friends", routes: "hidden" } : { ...DEFAULT_PRIVACY }, recommendationsEnabled: true });
  });
}
seedMockProfiles();

export function resetMockProfiles(): void {
  seedMockProfiles();
}

function profileFor(userId: string): Profile {
  return mockProfiles.get(userId) ?? { userId, city: "Москва", interests: [], smartAlerts: { ...DEFAULT_SMART_ALERTS }, privacy: { ...DEFAULT_PRIVACY }, recommendationsEnabled: true };
}

/** Reverse-discovery friend visit seeds: [mockFriends index, mockPlaces index] in chronological visit order per friend. */
const MOCK_DISCOVERY_VISIT_SEED: [number, number][] = [
  [0, 1],
  [0, 3],
  [0, 4],
  [1, 2],
  [1, 3],
  [2, 1],
  [5, 3],
  [6, 0],
];

/** Places the demo user has already visited, from the mock check-ins (event check-ins resolve to their place, backend parity). */
function myVisitedPlaceIds(): Set<string> {
  const ids = new Set<string>();
  for (const item of mockCheckIns) {
    if (item.userId !== mockDemoUser.id) continue;
    if (item.placeId !== null) ids.add(item.placeId);
    else if (item.eventId !== null) {
      const eventPlace = mockEvents.find((candidate) => candidate.id === item.eventId)?.placeId;
      if (eventPlace) ids.add(eventPlace);
    }
  }
  return ids;
}

/** Places of one friend the demo user has not visited, deduplicated in visit order (backend unseenPlaces parity). */
function unseenFriendPlaces(friendIndex: number, myPlaceIds: Set<string>): Place[] {
  const seen = new Set<string>();
  const unseen: Place[] = [];
  for (const [friend, placeIndex] of MOCK_DISCOVERY_VISIT_SEED) {
    if (friend !== friendIndex) continue;
    const place = mockPlaces[placeIndex];
    if (myPlaceIds.has(place.id) || seen.has(place.id)) continue;
    seen.add(place.id);
    unseen.push(place);
  }
  return unseen;
}

/** Reverse discovery summary (mock GET /discovery): per-friend unseen places minus the demo user's check-ins, privacy-gated (backend DiscoveryService.summary parity). */
export function discoverySummary(): DiscoveryResponse {
  const myPlaceIds = myVisitedPlaceIds();
  const unique = new Set<string>();
  const byFriend: DiscoveryFriendPlaces[] = [];
  for (const [index, friend] of mockFriends.entries()) {
    const privacy = profileFor(friend.id).privacy;
    if (privacy.visitHistory === "hidden") continue;
    const unseen = unseenFriendPlaces(index, myPlaceIds);
    for (const place of unseen) unique.add(place.id);
    if (unseen.length === 0) continue;
    byFriend.push({ friend, newPlacesCount: unseen.length, places: privacy.routes === "hidden" ? [] : unseen });
  }
  byFriend.sort((a, b) => b.newPlacesCount - a.newPlacesCount || a.friend.name.localeCompare(b.friend.name));
  return { newPlacesCount: unique.size, byFriend };
}

/** Friend route of unseen places (mock GET /discovery/friends/:userId/route); "own"/"not_friend"/"hidden" map to 403/404/403 in the interceptor (backend DiscoveryService.route parity). */
export function friendRoute(userId: string): FriendRoute | "own" | "not_friend" | "hidden" {
  if (userId === mockDemoUser.id) return "own";
  const index = mockFriendIds.indexOf(userId);
  if (index === -1) return "not_friend";
  const privacy = profileFor(userId).privacy;
  if (privacy.routes === "hidden" || privacy.visitHistory === "hidden") return "hidden";
  return { friend: mockFriends[index], places: unseenFriendPlaces(index, myVisitedPlaceIds()) };
}

const PEOPLE_MAX_KM = 15;
const PEOPLE_GOING: ParticipationStatus[] = ["wants_to_go", "probably_going", "going", "looking_for_company", "looking_for_travel_buddy", "looking_for_after_event_company"];

/** Demo viewer interests backing the people matching (the editable demo profile starts empty; the backend reads the viewer profile). */
const MOCK_DEMO_INTERESTS = ["музыка", "кино", "гастрономия"];

/** Friends looking for company today; the backend derives this from COMPANY participations on today events — seeded to keep the friends-feed fixtures stable. */
const MOCK_LOOKING_TODAY = new Set<string>([mockFriendIds[3], mockFriendIds[4]]);

/** Latest seeded visit place of a friend (geo origin of the people distance, backend latest-check-in parity). */
function latestVisitPlace(friendIndex: number): Place | null {
  for (let index = MOCK_DISCOVERY_VISIT_SEED.length - 1; index >= 0; index -= 1) {
    const [friend, placeIndex] = MOCK_DISCOVERY_VISIT_SEED[index];
    if (friend === friendIndex) return mockPlaces[placeIndex];
  }
  return null;
}

/** People matching (mock GET /people): mockFriends sharing a seeded demo interest or a going-status participation on the same upcoming event; distance from the requested coords to the friend's latest visit within 15 km, friends without visits stay via the shared city (backend PeopleService parity). */
export function peopleSuggest(latitude: number, longitude: number, now: Date = MOCK_NOW): PeopleResponse {
  const myInterests = new Set(MOCK_DEMO_INTERESTS.map((interest) => interest.toLowerCase()));
  const upcoming = new Set(mockEvents.filter((item) => new Date(item.startsAt).getTime() >= now.getTime()).map((item) => item.id));
  const myEventIds = new Set([...mockParticipations.values()].filter((row) => row.userId === mockDemoUser.id && PEOPLE_GOING.includes(row.status)).map((row) => row.eventId));
  const people: PeopleCandidate[] = [];
  for (const [index, friend] of mockFriends.entries()) {
    const profile = profileFor(friend.id);
    const sharedInterests = profile.interests.filter((interest) => myInterests.has(interest.toLowerCase()));
    const sharedEvent = [...mockParticipations.values()].find((row) => row.userId === friend.id && PEOPLE_GOING.includes(row.status) && myEventIds.has(row.eventId) && upcoming.has(row.eventId));
    let distanceKm: number | null = null;
    const visit = profile.privacy.visitHistory === "hidden" ? null : latestVisitPlace(index);
    if (visit !== null) {
      distanceKm = Math.round(haversineKm(latitude, longitude, visit.latitude, visit.longitude) * 10) / 10;
      if (distanceKm > PEOPLE_MAX_KM) continue;
    }
    if (sharedInterests.length === 0 && sharedEvent === undefined) continue;
    const event = sharedEvent === undefined ? null : mockEvents.find((item) => item.id === sharedEvent.eventId)!;
    const context: PeopleMatchContext = event === null ? { kind: "shared_interest", interest: sharedInterests[0], explanation: `общий интерес: ${sharedInterests[0]}` } : { kind: "shared_event", event, explanation: `вы оба хотите на «${event.title}»` };
    people.push({ person: friend, distanceKm, sharedInterests, lookingForCompanyToday: MOCK_LOOKING_TODAY.has(friend.id), context });
  }
  people.sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99) || a.person.name.localeCompare(b.person.name));
  return { nearbyCount: people.length, lookingForCompanyTodayCount: people.filter((row) => row.lookingForCompanyToday).length, people };
}

/** Viewer coords when the people query carries no lat/lng (MOSCOW_CENTER parity with the nearby screen ponytail). */
const MOCK_PEOPLE_CENTER: [number, number] = [55.7522, 37.6156];

/** lat/lng query params mirroring the backend parseOrigin: both absent -> null (caller default); partial or out-of-range -> "invalid" (400). */
function parseMockOrigin(url: URL): [number, number] | null | "invalid" {
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  if ((lat === null || lat === "") && (lng === null || lng === "")) return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return "invalid";
  return [latitude, longitude];
}

function remainingSeats(eventId: string): number | null {
  const target = mockEvents.find((item) => item.id === eventId);
  if (!target || target.capacity === null) return null;
  refreshMockWaitlist(eventId);
  const taken = mockBookings.filter((booking) => booking.eventId === eventId && booking.status === "active").length + mockWaitlist.filter((entry) => entry.eventId === eventId && entry.status === "offered").length;
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
    checkInId: checkInFor(userId, eventId)?.id ?? null,
  };
}

function parseBookingBody(init?: RequestInit): Record<string, unknown> | undefined {
  try {
    return JSON.parse(typeof init?.body === "string" ? init.body : "null");
  } catch {
    return undefined;
  }
}

// Backend plans.service parity: walking pace, food radius and the dinner->road->meetup->event buffers.
const WALK_M_PER_MIN = 80;
const FOOD_RADIUS_KM = 2;
const MEETUP_BUFFER_MIN = 20;
const DINNER_MIN = 70;

function walkingMinutes(meters: number): number {
  return Math.max(0, Math.round(meters / WALK_M_PER_MIN));
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.round(haversineKm(lat1, lon1, lat2, lon2) * 1000);
}

/** Autoplan after «Пойду» (mock POST /plans/auto, backend generateAutoplan parity): walk estimate to the venue, up to 3 nearest food places within 2 km, the dinner->road->meetup->event timeline and a persisted draft plan card; "no_event" maps to 404 in the interceptor. */
export function createMockAutoPlan(payload: CreateAutoPlanWrite): AutoPlanProposal | "no_event" {
  const event = mockEvents.find((item) => item.id === payload.eventId);
  if (!event) return "no_event";
  const venue = event.placeId === null ? null : (mockPlaces.find((item) => item.id === event.placeId) ?? null);
  const meters = venue === null ? 0 : haversineMeters(payload.latitude, payload.longitude, venue.latitude, venue.longitude);
  const travelMinutes = walkingMinutes(meters);
  const foodPlaces =
    venue === null
      ? []
      : mockPlaces
          .filter((item) => item.category === "food")
          .map((item) => ({ item, km: haversineKm(venue.latitude, venue.longitude, item.latitude, item.longitude) }))
          .filter((row) => row.km <= FOOD_RADIUS_KM)
          .sort((a, b) => a.km - b.km)
          .slice(0, 3)
          .map((row) => row.item);
  const startsAt = new Date(event.startsAt);
  const meetupAt = new Date(startsAt.getTime() - (travelMinutes + MEETUP_BUFFER_MIN) * 60_000);
  const dinnerAt = new Date(meetupAt.getTime() - DINNER_MIN * 60_000);
  const meetingPoint = foodPlaces[0]?.title ?? venue?.address ?? event.city;
  const now = new Date().toISOString();
  mockPlanSeq += 1;
  const card: PlanCard = {
    plan: { id: `90000000-0000-4000-8000-${String(mockPlanSeq).padStart(12, "0")}`, eventId: event.id, participants: [], meetingPoint, meetingAt: meetupAt.toISOString(), createdAt: now, updatedAt: now },
    event,
    distanceMeters: meters,
  };
  mockPlans.push(card);
  const timeline: AutoPlanTimelineEntry[] = [];
  if (foodPlaces[0]) timeline.push({ at: dinnerAt.toISOString(), label: "ужин", detail: foodPlaces[0].title });
  timeline.push({ at: meetupAt.toISOString(), label: "дорога", detail: `${travelMinutes} мин до места` });
  timeline.push({ at: meetupAt.toISOString(), label: "встреча", detail: meetingPoint });
  timeline.push({ at: startsAt.toISOString(), label: "событие", detail: event.title });
  return { plan: card, travelMinutes, foodPlaces, timeline };
}

type MockRouteError = "no_event" | "no_place" | "event_without_place";

/** Resolve event/place stops to route points from fixtures (backend RoutesService.resolve parity); the optional origin becomes the «Старт» point. */
function mockRoutePoints(payload: CreateDayRouteWrite): RoutePoint[] | MockRouteError {
  const points: RoutePoint[] = [];
  for (const stop of payload.stops) {
    if (stop.eventId != null) {
      const event = mockEvents.find((item) => item.id === stop.eventId);
      if (!event) return "no_event";
      if (event.placeId === null) return "event_without_place";
      const place = mockPlaces.find((item) => item.id === event.placeId);
      if (!place) return "no_place";
      points.push({ title: event.title, at: new Date(event.startsAt).toISOString(), latitude: place.latitude, longitude: place.longitude, eventId: event.id, placeId: place.id });
    } else {
      const place = mockPlaces.find((item) => item.id === stop.placeId);
      if (!place) return "no_place";
      points.push({ title: place.title, at: null, latitude: place.latitude, longitude: place.longitude, eventId: null, placeId: place.id });
    }
  }
  if (payload.latitude !== undefined && payload.longitude !== undefined) {
    points.unshift({ title: "Старт", at: null, latitude: payload.latitude, longitude: payload.longitude, eventId: null, placeId: null });
  }
  return points;
}

/** Ordered points -> walking legs and totals (backend toDayRoute parity). */
function mockDayRoute(points: RoutePoint[]): DayRoute {
  const legs: RouteLeg[] = [];
  let totalMeters = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const meters = haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude);
    totalMeters += meters;
    legs.push({ fromTitle: from.title, toTitle: to.title, travelMinutes: walkingMinutes(meters), distanceKm: Math.round((meters / 1000) * 10) / 10 });
  }
  return { points, legs, totalMinutes: walkingMinutes(totalMeters), totalKm: Math.round((totalMeters / 1000) * 10) / 10 };
}

function mockRouteMeters(points: RoutePoint[]): number {
  let sum = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    sum += haversineMeters(points[index].latitude, points[index].longitude, points[index + 1].latitude, points[index + 1].longitude);
  }
  return sum;
}

function mockPermutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  items.forEach((item, index) => {
    const rest = items.filter((_, i) => i !== index);
    for (const perm of mockPermutations(rest)) result.push([item, ...perm]);
  });
  return result;
}

/** Day route from 2..8 stops (mock POST /routes); error tags map to 404/400 in the interceptor. */
export function buildMockDayRoute(payload: CreateDayRouteWrite): DayRoute | MockRouteError {
  const points = mockRoutePoints(payload);
  return typeof points === "string" ? points : mockDayRoute(points);
}

/** Optimized day route: brute-force permutation of the stops after the first (mock POST /routes/optimize, ≤8 stops per contract, so ≤5040 candidates). */
export function optimizeMockDayRoute(payload: CreateDayRouteWrite): OptimizeRoute | MockRouteError {
  const points = mockRoutePoints(payload);
  if (typeof points === "string") return points;
  const original = mockDayRoute(points);
  const [head, ...tail] = points;
  let best = points;
  let bestMeters = mockRouteMeters(points);
  for (const perm of mockPermutations(tail)) {
    const candidate = [head, ...perm];
    const meters = mockRouteMeters(candidate);
    if (meters < bestMeters) {
      best = candidate;
      bestMeters = meters;
    }
  }
  const optimized = mockDayRoute(best);
  return { original, optimized, savedMinutes: original.totalMinutes - optimized.totalMinutes, savedKm: Math.round((original.totalKm - optimized.totalKm) * 10) / 10 };
}

/** Backend AssistRateLimiter parity: 20 hits per 10 minutes per user (the mock serves the single demo user). */
export const MOCK_ASSIST_RATE_LIMIT = 20;
const MOCK_ASSIST_RATE_WINDOW_MS = 10 * 60 * 1000;
const mockAssistHits: number[] = [];

/** Clear the in-memory assist rate-limit window (test isolation). */
export function resetMockAssist(): void {
  mockAssistHits.length = 0;
}

function mockAssistRateHit(now: number = Date.now()): boolean {
  const cutoff = now - MOCK_ASSIST_RATE_WINDOW_MS;
  while (mockAssistHits.length > 0 && mockAssistHits[0] <= cutoff) mockAssistHits.shift();
  if (mockAssistHits.length >= MOCK_ASSIST_RATE_LIMIT) return false;
  mockAssistHits.push(now);
  return true;
}

/** Backend sanitizeAssistQuery parity: strip injection wrappers; empty after sanitize is invalid. */
function mockSanitizeAssistQuery(raw: string): string {
  return raw
    .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, " ")
    .replace(/system\s*:/gi, " ")
    .replace(/<\|[\s\S]*?\|>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^[.\s,:;-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Backend parseAssistQuery parity: deterministic NL heuristics (числа→budget, «вечером»→evening, «с девушкой»→partner, «музыка»→music). */
export function mockParseAssistQuery(query: string): AssistCriteria {
  const text = query.toLowerCase();
  const when: AssistCriteria["when"] = text.includes("вечер") ? "evening" : text.includes("утр") ? "morning" : text.includes("днём") || text.includes("днем") || text.includes("обед") ? "afternoon" : "any";
  const budgetMatch = /(\d[\d\s]*)\s*(₽|руб)/i.exec(text);
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/\s/g, "")) : NaN;
  const company: AssistCriteria["company"] = text.includes("девушк") || text.includes("парн") || text.includes("двоем") || text.includes("вдвоём") ? "partner" : text.includes("дет") ? "kids" : text.includes("друз") || text.includes("компани") ? "friends" : "alone";
  const genre: AssistCriteria["genre"] = text.includes("музык") || text.includes("джаз") || text.includes("концерт") ? "music" : text.includes("спорт") || text.includes("футбол") || text.includes("зал") ? "sport" : text.includes("парк") || text.includes("прогул") || text.includes("природ") ? "outdoors" : "any";
  return { when, budgetMaxRub: Number.isFinite(budget) ? budget : null, company, genre };
}

function mockMoscowHour(startsAt: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(startsAt)).find((part) => part.type === "hour")?.value;
  return Number(hour ?? "0");
}

/** Backend matchAssistEvents parity: events from MOCK_NOW filtered by the parsed criteria, soonest first, max 7 (fixtures carry no published flag). */
export function mockAssistMatches(criteria: AssistCriteria, now: Date = MOCK_NOW): Event[] {
  return mockEvents
    .filter((item) => new Date(item.startsAt).getTime() >= now.getTime())
    .filter((item) => {
      if (criteria.when === "any") return true;
      const hour = mockMoscowHour(item.startsAt);
      if (criteria.when === "morning") return hour < 12;
      if (criteria.when === "afternoon") return hour >= 12 && hour < 17;
      return hour >= 17;
    })
    .filter((item) => criteria.budgetMaxRub === null || !item.isPaid || (item.priceRub !== null && item.priceRub <= criteria.budgetMaxRub))
    .filter((item) => criteria.company !== "partner" || item.category !== "volunteering")
    .filter((item) => {
      if (criteria.genre === "any") return true;
      const blob = `${item.title} ${item.description}`.toLowerCase();
      if (criteria.genre === "music") return item.category === "afisha" || /музык|джаз|концерт|симфон|рахманин/.test(blob);
      if (criteria.genre === "sport") return item.category === "sport";
      return item.category === "tourism" || item.category === "volunteering";
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .slice(0, 7);
}

/** Backend explainPick parity. */
function mockAssistExplanation(fromHistory: boolean, fromPartner: boolean): string {
  if (fromHistory && fromPartner) return "По твоей истории, и уже сохранила твоя девушка";
  if (fromHistory) return "По твоей истории";
  if (fromPartner) return "Уже сохранила твоя девушка";
  return "Подходит по запросу";
}

/** Backend formatAssistSummary parity. */
function mockAssistSummary(total: number, history: number, saved: number): string {
  if (total === 0) return "Не нашел вариантов по запросу.";
  return `Нашел ${total} вариантов, ${history} по твоей истории, ${saved} уже сохранила твоя девушка`;
}

type MockAssistError = "rate_limited" | "invalid" | "no_events";

/** Backend AssistService.suggest parity: rate limit -> sanitize -> parse -> match -> explain from the demo check-ins and the first friend's saved items; error tags map to 429/400 in the interceptor. */
export function mockAssistSuggest(payload: AssistQueryWrite): AssistResponse | MockAssistError {
  if (!mockAssistRateHit()) return "rate_limited";
  const cleaned = mockSanitizeAssistQuery(payload.query);
  if (!cleaned) return "invalid";
  const criteria = mockParseAssistQuery(cleaned);
  const matched = mockAssistMatches(criteria);
  const historyIds = new Set(mockCheckIns.filter((item) => item.userId === mockDemoUser.id && item.eventId !== null).map((item) => item.eventId as string));
  const historyCategories = new Set(mockEvents.filter((item) => historyIds.has(item.id)).map((item) => item.category));
  const partnerListIds = new Set(listsFor(mockFriendIds[0]).map((list) => list.id));
  const savedIds = new Set(mockListItems.filter((item) => partnerListIds.has(item.listId) && item.eventId !== null).map((item) => item.eventId as string));
  const items: AssistPick[] = matched.map((matchedEvent) => ({ event: matchedEvent, explanation: mockAssistExplanation(historyIds.has(matchedEvent.id) || historyCategories.has(matchedEvent.category), savedIds.has(matchedEvent.id)) }));
  const historyCount = items.filter((row) => historyIds.has(row.event.id) || historyCategories.has(row.event.category)).length;
  const savedCount = items.filter((row) => savedIds.has(row.event.id)).length;
  return { summary: mockAssistSummary(items.length, historyCount, savedCount), criteria, items };
}

/** Backend nextSaturdayKey parity: next Saturday (today counts) as a Moscow YYYY-MM-DD key, from MOCK_NOW by default. */
export function mockAssistSaturdayKey(now: Date = MOCK_NOW): string {
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", weekday: "short" }).format(now);
  const weekday = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>;
  const addDays = (6 - (weekday[label] ?? 0) + 7) % 7;
  return moscowDateKey(new Date(now.getTime() + addDays * 86_400_000).toISOString());
}

/** Backend AssistService.planSaturday parity: up to 4 stops of the nearest Saturday + planDraft; with save=true the plan is persisted into the mock plans, plan is null otherwise; error tags map to 429/400 in the interceptor. */
export function mockAssistDay(payload: AssistQueryWrite): AssistDayResponse | MockAssistError {
  if (!mockAssistRateHit()) return "rate_limited";
  const cleaned = mockSanitizeAssistQuery(payload.query);
  if (!cleaned) return "invalid";
  const date = mockAssistSaturdayKey();
  const catalog = mockEvents
    .filter((item) => moscowDateKey(item.startsAt) === date)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .slice(0, 4);
  if (catalog.length === 0) return "no_events";
  const stops = catalog.map((stopEvent) => ({ at: stopEvent.startsAt, event: stopEvent, explanation: "Слот субботнего дня" }));
  const first = catalog[0];
  const planDraft = { eventId: first.id, participantIds: [] as string[], meetingPoint: first.title, meetingAt: first.startsAt };
  let plan: PlanCard | null = null;
  if (payload.save === true) {
    const now = new Date().toISOString();
    mockPlanSeq += 1;
    plan = { plan: { id: `90000000-0000-4000-8000-${String(mockPlanSeq).padStart(12, "0")}`, eventId: planDraft.eventId, participants: [], meetingPoint: planDraft.meetingPoint, meetingAt: planDraft.meetingAt, createdAt: now, updatedAt: now }, event: first, distanceMeters: 0 };
    mockPlans.push(plan);
  }
  return { summary: `Собрал день на субботу ${date}: ${stops.length} событий`, date, stops, planDraft, plan };
}

export function installMockApi(): () => void {
  const real = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (input instanceof Request) return real(input, init);
    const url = new URL(input, "http://mock.local");
    if (url.pathname === "/api/friends/activity") {
      return Response.json(friendActivityByFriend());
    }
    if (url.pathname === "/api/friends") {
      return Response.json(mockFriends);
    }
    if (url.pathname === "/api/today") {
      return Response.json(todayPicks());
    }
    if (url.pathname === "/api/nearby/free") {
      const coords = parseMockCoords(url);
      const hours = Number(url.searchParams.get("hours"));
      const mood = LeisureMoodSchema.safeParse(url.searchParams.get("mood"));
      if (coords === null || !Number.isInteger(hours) || hours < 1 || hours > 8 || !mood.success) return new Response(null, { status: 400 });
      return Response.json(leisureOptions(hours, mood.data, coords[0], coords[1]));
    }
    if (url.pathname === "/api/nearby") {
      const coords = parseMockCoords(url);
      if (coords === null) return new Response(null, { status: 400 });
      return Response.json(nearbyTimeline(coords[0], coords[1]));
    }
    const discoveryRoute = /^\/api\/discovery\/friends\/([^/]+)\/route$/.exec(url.pathname);
    if (discoveryRoute) {
      if (!IdSchema.safeParse(discoveryRoute[1]).success) return new Response(null, { status: 400 });
      const route = friendRoute(discoveryRoute[1]);
      if (route === "own" || route === "hidden") return new Response(null, { status: 403 });
      if (route === "not_friend") return new Response(null, { status: 404 });
      return Response.json(route);
    }
    if (url.pathname === "/api/discovery") {
      return Response.json(discoverySummary());
    }
    if (url.pathname === "/api/people") {
      const origin = parseMockOrigin(url);
      if (origin === "invalid") return new Response(null, { status: 400 });
      const [latitude, longitude] = origin ?? MOCK_PEOPLE_CENTER;
      return Response.json(peopleSuggest(latitude, longitude));
    }
    if (url.pathname === "/api/places") {
      return Response.json(mockPlaces);
    }
    const placePage = /^\/api\/places\/([^/]+)\/page$/.exec(url.pathname);
    if (placePage) {
      const page = placePageFor(placePage[1], url.searchParams.get("userId") ?? "");
      return page ? Response.json(page) : new Response(null, { status: 404 });
    }
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
    const rating = /^\/api\/events\/([^/]+)\/rating$/.exec(url.pathname);
    if (rating) {
      const payload = eventRating(rating[1]);
      return payload ? Response.json(payload) : new Response(null, { status: 404 });
    }
    const stats = /^\/api\/events\/([^/]+)\/participation\/stats$/.exec(url.pathname);
    if (stats) {
      if (!mockEvents.some((item) => item.id === stats[1])) return new Response(null, { status: 404 });
      return Response.json(participationStats(stats[1], url.searchParams.get("userId") ?? ""));
    }
    const participation = /^\/api\/events\/([^/]+)\/participation$/.exec(url.pathname);
    if (participation && init?.method === "PUT") {
      const userId = url.searchParams.get("userId") ?? "";
      const parsed = ParticipationStatusSchema.safeParse(parseBookingBody(init)?.status);
      if (!parsed.success || userId === "") return new Response(null, { status: 400 });
      if (!mockEvents.some((item) => item.id === participation[1])) return new Response(null, { status: 404 });
      const now = new Date().toISOString();
      const key = `${userId}:${participation[1]}`;
      const existing = mockParticipations.get(key);
      mockParticipationSeq += 1;
      const record: Participation = existing ? { ...existing, status: parsed.data, updatedAt: now } : { id: `f0000000-0000-4000-8000-${String(mockParticipationSeq).padStart(12, "0")}`, userId, eventId: participation[1], status: parsed.data, createdAt: now, updatedAt: now };
      mockParticipations.set(key, record);
      return Response.json(record);
    }
    if (participation && init?.method === "DELETE") {
      const key = `${url.searchParams.get("userId") ?? ""}:${participation[1]}`;
      const existing = mockParticipations.get(key);
      if (!existing) return new Response(null, { status: 404 });
      mockParticipations.delete(key);
      return Response.json(existing);
    }
    if (url.pathname === "/api/profile" && init?.method === "PATCH") {
      const parsed = UpdateProfileSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const current = profileFor(mockDemoUser.id);
      const updated: Profile = { ...current, ...parsed.data, smartAlerts: { ...current.smartAlerts, ...parsed.data.smartAlerts }, privacy: { ...current.privacy, ...parsed.data.privacy }, recommendationsEnabled: parsed.data.recommendationsEnabled ?? current.recommendationsEnabled };
      mockProfiles.set(mockDemoUser.id, updated);
      return Response.json(updated);
    }
    if (url.pathname === "/api/profile") {
      return Response.json(profileFor(mockDemoUser.id));
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
    if (url.pathname === "/api/calendar") {
      const entries = calendarEntries(mockDemoUser.id);
      const now = Date.now();
      const byStartAsc = (a: (typeof entries)[number], b: (typeof entries)[number]) => a.event.startsAt.localeCompare(b.event.startsAt);
      return Response.json({
        upcoming: entries.filter((entry) => new Date(entry.event.startsAt).getTime() >= now).sort(byStartAsc),
        past: entries.filter((entry) => new Date(entry.event.startsAt).getTime() < now).sort((a, b) => -byStartAsc(a, b)),
      });
    }
    if (url.pathname === "/api/check-ins" && init?.method === "POST") {
      const payload = parseBookingBody(init) as { userId?: string; eventId?: string; placeId?: string } | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string") return new Response(null, { status: 400 });
      const result = createMockCheckIn(payload.userId, { eventId: payload.eventId, placeId: payload.placeId });
      return result === "invalid" ? new Response(null, { status: 400 }) : result === "no_target" ? new Response(null, { status: 404 }) : Response.json(result);
    }
    const visitStats = /^\/api\/users\/([^/]+)\/visit-stats$/.exec(url.pathname);
    if (visitStats) {
      return Response.json(visitStatsFor(visitStats[1]));
    }
    const achievements = /^\/api\/users\/([^/]+)\/achievements$/.exec(url.pathname);
    if (achievements) {
      return Response.json(achievementsFor(visitStatsFor(achievements[1])));
    }
    const myCity = /^\/api\/users\/([^/]+)\/my-city$/.exec(url.pathname);
    if (myCity) {
      return Response.json(myCityFor(myCity[1]));
    }
    const cancel = /^\/api\/bookings\/([^/]+)$/.exec(url.pathname);
    if (cancel && init?.method === "DELETE") {
      const booking = mockBookings.find((item) => item.id === cancel[1]);
      if (!booking) return new Response(null, { status: 404 });
      if (booking.status === "cancelled") return Response.json(booking);
      booking.status = "cancelled";
      booking.updatedAt = new Date().toISOString();
      offerNextMockWaitlist(booking.eventId, new Date());
      return Response.json(booking);
    }
    if (url.pathname === "/api/friends/availability") {
      if (!url.searchParams.get("eventId")) return new Response(null, { status: 400 });
      return Response.json(friendAvailability());
    }
    if (url.pathname === "/api/gatherings" && init?.method === "POST") {
      const payload = parseBookingBody(init) as CreateGathering | undefined;
      if (typeof payload !== "object" || payload === null || !Array.isArray(payload.friendIds)) return new Response(null, { status: 400 });
      if (!mockEvents.some((item) => item.id === payload.eventId)) return new Response(null, { status: 404 });
      const gathering = createMockGathering(payload);
      return gathering ? Response.json(gathering) : new Response(null, { status: 400 });
    }
    const gathering = /^\/api\/gatherings\/([^/]+)$/.exec(url.pathname);
    if (gathering) {
      const found = mockGatherings.get(gathering[1]);
      return found ? Response.json(found) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/api/plans/auto" && init?.method === "POST") {
      const parsed = CreateAutoPlanWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const proposal = createMockAutoPlan(parsed.data);
      return proposal === "no_event" ? new Response(null, { status: 404 }) : Response.json(proposal);
    }
    if (url.pathname === "/api/routes" && init?.method === "POST") {
      const parsed = CreateDayRouteWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const route = buildMockDayRoute(parsed.data);
      if (route === "no_event" || route === "no_place") return new Response(null, { status: 404 });
      if (route === "event_without_place") return new Response(null, { status: 400 });
      return Response.json(route);
    }
    if (url.pathname === "/api/routes/optimize" && init?.method === "POST") {
      const parsed = CreateDayRouteWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = optimizeMockDayRoute(parsed.data);
      if (result === "no_event" || result === "no_place") return new Response(null, { status: 404 });
      if (result === "event_without_place") return new Response(null, { status: 400 });
      return Response.json(result);
    }
    if (url.pathname === "/api/plans") {
      return Response.json(planCards());
    }
    const plan = /^\/api\/plans\/([^/]+)$/.exec(url.pathname);
    if (plan) {
      const found = planCard(plan[1]);
      return found ? Response.json(found) : new Response(null, { status: 404 });
    }
    const listById = /^\/api\/lists\/([^/]+)$/.exec(url.pathname);
    if (listById) {
      const screen = listScreen(listById[1]);
      return screen ? Response.json(screen) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/api/lists") {
      return Response.json(listSummaries(url.searchParams.get("userId") ?? "", url.searchParams.get("eventId")));
    }
    const listItems = /^\/api\/lists\/([^/]+)\/items$/.exec(url.pathname);
    if (listItems && init?.method === "POST") {
      const payload = parseBookingBody(init) as AddListItem | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "" || typeof payload.eventId !== "string") return new Response(null, { status: 400 });
      const result = addMockListItem(listItems[1], payload);
      return result === "no_list" || result === "no_event" ? new Response(null, { status: 404 }) : Response.json(result);
    }
    if (listItems) {
      const cards = listItemCards(listItems[1]);
      return cards ? Response.json(cards) : new Response(null, { status: 404 });
    }
    const listItemRemove = /^\/api\/lists\/([^/]+)\/items\/([^/]+)$/.exec(url.pathname);
    if (listItemRemove && init?.method === "DELETE") {
      const removed = removeMockListItem(listItemRemove[1], listItemRemove[2]);
      return removed ? Response.json(removed) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/api/reviews" && init?.method === "POST") {
      const payload = parseBookingBody(init) as CreateReview | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || typeof payload.eventId !== "string" || typeof payload.stars !== "number" || typeof payload.wouldGoAgain !== "boolean") return new Response(null, { status: 400 });
      const result = createMockReview(payload);
      return result === "no_event" ? new Response(null, { status: 404 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
    }
    if (url.pathname === "/api/reports" && init?.method === "POST") {
      const payload = parseBookingBody(init) as CreateReport | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || typeof payload.eventId !== "string" || typeof payload.reason !== "string") return new Response(null, { status: 400 });
      const result = createMockReport(payload as CreateReport);
      return result === "no_target" ? new Response(null, { status: 404 }) : result === "invalid" ? new Response(null, { status: 400 }) : result === "duplicate" ? new Response(null, { status: 409 }) : Response.json(result);
    }
    if (url.pathname === "/api/micro-events" && init?.method === "POST") {
      const payload = parseBookingBody(init) as CreateMicroEvent | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || typeof payload.title !== "string" || typeof payload.startsAt !== "string" || typeof payload.participantsLimit !== "number") return new Response(null, { status: 400 });
      const result = createMockMicroEvent(payload);
      return result === "no_place" ? new Response(null, { status: 404 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
    }
    if (url.pathname === "/api/micro-events") {
      return Response.json(microEvents());
    }
    const microJoin = /^\/api\/micro-events\/([^/]+)\/join$/.exec(url.pathname);
    if (microJoin && init?.method === "POST") {
      const userId = url.searchParams.get("userId") ?? "";
      if (userId === "") return new Response(null, { status: 400 });
      const result = joinMockMicroEvent(microJoin[1], userId);
      return result === null ? new Response(null, { status: 404 }) : result === "full" || result === "closed" ? new Response(null, { status: 409 }) : Response.json(result);
    }
    if (microJoin && init?.method === "DELETE") {
      const userId = url.searchParams.get("userId") ?? "";
      if (userId === "") return new Response(null, { status: 400 });
      const result = leaveMockMicroEvent(microJoin[1], userId);
      return result === null ? new Response(null, { status: 404 }) : Response.json(result);
    }
    if (url.pathname === "/api/feed" && init?.method === "POST") {
      const payload = parseBookingBody(init) as CreateFeedPost | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "" || typeof payload.eventId !== "string" || typeof payload.text !== "string" || payload.text.trim() === "") return new Response(null, { status: 400 });
      const post = createMockFeedPost(payload);
      return post ? Response.json(post) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/api/feed") {
      return Response.json(feedPosts(url.searchParams.get("eventId")));
    }
    const feedLike = /^\/api\/feed\/([^/]+)\/like$/.exec(url.pathname);
    if (feedLike && init?.method === "POST") {
      const userId = url.searchParams.get("userId") ?? "";
      if (userId === "") return new Response(null, { status: 400 });
      const post = toggleMockFeedLike(feedLike[1], userId);
      return post ? Response.json(post) : new Response(null, { status: 404 });
    }
    const feedComment = /^\/api\/feed\/([^/]+)\/comments$/.exec(url.pathname);
    if (feedComment && init?.method === "POST") {
      const payload = parseBookingBody(init) as { userId?: string; text?: string } | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "" || typeof payload.text !== "string" || payload.text.trim() === "") return new Response(null, { status: 400 });
      const post = addMockFeedComment(feedComment[1], { userId: payload.userId, text: payload.text });
      return post ? Response.json(post) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/api/waitlist" && init?.method === "POST") {
      const userId = url.searchParams.get("userId") ?? "";
      const payload = parseBookingBody(init) as { eventId?: string } | undefined;
      if (userId === "" || typeof payload !== "object" || payload === null || typeof payload.eventId !== "string") return new Response(null, { status: 400 });
      const result = joinMockWaitlist(payload.eventId, userId);
      return result === "no_event" ? new Response(null, { status: 404 }) : typeof result === "string" ? new Response(null, { status: 409 }) : Response.json(result);
    }
    if (url.pathname === "/api/waitlist/me") {
      const eventId = url.searchParams.get("eventId") ?? "";
      const userId = url.searchParams.get("userId") ?? "";
      if (eventId === "" || userId === "") return new Response(null, { status: 400 });
      const entry = myMockWaitlistEntry(eventId, userId);
      return entry ? Response.json(entry) : new Response(null, { status: 404 });
    }
    const waitlistAction = /^\/api\/waitlist\/([^/]+)\/(confirm|decline)$/.exec(url.pathname);
    if (waitlistAction && init?.method === "POST") {
      if (waitlistAction[2] === "confirm") {
        const result = confirmMockWaitlistOffer(waitlistAction[1]);
        return result === null ? new Response(null, { status: 404 }) : typeof result === "string" ? new Response(null, { status: 409 }) : Response.json(result);
      }
      const result = declineMockWaitlistOffer(waitlistAction[1]);
      return result === null ? new Response(null, { status: 404 }) : typeof result === "string" ? new Response(null, { status: 409 }) : Response.json(result);
    }
    if (url.pathname === "/api/assist/day" && init?.method === "POST") {
      const parsed = AssistQueryWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = mockAssistDay(parsed.data);
      return result === "rate_limited" ? new Response(null, { status: 429 }) : result === "invalid" || result === "no_events" ? new Response(null, { status: 400 }) : Response.json(result);
    }
    if (url.pathname === "/api/assist" && init?.method === "POST") {
      const parsed = AssistQueryWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = mockAssistSuggest(parsed.data);
      return result === "rate_limited" ? new Response(null, { status: 429 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
    }
    return real(input, init);
  };
  return () => {
    globalThis.fetch = real;
  };
}
