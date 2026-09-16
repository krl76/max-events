// START_MODULE_CONTRACT
// PURPOSE: Mock API layer for the catalog, event page, profile, calendar, friends feed and shared plans while backend endpoints (M2/M3/M4/M5) do not exist yet.
// SCOPE: In-memory Moscow fixtures (events/places/organizers), in-memory bookings, profiles and plan cards, pure fixture filtering, fetch interceptor enabled by VITE_USE_MOCK=1 in main.tsx.
// DEPENDS: ./client.js (parseEventFilters, EventFilters), @max-events/api-contracts (Event, Place, User, Booking, Profile, PlanCard, CreateBookingSchema, UpdateProfileSchema)
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockPlaces - 4 Moscow venue fixtures
// - mockEvents - 11 Moscow event fixtures (all four categories, paid and free)
// - mockOrganizers - demo organizer fixture for event details
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
// - resetMockBookings - clear in-memory bookings (test isolation)
// - resetMockProfiles - clear in-memory profiles (test isolation)
// - resetMockParticipations - restore seeded participations (test isolation)
// - participationStats - per-event status counters, friends count and own status
// - calendarEntries - active bookings of a user enriched with event and place
// - todayPicks - "What to do today?" digest from fixtures (summary counters + three curated cards)
// - installMockApi - intercept global fetch for /api/events, /api/places, /api/events/:id/participation, /api/bookings, /api/users/:id/profile, /api/friends/activity, /api/friends/availability, /api/gatherings, /api/plans and /api/today, return a restore function
// END_MODULE_MAP

import type { Booking, Event, Friend, FriendActivityByFriend, FriendAvailability, Gathering, InviteeResponse, Participation, ParticipationStatus, Place, PlanCard, Profile, TodayEventCard, TodayResponse, User } from "@max-events/api-contracts";
import { CreateBookingSchema, ParticipationStatusSchema, TimestampSchema, UpdateProfileSchema } from "@max-events/api-contracts";
import { parseEventFilters, type CreateGathering, type EventFilters, type ParticipationStats } from "./client";

const PLACE_STAMP = "2026-08-01T12:00:00+03:00";

function place(input: Omit<Place, "createdAt" | "updatedAt">): Place {
  return { ...input, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };
}

export const mockPlaces: Place[] = [place({ id: "b0000001-0000-4000-8000-000000000001", title: "Парк Горького", address: "Крымский Вал, 9", city: "Москва", category: "park", latitude: 55.7298, longitude: 37.6019 }), place({ id: "b0000002-0000-4000-8000-000000000002", title: "ГМИИ им. А. С. Пушкина", address: "ул. Волхонка, 12", city: "Москва", category: "museum", latitude: 55.7447, longitude: 37.6055 }), place({ id: "b0000003-0000-4000-8000-000000000003", title: "«Лужники»", address: "Лужнецкая набережная, 24", city: "Москва", category: "sport", latitude: 55.7158, longitude: 37.5543 }), place({ id: "b0000004-0000-4000-8000-000000000004", title: "Депо. Москва", address: "Тверская Застава, 1", city: "Москва", category: "food", latitude: 55.7758, longitude: 37.5936 })];

type EventInput = Pick<Event, "id" | "title" | "category" | "city" | "startsAt" | "isPaid" | "priceRub"> & Partial<Event>;

function event(input: EventInput): Event {
  return { description: "", placeId: null, endsAt: null, paymentUrl: null, capacity: null, ...input };
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

export function resetMockBookings(): void {
  mockBookings.length = 0;
  mockBookingSeq = 0;
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
  return mockProfiles.get(userId) ?? { userId, city: "Москва", interests: [] };
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
      const updated: Profile = { ...profileFor(profile[1]), ...parsed.data };
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
    return real(input, init);
  };
  return () => {
    globalThis.fetch = real;
  };
}
