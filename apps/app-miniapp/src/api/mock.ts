// START_MODULE_CONTRACT
// PURPOSE: Mock API layer for the catalog, event page, profile, calendar, friends feed, shared plans, check-ins, achievements, my-city, post-event reviews, reports and UGC micro-events while backend endpoints (M2–M5, P2) do not exist yet.
// SCOPE: In-memory Moscow fixtures (events/places/organizers, incl. two past events with a seeded demo booking for the review flow), in-memory bookings, check-ins, profiles, plan cards, preset lists, seeded reviews with rating aggregates and deduplicated reports, open micro-events with join/leave counters, achievements and my-city derived from check-ins, pure fixture filtering, fetch interceptor enabled by VITE_USE_MOCK=1 in main.tsx.
// DEPENDS: ./client.js (parseEventFilters, EventFilters, CreateGathering, AddListItem, ListSummary, ListItemCard, CreateMicroEvent, CreateReview, CreateReport, Report, EventRating), @max-events/api-contracts (Event, Place, User, Booking, Profile, PlanCard, List, ListItem, CheckIn, VisitStats, Achievement, MyCitySummary, MemoryPoint, MicroEvent, Review, CreateBookingSchema, MicroEventSchema, ReviewSchema, UpdateProfileSchema)
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockPlaces - 4 Moscow venue fixtures
// - mockEvents - Moscow event fixtures (all four categories, paid and free, incl. two past events for the review flow)
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
// - planCards - plan fixtures sorted by the soonest meeting first
// - planCard - single plan card by plan id (or null)
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
// - resetMockCheckIns - clear in-memory check-ins (test isolation)
// - resetMockProfiles - clear in-memory profiles (test isolation)
// - resetMockParticipations - restore seeded participations (test isolation)
// - checkInFor - check-in of a user for an event, or null (mock state for the event page button)
// - createMockCheckIn - in-memory check-in for an event or a place, idempotent (mock POST)
// - visitStatsFor - visit statistics derived from the check-ins of a user
// - achievementsFor - the four README achievements with progress derived from visit stats
// - myCityFor - my-city summary and memory points derived from the check-ins of a user
// - participationStats - per-event status counters, friends count and own status
// - calendarEntries - active bookings of a user enriched with event and place
// - todayPicks - "What to do today?" digest from fixtures (summary counters + three curated cards)
// - installMockApi - intercept global fetch for /api/events, /api/places, /api/events/:id/rating, /api/events/:id/participation, /api/bookings, /api/check-ins, /api/users/:id/visit-stats, /api/users/:id/achievements, /api/users/:id/my-city, /api/users/:id/profile, /api/friends/activity, /api/friends/availability, /api/gatherings, /api/plans, /api/lists[/:id[/items[/:itemId]]], /api/feed[/:id/like|comments], /api/reviews, /api/reports, /api/micro-events and /api/today, return a restore function
// END_MODULE_MAP

import type { Achievement, Booking, CheckIn, Event, Friend, FriendActivityByFriend, FriendAvailability, Gathering, InviteeResponse, List, ListItem, ListPreset, MemoryPoint, MicroEvent, MyCitySummary, Participation, ParticipationStatus, Place, PlanCard, Profile, Review, TodayEventCard, TodayResponse, User, VisitStats } from "@max-events/api-contracts";
import { CreateBookingSchema, DEFAULT_SMART_ALERTS, EventCategorySchema, ListPresetSchema, MicroEventSchema, ParticipationStatusSchema, ReviewSchema, TimestampSchema, UpdateProfileSchema } from "@max-events/api-contracts";
import { parseEventFilters, REPORT_REASONS, type AddListItem, type CreateFeedPost, type CreateGathering, type CreateMicroEvent, type CreateReport, type CreateReview, type EventFilters, type EventRating, type FeedComment, type FeedPost, type ListItemCard, type ListSummary, type ParticipationStats, type Report } from "./client";

const PLACE_STAMP = "2026-08-01T12:00:00+03:00";

function place(input: Omit<Place, "createdAt" | "updatedAt">): Place {
  return { ...input, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };
}

export const mockPlaces: Place[] = [place({ id: "b0000001-0000-4000-8000-000000000001", title: "Парк Горького", address: "Крымский Вал, 9", city: "Москва", category: "park", latitude: 55.7298, longitude: 37.6019 }), place({ id: "b0000002-0000-4000-8000-000000000002", title: "ГМИИ им. А. С. Пушкина", address: "ул. Волхонка, 12", city: "Москва", category: "museum", latitude: 55.7447, longitude: 37.6055 }), place({ id: "b0000003-0000-4000-8000-000000000003", title: "«Лужники»", address: "Лужнецкая набережная, 24", city: "Москва", category: "sport", latitude: 55.7158, longitude: 37.5543 }), place({ id: "b0000004-0000-4000-8000-000000000004", title: "Депо. Москва", address: "Тверская Застава, 1", city: "Москва", category: "food", latitude: 55.7758, longitude: 37.5936 })];

type EventInput = Pick<Event, "id" | "title" | "category" | "city" | "startsAt" | "isPaid" | "priceRub"> & Partial<Event>;

function event(input: EventInput): Event {
  return { description: "", placeId: null, endsAt: null, paymentUrl: null, capacity: null, chatLink: null, ...input };
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

/** Seeded friend reviews for the showcase event so the page shows an aggregate out of the box. */
const MOCK_REVIEW_SEED: ReviewSeed[] = [
  { friend: 0, event: 0, stars: 5, categoryScores: { atmosphere: 5, organization: 5, price: 4, place: 5 }, wouldGoAgain: true, text: "Атмосфера замечательная, обязательно приду снова!" },
  { friend: 1, event: 0, stars: 4, categoryScores: { atmosphere: 4, organization: 5, price: 3, place: 4 }, wouldGoAgain: true },
  { friend: 2, event: 0, stars: 5, categoryScores: { atmosphere: 5, organization: 4 }, wouldGoAgain: false, text: "Всё понравилось, но пришлось долго искать вход." },
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
  if (mockReports.some((item) => item.userId === payload.userId && item.eventId === payload.eventId)) return "duplicate";
  mockReportSeq += 1;
  const report: Report = { id: `81000000-0000-4000-8000-${String(mockReportSeq).padStart(12, "0")}`, userId: payload.userId, eventId: payload.eventId, reason: payload.reason, createdAt: new Date().toISOString() };
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

const mockProfiles = new Map<string, Profile>();

export function resetMockProfiles(): void {
  mockProfiles.clear();
}

function profileFor(userId: string): Profile {
  return mockProfiles.get(userId) ?? { userId, city: "Москва", interests: [], smartAlerts: { ...DEFAULT_SMART_ALERTS } };
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

export function installMockApi(): () => void {
  const real = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (input instanceof Request) return real(input, init);
    const url = new URL(input, "http://mock.local");
    if (url.pathname === "/api/friends/activity") {
      return Response.json(friendActivityByFriend());
    }
    if (url.pathname === "/api/today") {
      return Response.json(todayPicks());
    }
    if (url.pathname === "/api/places") {
      return Response.json(mockPlaces);
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
    const profile = /^\/api\/users\/([^/]+)\/profile$/.exec(url.pathname);
    if (profile && init?.method === "PATCH") {
      const parsed = UpdateProfileSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const current = profileFor(profile[1]);
      const updated: Profile = { ...current, ...parsed.data, smartAlerts: { ...current.smartAlerts, ...parsed.data.smartAlerts } };
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
      booking.status = "cancelled";
      booking.updatedAt = new Date().toISOString();
      return Response.json(booking);
    }
    if (url.pathname === "/api/friends/availability") {
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
    return real(input, init);
  };
  return () => {
    globalThis.fetch = real;
  };
}
