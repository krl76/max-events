// START_MODULE_CONTRACT
// PURPOSE: Mock social graph store: friends, the gathering flow, UGC micro-events, reverse discovery and people matching.
// SCOPE: Friend availability, the contacts sync stamp and gatherings, micro-events with their join counters and card aggregate, friend place discovery with the hidden-history state and the people matcher; the HTTP surface is in ./social.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - friendAvailability - per-friend free/busy/unknown for the gathering flow (mock)
// - friendsSyncState - mock GET /friends/sync: when the MAX contacts were last pulled in (макет, экран 26)
// - syncMockFriends - mock POST /friends/sync: re-read the contacts, stamp the moment, answer with the graph
// - resetMockFriendsSync - restore the «two hours ago» stamp (test isolation)
// - microEventCard - mock GET /micro-events/:id: the event, its venue and the participants by name (макет, экран 25)
// - mockOnboardingContacts - the twelve MAX contacts the onboarding friends step offers: the seven friend fixtures plus five contacts who are not friends yet
// - resetMockFollows - restore the three seeded follows (test isolation)
// - friendSuggestions - mock GET /friends/suggestions: the onboarding contacts with their hint line and current follow state
// - followMockFriends - mock PUT /friends/follows: replace the followed set, "unknown" when an id is not a contact
// - listMockFriends - GET /friends: seeded friends plus people added in this session
// - addMockFriend - mock POST /friends/:id: both lists, both follows
// - removeMockFriend - mock DELETE /friends/:id
// - resetMockAddedFriends - drop in-session adds (test isolation)
// - followingOf - mock GET /users/:id/following: the people the viewer follows, in contact order
// - withContactNick - copy a contact with the demo nick used by the close-friends sheet
// - followersOf - mock GET /users/:id/followers: the people following the viewer; the backend keeps no reverse direction at all
// - mockGatherings - shared with social.routes
// - MOCK_GATHERING_ID - seeded deep-link demo gathering (hosted by a friend; the demo user is an invitee so the response flow is reachable in mock mode)
// - resetMockGatherings - restore the seeded demo gathering and clear created ones (test isolation)
// - createMockGathering - in-memory gathering with deterministic invitee responses and a sent chat card (chatLink set, successful MaxBot parity) (mock POST)
// - respondMockGathering - demo-user invitee answer write (mock PATCH /gatherings/:id/response; 404 unknown, 403 host-or-outsider, backend respond parity)
// - mockMicroEvents - shared with moderation
// - seedMockMicroEvents - shared with moderation
// - resetMockMicroEvents - restore seeded micro-events (test isolation)
// - microEvents - open micro-events soonest first
// - createMockMicroEvent - create a micro event, author counts as the first participant (mock POST)
// - joinMockMicroEvent - join with the counter, idempotent (mock POST /join)
// - leaveMockMicroEvent - leave with the counter, idempotent (mock DELETE /join)
// - friendActivityByFriend - friend participations grouped by friend (feed payload)
// - setMockCloseAuthor - record that an author marked the demo viewer as a close friend (test isolation)
// - resetMockCloseAuthors - clear those marks (test isolation)
// - friendPlaceLayer - mock GET /discovery/friend-places: places friends checked in at, grouped, privacy-gated
// - discoverySummary - per-friend unseen places minus the demo user's check-ins, privacy-gated, with the hidden-history rows экран 27 draws (mock GET /discovery, backend DiscoveryService.summary parity)
// - friendRoute - chronological unseen places of one friend with the clock and the note of экран 28; own/not-friend/hidden map to 403/404/403 (mock GET /discovery/friends/:userId/route, backend parity)
// - peopleSuggest - mockFriends matched on seeded interests or a shared upcoming event with distances from the requested coords (mock GET /people, backend PeopleService parity)
// END_MODULE_MAP

import { MicroEventSchema, TimestampSchema } from "@max-events/api-contracts";
import type { CreatePlanExpenseWrite, Friend, FriendActivityByFriend, FriendAvailability, FriendPlaceVisit, Gathering, InviteeResponse, MicroBudget, MicroEvent, ParticipationStatus, PeopleCandidate, PeopleMatchContext, PeopleResponse, Place, PlaceCategory } from "@max-events/api-contracts";
import { type CreateGathering, type CreateMicroEvent, type DiscoveryFriendCard, type DiscoveryScreen, type FriendSuggestion, type MicroEventCard, type MicroParticipant } from "../client";
import { mockCheckIns } from "./bookings";
import { mockParticipations } from "./catalog";
import { HOUR_MS, MOCK_NOW, PLACE_STAMP, haversineKm, mockDemoUser, mockEvents, mockFriendIds, mockFriends, mockPlaces } from "./fixtures";
import { mockBudgetFromExpenses } from "./plans";
import { profileFor } from "./profile";

/** Authors who put the demo viewer on their close-friends list. `routes: "close"` is visible only to them. */
const mockCloseAuthorsOfViewer = new Set<string>();

export function setMockCloseAuthor(authorId: string, close: boolean): void {
  if (close) mockCloseAuthorsOfViewer.add(authorId);
  else mockCloseAuthorsOfViewer.delete(authorId);
}

export function resetMockCloseAuthors(): void {
  mockCloseAuthorsOfViewer.clear();
}

function routesOpenForViewer(authorId: string): boolean {
  const mode = profileFor(authorId).privacy.routes;
  if (mode === "hidden") return false;
  if (mode === "close") return mockCloseAuthorsOfViewer.has(authorId);
  return true;
}

/** Mock availability per friend (by mockFriends index); the backend P1-6-b does not exist yet. */
const MOCK_AVAILABILITY: FriendAvailability["availability"][] = ["free", "busy", "unknown", "free", "free", "busy", "unknown"];

export function friendAvailability(): FriendAvailability[] {
  return mockFriends.map((friend, index) => ({ friend, availability: MOCK_AVAILABILITY[index] }));
}

/**
 * POST /friends/sync rebuilds the graph from the MAX contact list and answers with it, but nothing
 * anywhere records *when* it last ran — and экран 26 puts «Синхронизировано 2 часа назад» right under
 * the contacts row. The stamp is counted off the real clock rather than MOCK_NOW so the demo reads the
 * way the design does whenever it is opened.
 */
let mockFriendsSyncedAt: string = new Date(Date.now() - 2 * HOUR_MS).toISOString();

export function resetMockFriendsSync(): void {
  mockFriendsSyncedAt = new Date(Date.now() - 2 * HOUR_MS).toISOString();
}

export function friendsSyncState(): { syncedAt: string | null } {
  return { syncedAt: mockFriendsSyncedAt };
}

export function syncMockFriends(): Friend[] {
  mockFriendsSyncedAt = new Date().toISOString();
  return mockFriends;
}

/**
 * The onboarding friends step (макет, экран 02) shows twelve «контактов из чатов MAX»: the seven friend
 * fixtures plus five people the demo user shares chats with but has not added yet. They live here rather
 * than in ./fixtures.ts because only this screen knows them — mockFriends stays the friends list.
 */
export const mockOnboardingContacts: readonly Friend[] = [...mockFriends, { id: "a0000000-0000-4000-8000-0000000000b8", name: "Марина Ким", avatarUrl: null }, { id: "a0000000-0000-4000-8000-0000000000b9", name: "Олег Савин", avatarUrl: null }, { id: "a0000000-0000-4000-8000-0000000000ba", name: "Сергей Ильин", avatarUrl: null }, { id: "a0000000-0000-4000-8000-0000000000bb", name: "Юля Крылова", avatarUrl: null }, { id: "a0000000-0000-4000-8000-0000000000bc", name: "Максим Зотов", avatarUrl: null }];

/** Nicks parallel to mockOnboardingContacts. Kept off the shared friend fixtures so story mentions stay on the first name. */
const MOCK_CONTACT_NICKS: readonly string[] = ["anna_s", "dima_k", "katya", "petr", "maria_b", "igor", "lena_g", "marina", "oleg", "sergey", "yulia", "maxim"];

export function withContactNick(person: Friend): Friend {
  const index = mockOnboardingContacts.findIndex((contact) => contact.id === person.id);
  const username = index < 0 ? undefined : MOCK_CONTACT_NICKS[index];
  return username === undefined ? person : { ...person, username };
}

/** The макет hint under each name; the backend has nothing to compute it from, so it is fixture text by position. */
const MOCK_CONTACT_HINTS: readonly string[] = ["12 общих планов", "8 общих чатов", "была на джазе", "играет в падел", "5 общих планов", "из чата «Двор»", "ходит на лекции", "из чата «Падел»", "3 общих плана", "из чата «Работа»", "волонтёрит", "из чата «Дача»"];

/** The макет opens the step with three people already followed, so the CTA reads «Подписаться на 3 и продолжить». */
const MOCK_SEEDED_FOLLOWS: readonly string[] = mockOnboardingContacts.slice(0, 3).map((contact) => contact.id);

let mockFollowedIds = new Set<string>(MOCK_SEEDED_FOLLOWS);

let mockAddedFriends: Friend[] = [];

export function resetMockAddedFriends(): void {
  mockAddedFriends = [];
}

export function resetMockFollows(): void {
  mockFollowedIds = new Set<string>(MOCK_SEEDED_FOLLOWS);
  resetMockAddedFriends();
}

export function listMockFriends(): Friend[] {
  const have = new Set(mockFriends.map((friend) => friend.id));
  return [...mockFriends, ...mockAddedFriends.filter((friend) => !have.has(friend.id))];
}

export function addMockFriend(userId: string): Friend[] | "unknown" | "self" {
  if (userId === mockDemoUser.id) return "self";
  const person = mockOnboardingContacts.find((contact) => contact.id === userId);
  if (person === undefined) return "unknown";
  if (!mockFriends.some((friend) => friend.id === userId) && !mockAddedFriends.some((friend) => friend.id === userId)) mockAddedFriends.push(person);
  mockFollowedIds.add(userId);
  return listMockFriends();
}

export function removeMockFriend(userId: string): Friend[] | "unknown" | "self" {
  if (userId === mockDemoUser.id) return "self";
  const known = mockOnboardingContacts.some((contact) => contact.id === userId) || mockFriends.some((friend) => friend.id === userId);
  if (!known) return "unknown";
  mockAddedFriends = mockAddedFriends.filter((friend) => friend.id !== userId);
  mockFollowedIds.delete(userId);
  return listMockFriends();
}

export function friendSuggestions(): FriendSuggestion[] {
  return mockOnboardingContacts.map((friend, index) => ({ friend, hint: MOCK_CONTACT_HINTS[index] ?? null, followed: mockFollowedIds.has(friend.id) }));
}

/** Replacing the whole set rather than toggling: the onboarding screen owns its selection until the viewer confirms it. */
export function followMockFriends(userIds: string[]): string[] | "unknown" {
  if (!userIds.every((id) => mockOnboardingContacts.some((contact) => contact.id === id))) return "unknown";
  mockFollowedIds = new Set<string>(userIds);
  return mockOnboardingContacts.filter((contact) => mockFollowedIds.has(contact.id)).map((contact) => contact.id);
}

/** The people the viewer follows, in contact order — the «подписки» half of the profile counters. */
export function followingOf(userId: string): Friend[] {
  if (userId === mockDemoUser.id) return mockOnboardingContacts.filter((contact) => mockFollowedIds.has(contact.id));
  return mockFriends.filter((person) => person.id !== userId).slice(0, 4);
}

/**
 * Who follows the viewer. Nothing on the backend answers this: `subscriptions` knows organizer, place
 * and interest (#501), and the follow set of экран 02 is stored one-way, so the reverse direction has
 * no table to be read out of. Seeded by contact position rather than derived, because deriving it from
 * a one-way set would always produce the empty answer — and a counter stuck on zero reads as «никто»
 * instead of «мы этого пока не считаем».
 */
const MOCK_FOLLOWER_POSITIONS: readonly number[] = [0, 1, 3, 4, 6, 7, 9, 11];

export function followersOf(userId: string): Friend[] {
  if (userId === mockDemoUser.id) return MOCK_FOLLOWER_POSITIONS.flatMap((index) => (mockOnboardingContacts[index] === undefined ? [] : [withContactNick(mockOnboardingContacts[index])]));
  return mockFriends.filter((person) => person.id !== userId).slice(2, 6);
}

/** Deterministic invitee answer per friend (by mockFriends index): Дима accepted, Катя considering, Андрей-like busy mix. */
const MOCK_INVITEE_RESPONSE: InviteeResponse[] = ["accepted", "accepted", "considering", "busy", "accepted", "considering", "busy"];

export const mockGatherings = new Map<string, Gathering>();

let mockGatheringSeq = 0;

/** Seeded deep-link demo gathering (gathering-<id>): the demo user is an invitee awaiting their answer; the host stays outside the invitee list like on the backend. */
export const MOCK_GATHERING_ID = "d0000000-0000-4000-8000-0000000000a1";

function seedMockGatherings(): void {
  mockGatherings.clear();
  mockGatheringSeq = 0;
  mockGatherings.set(MOCK_GATHERING_ID, {
    id: MOCK_GATHERING_ID,
    event: mockEvents[0],
    invitees: [
      { friend: { id: mockDemoUser.id, name: mockDemoUser.firstName, avatarUrl: null }, response: "considering" },
      { friend: mockFriends[1], response: "accepted" },
      { friend: mockFriends[2], response: "considering" },
    ],
    proposedMeetingAt: "2026-09-19T16:00:00.000Z",
    status: "awaiting_responses",
    chatLink: "https://max.ru/chat/mock-gathering-demo",
    createdAt: PLACE_STAMP,
    updatedAt: PLACE_STAMP,
  });
}

seedMockGatherings();

export function resetMockGatherings(): void {
  seedMockGatherings();
}

/** Creates an in-memory gathering: known event, known friends, valid proposed time, deterministic per-fixture responses. */
export function createMockGathering(payload: CreateGathering): Gathering | null {
  const event = mockEvents.find((item) => item.id === payload.eventId);
  if (!event || !payload.friendIds.every((id) => mockFriendIds.includes(id))) return null;
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
    chatLink: `https://max.ru/chat/mock-gathering-${mockGatheringSeq}`,
    createdAt: now,
    updatedAt: now,
  };
  mockGatherings.set(gathering.id, gathering);
  return gathering;
}

/** Demo-user invitee answer (backend GatheringsService.respond parity): unknown -> "unknown", host or outsider -> "forbidden". */
export function respondMockGathering(id: string, response: InviteeResponse): Gathering | "unknown" | "forbidden" {
  const gathering = mockGatherings.get(id);
  if (!gathering) return "unknown";
  const invitee = gathering.invitees.find((item) => item.friend.id === mockDemoUser.id);
  if (!invitee) return "forbidden";
  invitee.response = response;
  gathering.updatedAt = new Date().toISOString();
  return gathering;
}

type MicroEventSeed = Omit<MicroEvent, "createdAt" | "participants">;

/** Backend parity: the participants the friend graph can name; ids it cannot resolve stay counted but unnamed. */
function mockMicroParticipants(ids: string[]): Friend[] {
  return ids.flatMap((id) => {
    const friend = mockFriends.find((candidate) => candidate.id === id);
    return friend ? [friend] : [];
  });
}

const MICRO_EVENT_SEED: MicroEventSeed[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    authorId: mockFriendIds[0],
    title: "Играем в баскетбол",
    startsAt: "2026-09-19T19:00:00+03:00",
    locationText: "Стритбол-площадка у Парка Горького",
    placeId: null,
    participantsLimit: 6,
    participantsCount: 3,
    participantIds: [mockFriendIds[0], mockFriendIds[1], mockFriendIds[2]],
    status: "open",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    authorId: mockFriendIds[1],
    title: "Прогулка по Парку Горького",
    startsAt: "2026-09-20T14:00:00+03:00",
    locationText: null,
    placeId: mockPlaces[0].id,
    participantsLimit: 4,
    participantsCount: 2,
    participantIds: [mockFriendIds[1], mockFriendIds[3]],
    status: "open",
  },
  // Экран 24 показывает четыре состояния карточки, а не одно: заполненный сбор даёт «Мест нет»…
  {
    id: "20000000-0000-4000-8000-000000000003",
    authorId: mockFriendIds[2],
    title: "Кто со мной на каток",
    startsAt: "2026-09-19T21:00:00+03:00",
    locationText: "Каток в Парке Горького",
    placeId: null,
    participantsLimit: 6,
    participantsCount: 6,
    participantIds: mockFriendIds.slice(0, 6),
    status: "open",
  },
  // …а отменённый — «Сбор отменён автором» на карточке 25 (в ленту он не попадает, она открытые фильтрует).
  {
    id: "20000000-0000-4000-8000-000000000004",
    authorId: mockFriendIds[4],
    title: "Смотрим матч, у меня дома",
    startsAt: "2026-09-19T22:00:00+03:00",
    locationText: "Чистые пруды, адрес в чате",
    placeId: null,
    participantsLimit: 10,
    participantsCount: 4,
    participantIds: mockFriendIds.slice(0, 4),
    status: "cancelled",
  },
];

export const mockMicroEvents: MicroEvent[] = [];

const mockMicroMemberships = new Set<string>();

type MockMicroExpense = { id: string; microEventId: string; title: string; amountRub: number; payerUserId: string; shareUserIds: string[]; createdAt: string };

const mockMicroExpenses: MockMicroExpense[] = [];

let mockMicroExpenseSeq = 0;

let mockMicroSeq = 0;

export function seedMockMicroEvents(): void {
  mockMicroEvents.length = 0;
  mockMicroMemberships.clear();
  mockMicroExpenses.length = 0;
  mockMicroExpenseSeq = 0;
  mockMicroSeq = MICRO_EVENT_SEED.length;
  for (const seed of MICRO_EVENT_SEED) {
    mockMicroEvents.push({ ...seed, participantIds: [...seed.participantIds], participants: mockMicroParticipants(seed.participantIds), createdAt: PLACE_STAMP });
    for (const participant of seed.participantIds) mockMicroMemberships.add(`${participant}:${seed.id}`);
  }
}
seedMockMicroEvents();

export function resetMockMicroEvents(): void {
  seedMockMicroEvents();
}

/** Open micro events soonest first. */
export function microEvents(): MicroEvent[] {
  return [...mockMicroEvents].filter((item) => item.status === "open" && item.listed !== false).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
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
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    listed: payload.listed ?? true,
    participantsLimit: payload.participantsLimit ?? null,
    participantsCount: 1,
    participantIds: [payload.userId],
    participants: mockMicroParticipants([payload.userId]),
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
  if (target.participantsLimit !== null && target.participantsCount >= target.participantsLimit) return "full";
  target.participantsCount += 1;
  target.participantIds = [...target.participantIds, userId].sort();
  mockMicroMemberships.add(key);
  return target;
}

/** Leaves a micro event; not-joined is idempotent, an unknown one — null (mock 404). */
export function leaveMockMicroEvent(id: string, userId: string): MicroEvent | null {
  const target = mockMicroEvents.find((item) => item.id === id);
  if (!target) return null;
  if (mockMicroMemberships.delete(`${userId}:${id}`)) {
    target.participantsCount -= 1;
    target.participantIds = target.participantIds.filter((item) => item !== userId);
  }
  return target;
}

function microBudgetOf(event: MicroEvent): MicroBudget {
  const rows = mockMicroExpenses.filter((row) => row.microEventId === event.id);
  const budget = mockBudgetFromExpenses(
    rows.map((row) => ({ ...row, planId: row.microEventId })),
    event.participantIds,
  );
  return {
    ...budget,
    expenses: budget.expenses.map((expense) => ({
      id: expense.id,
      microEventId: expense.planId,
      title: expense.title,
      amountRub: expense.amountRub,
      payerUserId: expense.payerUserId,
      shareUserIds: expense.shareUserIds,
      createdAt: expense.createdAt,
    })),
  };
}

/** Mock GET /micro-events/:id/budget. null = unknown, "forbidden" = the viewer is not in the gathering. */
export function mockMicroEventBudget(id: string, userId: string): MicroBudget | null | "forbidden" {
  const event = mockMicroEvents.find((item) => item.id === id);
  if (!event) return null;
  if (!event.participantIds.includes(userId)) return "forbidden";
  return microBudgetOf(event);
}

/** Mock POST /micro-events/:id/expenses. Same gates as the plan budget, with the author allowed to name any participant as payer. */
export function addMockMicroEventExpense(id: string, userId: string, payload: CreatePlanExpenseWrite): MicroBudget | null | "forbidden" | "invalid" {
  const event = mockMicroEvents.find((item) => item.id === id);
  if (!event) return null;
  if (!event.participantIds.includes(userId)) return "forbidden";
  if (event.authorId !== userId && payload.payerUserId !== userId) return "forbidden";
  const party = new Set(event.participantIds);
  if (!party.has(payload.payerUserId) || payload.shareUserIds.some((item) => !party.has(item))) return "invalid";
  mockMicroExpenseSeq += 1;
  mockMicroExpenses.push({
    id: `97000000-0000-4000-8000-${String(mockMicroExpenseSeq).padStart(12, "0")}`,
    microEventId: id,
    title: payload.title.trim(),
    amountRub: payload.amountRub,
    payerUserId: payload.payerUserId,
    shareUserIds: [...new Set(payload.shareUserIds)],
    createdAt: new Date().toISOString(),
  });
  return microBudgetOf(event);
}

/** Who a participant id belongs to: a friend, the demo viewer, or — for a stranger the graph does not know — a nameless row the counter still counts. */
function mockPerson(userId: string): Friend {
  if (userId === mockDemoUser.id) return { id: mockDemoUser.id, name: mockDemoUser.firstName, avatarUrl: null };
  return mockFriends.find((friend) => friend.id === userId) ?? { id: userId, name: "Участник", avatarUrl: null };
}

/** One micro-event with its venue and the names behind participantIds; the author leads the list, because the card marks them «позвал» (mock GET /micro-events/:id). */
export function microEventCard(id: string): MicroEventCard | null {
  const event = mockMicroEvents.find((item) => item.id === id);
  if (!event) return null;
  const place = event.placeId === null ? null : (mockPlaces.find((item) => item.id === event.placeId) ?? null);
  const participants: MicroParticipant[] = event.participantIds.map((userId) => ({ friend: mockPerson(userId), author: userId === event.authorId }));
  participants.sort((a, b) => Number(b.author) - Number(a.author));
  return { event, place, participants };
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

/**
 * The «друзья были здесь» layer (mock GET /discovery/friend-places): every seeded friend visit, not
 * only the ones the demo user missed, grouped by place. The seed carries no clock, so each visit is
 * dated back from MOCK_NOW in seed order — deterministic, and recent enough to look alive in the demo.
 */
export function friendPlaceLayer(): FriendPlaceVisit[] {
  const byPlace = new Map<string, FriendPlaceVisit>();
  MOCK_DISCOVERY_VISIT_SEED.forEach(([friendIndex, placeIndex], order) => {
    const friend = mockFriends[friendIndex];
    const place = mockPlaces[placeIndex];
    // Backend parity: either privacy switch takes the friend out, an unpublished place is not served.
    if (!friend || !place || place.published === false) return;
    if (visitHistoryHidden(friend.id) || !routesOpenForViewer(friend.id)) return;
    const visitedAt = new Date(MOCK_NOW.getTime() - (MOCK_DISCOVERY_VISIT_SEED.length - order) * 86_400_000).toISOString();
    const entry = byPlace.get(place.id) ?? { place, friends: [], lastVisitAt: visitedAt };
    if (!entry.friends.some((row) => row.id === friend.id)) entry.friends.push(friend);
    if (Date.parse(visitedAt) > Date.parse(entry.lastVisitAt)) entry.lastVisitAt = visitedAt;
    byPlace.set(place.id, entry);
  });
  return [...byPlace.values()].sort((a, b) => Date.parse(b.lastVisitAt) - Date.parse(a.lastVisitAt) || a.place.title.localeCompare(b.place.title));
}

/**
 * Who switched their visit history off. The profile fixtures know only the other switch (Лена hides her
 * routes), and экран 27 has to draw «История посещений скрыта» as a normal row, so the overlay lives here
 * until a profile fixture sets `visitHistory: "hidden"` itself. Read through everywhere the switch matters,
 * so the friend disappears from the route too — a demo where the flag lied on one screen would be worse
 * than no flag at all.
 */
const MOCK_VISIT_HISTORY_HIDDEN: ReadonlySet<string> = new Set([mockFriendIds[3]]);

function visitHistoryHidden(userId: string): boolean {
  return profileFor(userId).privacy.visitHistory === "hidden" || MOCK_VISIT_HISTORY_HIDDEN.has(userId);
}

/** Reverse discovery summary (mock GET /discovery): per-friend unseen places minus the demo user's check-ins, privacy-gated (backend DiscoveryService.summary parity), plus the hidden-history rows экран 27 draws. */
export function discoverySummary(): DiscoveryScreen {
  const myPlaceIds = myVisitedPlaceIds();
  const unique = new Set<string>();
  const byFriend: DiscoveryFriendCard[] = [];
  const hidden: DiscoveryFriendCard[] = [];
  for (const [index, friend] of mockFriends.entries()) {
    // Скрытая история не даёт ни счётчика, ни мест — только строку о том, что это выбор друга.
    if (visitHistoryHidden(friend.id)) {
      hidden.push({ friend, newPlacesCount: 0, places: [], visitHistoryHidden: true });
      continue;
    }
    const unseen = unseenFriendPlaces(index, myPlaceIds);
    for (const place of unseen) unique.add(place.id);
    if (unseen.length === 0) continue;
    byFriend.push({ friend, newPlacesCount: unseen.length, places: routesOpenForViewer(friend.id) ? unseen : [], visitHistoryHidden: false });
  }
  byFriend.sort((a, b) => b.newPlacesCount - a.newPlacesCount || a.friend.name.localeCompare(b.friend.name));
  hidden.sort((a, b) => a.friend.name.localeCompare(b.friend.name));
  return { newPlacesCount: unique.size, byFriend: [...byFriend, ...hidden] };
}

/** What a friend came to a place for (макет, экран 28 — «11:20 · завтрак»); nothing on the backend knows it, so the category speaks for the visit. */
const MOCK_STOP_NOTE: Record<PlaceCategory, string> = { park: "прогулка", museum: "выставка", food: "гастромаркет", sport: "тренировка", other: "встреча" };

/** The clock of the design, stop by stop; beyond the fourth the day simply keeps going by two hours. */
const MOCK_STOP_CLOCK = ["11:20", "13:00", "16:30", "20:00"];

function stopClock(index: number): string {
  if (index < MOCK_STOP_CLOCK.length) return MOCK_STOP_CLOCK[index];
  return `${String(20 + 2 * (index - MOCK_STOP_CLOCK.length + 1)).padStart(2, "0")}:00`;
}

/** One route lives inside one day: the day before the demo «now», shifted per friend so two routes never claim the same date. */
function routeDay(friendIndex: number): string {
  const day = new Date(MOCK_NOW.getTime() - (friendIndex + 1) * 24 * HOUR_MS);
  return `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
}

/** Friend route of unseen places (mock GET /discovery/friends/:userId/route); "own"/"not_friend"/"hidden" map to 403/404/403 in the interceptor (backend DiscoveryService.route parity). `stops` carries the clock and the note экран 28 needs — the contract answer stays in `places`. */
export function friendRoute(userId: string): { friend: Friend; places: Place[]; stops: { place: Place; visitedAt: string; note: string }[] } | "own" | "not_friend" | "hidden" {
  if (userId === mockDemoUser.id) return "own";
  const index = mockFriendIds.indexOf(userId);
  if (index === -1) return "not_friend";
  if (!routesOpenForViewer(userId) || visitHistoryHidden(userId)) return "hidden";
  const places = unseenFriendPlaces(index, myVisitedPlaceIds());
  const day = routeDay(index);
  return { friend: mockFriends[index], places, stops: places.map((place, order) => ({ place, visitedAt: `${day}T${stopClock(order)}:00+03:00`, note: MOCK_STOP_NOTE[place.category] })) };
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
    const visit = visitHistoryHidden(friend.id) ? null : latestVisitPlace(index);
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
