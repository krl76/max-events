// START_MODULE_CONTRACT
// PURPOSE: Mock store for the we-groups and the shared event vote.
// SCOPE: Group screens with their route and budget blocks plus the vote tallies; the HTTP surface is in ./groups.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MOCK_VOTE_ID - seeded deep-link demo vote (the demo user is a participant; seeded winner)
// - MOCK_FOREIGN_VOTE_ID - seeded vote the demo user did not host; opening the link joins them
// - resetMockVotes - restore the two seeded votes (test isolation)
// - createMockVote - in-memory vote with a sent chat card (chatLink set, successful MaxBot parity); participants must be friends of the demo host, events must exist (mock POST /votes, backend VotesService parity)
// - getMockVote - mock GET /votes/:id (404 unknown; opening a shared vote joins the viewer); myBallotEventId comes from the demo user's stored ballot (backend #324 parity)
// - castMockBallot - mock POST /votes/:id/ballots: one ballot per user, a repeated ballot replaces the previous one; winner = max votes then option position, null without ballots (backend parity); "closed" once the host finished the vote
// - closeMockVote - mock POST /votes/:id/close: host only, idempotent; the leader becomes the winner and no more ballots are taken (no backend transition exists yet)
// - resetMockWeGroups - restore seeded groups and plan expenses (test isolation)
// - listMockWeGroups - screens of the demo user's groups, newest first; the route answers their summaries
// - mockWeGroupSummary - mock GET /we-groups row (backend toSummary parity): group, member/upcoming/photo counts, budget total, next event title
// - getMockWeGroup - Mock GET /we-groups/:id: "unknown" -> 404, "forbidden" non-member -> 403 (backend requireMember parity)
// - createMockWeGroup - Mock POST /we-groups (backend create parity): owner always a member, every member id must be a known user
// - bindMockWeGroupItem - Mock POST /we-groups/:id/events|places (backend addEvent/addPlace parity): duplicate binds are idempotent; "archived" -> 409
// - archiveMockWeGroup - Mock POST /we-groups/:id/archive (backend archive parity): owner only, idempotent
// END_MODULE_MAP

import type { CreateVoteWrite, CreateWeGroupWrite, DayRoute, Event, Friend, Place, PlanBudget, ReviewPhoto, RoutePoint, WeGroup, WeGroupSummary } from "@max-events/api-contracts";
import type { VoteScreen, WeGroupCard } from "../client";
import { mockBookings } from "./bookings";
import { PLACE_STAMP, mockDemoUser, mockEvents, mockFriendIds, mockFriends, mockPlaces } from "./fixtures";
import { mockBudgetFromExpenses, mockDayRoute, mockPlanExpenses, mockPlans, resetMockPlanExpenses } from "./plans";

/**
 * In-memory vote row: contract fields plus option positions and raw ballots (backend vote.entity
 * parity; option positions tie-break the winner like the backend order does). `closedAt` has no
 * backend column: the votes domain never finishes a vote, and экран 33 both offers «Завершить» and
 * has to draw the finished state, so the mock carries the transition the endpoint will take.
 */
interface MockVoteRow {
  id: string;
  hostUserId: string;
  title: string;
  chatLink: string | null;
  participantIds: string[];
  options: { id: string; eventId: string; position: number }[];
  ballots: { userId: string; eventId: string }[];
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Seeded deep-link demo vote (hosted by Анна, the demo user is a participant; winner seeded with two ballots). */
export const MOCK_VOTE_ID = "d7000000-0000-4000-8000-000000000001";

/** Seeded vote the demo user did not host; opening the link joins them. */
export const MOCK_FOREIGN_VOTE_ID = "d7000000-0000-4000-8000-000000000002";

const mockVotes = new Map<string, MockVoteRow>();

let mockVoteSeq = 0;

function mockVoteDto(row: MockVoteRow): VoteScreen {
  const counts = new Map<string, number>();
  for (const ballot of row.ballots) counts.set(ballot.eventId, (counts.get(ballot.eventId) ?? 0) + 1);
  const options = [...row.options]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .flatMap((option) => {
      const found = mockEvents.find((item) => item.id === option.eventId);
      return found ? [{ event: found, votes: counts.get(option.eventId) ?? 0 }] : [];
    });
  const ranked = [...row.options].sort((a, b) => (counts.get(b.eventId) ?? 0) - (counts.get(a.eventId) ?? 0) || a.position - b.position || a.id.localeCompare(b.id));
  const top = ranked[0];
  const topVotes = top ? (counts.get(top.eventId) ?? 0) : 0;
  const participants: Friend[] = row.participantIds.flatMap(mockVoterOf);
  // The roster the design counts «Проголосовали 4 из 5» against: the host votes too, and the Vote DTO
  // leaves them out of `participants`, so without this list the screen cannot even name them.
  const voters: Friend[] = [...mockVoterOf(row.hostUserId), ...participants];
  return {
    id: row.id,
    hostUserId: row.hostUserId,
    title: row.title,
    chatLink: row.chatLink,
    participants,
    options,
    winnerEventId: top && topVotes > 0 ? top.eventId : null,
    myBallotEventId: row.ballots.find((ballot) => ballot.userId === mockDemoUser.id)?.eventId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    status: row.closedAt === null ? "open" : "closed",
    closedAt: row.closedAt,
    voters,
    votedUserIds: voters.flatMap((voter) => (row.ballots.some((ballot) => ballot.userId === voter.id) ? [voter.id] : [])),
  };
}

/** A vote roster entry: friends come from the friend list, the demo user names themselves, anyone else is unknown to this client. */
function mockVoterOf(userId: string): Friend[] {
  const friend = mockFriends.find((item) => item.id === userId);
  if (friend) return [friend];
  return userId === mockDemoUser.id ? [{ id: mockDemoUser.id, name: mockDemoUser.firstName, avatarUrl: null }] : [];
}

function seedMockVotes(): void {
  mockVotes.clear();
  const stamp = PLACE_STAMP;
  mockVotes.set(MOCK_VOTE_ID, {
    id: MOCK_VOTE_ID,
    hostUserId: mockFriendIds[0],
    title: "Куда идем в пятницу?",
    chatLink: "https://max.ru/chat/mock-vote-1",
    // Пётр votes for nobody on purpose: экран 33 has to reach «ещё не голосовал» with a name in it
    participantIds: [mockDemoUser.id, mockFriendIds[1], mockFriendIds[2], mockFriendIds[3]],
    // option ids deliberately run against positions so a winner tie discriminates the position tie-break from the id order
    options: [
      { id: `${MOCK_VOTE_ID}-o3`, eventId: mockEvents[0].id, position: 0 },
      { id: `${MOCK_VOTE_ID}-o2`, eventId: mockEvents[2].id, position: 1 },
      { id: `${MOCK_VOTE_ID}-o1`, eventId: mockEvents[4].id, position: 2 },
    ],
    ballots: [
      { userId: mockFriendIds[0], eventId: mockEvents[0].id },
      { userId: mockFriendIds[1], eventId: mockEvents[0].id },
      { userId: mockFriendIds[2], eventId: mockEvents[2].id },
    ],
    closedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  });
  mockVotes.set(MOCK_FOREIGN_VOTE_ID, {
    id: MOCK_FOREIGN_VOTE_ID,
    hostUserId: mockFriendIds[1],
    title: "Закрытое голосование",
    chatLink: null,
    participantIds: [mockFriendIds[2]],
    options: [
      { id: `${MOCK_FOREIGN_VOTE_ID}-o1`, eventId: mockEvents[0].id, position: 0 },
      { id: `${MOCK_FOREIGN_VOTE_ID}-o2`, eventId: mockEvents[1].id, position: 1 },
    ],
    ballots: [],
    closedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  });
  mockVoteSeq = 2;
}

seedMockVotes();

export function resetMockVotes(): void {
  seedMockVotes();
}

/** Creates an in-memory vote hosted by the demo user; the mock mirrors a successful MaxBot chat card (chatLink is set). */
export function createMockVote(payload: CreateVoteWrite): VoteScreen | "invalid" | "no_event" {
  const hostUserId = mockDemoUser.id;
  const participantIds = [...new Set(payload.participantIds)];
  if (participantIds.includes(hostUserId) || participantIds.some((id) => !mockFriendIds.includes(id))) return "invalid";
  const eventIds = [...new Set(payload.eventIds)];
  const events = eventIds.map((id) => mockEvents.find((item) => item.id === id));
  if (events.some((found) => !found || found.published === false)) return "no_event";
  const now = new Date().toISOString();
  mockVoteSeq += 1;
  const id = `d7000000-0000-4000-8000-${String(mockVoteSeq).padStart(12, "0")}`;
  const row: MockVoteRow = {
    id,
    hostUserId,
    title: payload.title,
    chatLink: `https://max.ru/chat/mock-vote-${mockVoteSeq}`,
    participantIds,
    options: eventIds.map((eventId, position) => ({ id: `${id}-o${position + 1}`, eventId, position })),
    ballots: [],
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  mockVotes.set(id, row);
  return mockVoteDto(row);
}

/** Reads a vote for the demo user: unknown -> "unknown". Opening a shared vote joins the viewer. */
export function getMockVote(id: string): VoteScreen | "unknown" | "forbidden" {
  const row = mockVotes.get(id);
  if (!row) return "unknown";
  if (row.hostUserId !== mockDemoUser.id && !row.participantIds.includes(mockDemoUser.id)) {
    row.participantIds = [...row.participantIds, mockDemoUser.id];
    row.updatedAt = new Date().toISOString();
  }
  return mockVoteDto(row);
}

/** Casts the demo user's ballot; a repeated ballot replaces the previous one (backend castBallot parity). A finished vote takes no more ballots. */
export function castMockBallot(id: string, eventId: string): VoteScreen | "unknown" | "forbidden" | "invalid" | "closed" {
  const row = mockVotes.get(id);
  if (!row) return "unknown";
  if (row.hostUserId !== mockDemoUser.id && !row.participantIds.includes(mockDemoUser.id)) {
    row.participantIds = [...row.participantIds, mockDemoUser.id];
  }
  if (row.closedAt !== null) return "closed";
  if (!row.options.some((option) => option.eventId === eventId)) return "invalid";
  const existing = row.ballots.find((ballot) => ballot.userId === mockDemoUser.id);
  if (existing) {
    existing.eventId = eventId;
  } else {
    row.ballots.push({ userId: mockDemoUser.id, eventId });
  }
  row.updatedAt = new Date().toISOString();
  return mockVoteDto(row);
}

/**
 * Finishes the vote: the leader stops being «Лидирует» and becomes the winner, and the options stop
 * taking ballots. Only the host may do it — the design puts «Завершить» on the host's leader card —
 * and a second call is a no-op, like every other write of this mock. The votes domain has no such
 * transition at all, so this is the endpoint's future shape, not its current one.
 */
export function closeMockVote(id: string): VoteScreen | "unknown" | "forbidden" {
  const row = mockVotes.get(id);
  if (!row) return "unknown";
  if (row.hostUserId !== mockDemoUser.id) return "forbidden";
  if (row.closedAt === null) {
    const now = new Date().toISOString();
    row.closedAt = now;
    row.updatedAt = now;
  }
  return mockVoteDto(row);
}

/**
 * In-memory «Мы» group row: the group plus its member ids and bound event/place ids.
 *
 * `budgetLimitRub` and `photosTotal` have no backend column. The design prints «потрачено 9 800 из
 * 14 200 ₽» and «Все 62», and neither number can be derived: PlanBudget knows only what was spent,
 * and `photos` is the preview grid, not the archive. Both travel under the names the future endpoint
 * will keep, so a real server answering the screen without them just hides those two blocks.
 */
interface MockWeGroupRow {
  group: WeGroup;
  memberIds: string[];
  eventIds: string[];
  placeIds: string[];
  budgetLimitRub: number | null;
  photoUrls: string[];
  photosTotal: number;
}

/** Group photos are not people photos: the grid draws gradients, and these urls are what a real album would send. */
function mockWeGroupPhotos(group: number, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `https://static.max.ru/mock/we-groups/${group}/${index + 1}.jpg`);
}

const MOCK_WE_GROUP_SEED: MockWeGroupRow[] = [
  {
    group: { id: "91000000-0000-4000-8000-000000000001", ownerUserId: mockDemoUser.id, title: "Субботник и гастровыходные", chatLink: "https://max.ru/join/we-group-demo", status: "active", createdAt: "2026-08-01T12:00:00+03:00", updatedAt: "2026-08-01T12:00:00+03:00", archivedAt: null },
    memberIds: [mockDemoUser.id, mockFriendIds[3], mockFriendIds[4]],
    eventIds: [mockEvents[2].id, mockEvents[11].id],
    placeIds: [mockPlaces[3].id, mockPlaces[0].id, mockPlaces[4].id],
    budgetLimitRub: 14200,
    photoUrls: mockWeGroupPhotos(1, 8),
    photosTotal: 62,
  },
  {
    group: { id: "91000000-0000-4000-8000-000000000002", ownerUserId: mockDemoUser.id, title: "Прошлый поход на выставку", chatLink: null, status: "archived", createdAt: "2026-07-01T12:00:00+03:00", updatedAt: "2026-07-02T12:00:00+03:00", archivedAt: "2026-07-02T12:00:00+03:00" },
    memberIds: [mockDemoUser.id, mockFriendIds[0]],
    eventIds: [],
    placeIds: [],
    budgetLimitRub: null,
    photoUrls: mockWeGroupPhotos(2, 4),
    photosTotal: 18,
  },
  {
    group: { id: "91000000-0000-4000-8000-000000000003", ownerUserId: mockFriendIds[0], title: "Киноклуб", chatLink: "https://max.ru/join/we-group-cinema", status: "active", createdAt: "2026-07-10T12:00:00+03:00", updatedAt: "2026-07-10T12:00:00+03:00", archivedAt: null },
    memberIds: [mockFriendIds[0], mockDemoUser.id],
    eventIds: [mockEvents[10].id],
    placeIds: [],
    budgetLimitRub: null,
    photoUrls: mockWeGroupPhotos(3, 4),
    photosTotal: 24,
  },
  {
    group: { id: "91000000-0000-4000-8000-000000000004", ownerUserId: mockFriendIds[0], title: "Чужая группа", chatLink: null, status: "active", createdAt: "2026-07-05T12:00:00+03:00", updatedAt: "2026-07-05T12:00:00+03:00", archivedAt: null },
    memberIds: [mockFriendIds[0], mockFriendIds[1]],
    eventIds: [],
    placeIds: [],
    budgetLimitRub: null,
    photoUrls: [],
    photosTotal: 0,
  },
  {
    // Nothing ahead, two saved places and a route: the third summary line of экран 30
    group: { id: "91000000-0000-4000-8000-000000000005", ownerUserId: mockDemoUser.id, title: "Родительский чат 4Б", chatLink: null, status: "active", createdAt: "2026-06-20T12:00:00+03:00", updatedAt: "2026-06-20T12:00:00+03:00", archivedAt: null },
    memberIds: [mockDemoUser.id, mockFriendIds[5], mockFriendIds[6]],
    eventIds: [],
    placeIds: [mockPlaces[1].id, mockPlaces[2].id],
    budgetLimitRub: null,
    photoUrls: [],
    photosTotal: 0,
  },
];

function copyMockWeGroups(): MockWeGroupRow[] {
  return MOCK_WE_GROUP_SEED.map((row) => ({ ...row, group: { ...row.group }, memberIds: [...row.memberIds], eventIds: [...row.eventIds], placeIds: [...row.placeIds], photoUrls: [...row.photoUrls] }));
}

let mockWeGroups: MockWeGroupRow[] = copyMockWeGroups();

let mockWeGroupSeq = MOCK_WE_GROUP_SEED.length;

/** Restore the seeded groups and plan expenses (test isolation). */
export function resetMockWeGroups(): void {
  mockWeGroups = copyMockWeGroups();
  mockWeGroupSeq = MOCK_WE_GROUP_SEED.length;
  resetMockPlanExpenses();
}

function mockFriendOf(userId: string): Friend {
  if (userId === mockDemoUser.id) return { id: mockDemoUser.id, name: "Демо", avatarUrl: null };
  return mockFriends.find((friend) => friend.id === userId) ?? { id: userId, name: "Участник", avatarUrl: null };
}

/** Screen aggregate (backend WeGroupsService.toScreen parity): members in join order, bound events/places from fixtures, member bookings, group route, shared plan budget, photos; the budget ceiling and the album size are the two mock-only fields of WeGroupCard. */
function mockWeGroupScreen(row: MockWeGroupRow): WeGroupCard {
  const events = row.eventIds.flatMap((id) => {
    const found = mockEvents.find((item) => item.id === id && item.published !== false);
    return found ? [found] : [];
  });
  const places = row.placeIds.flatMap((id) => {
    const found = mockPlaces.find((item) => item.id === id && item.published !== false);
    return found ? [found] : [];
  });
  const memberSet = new Set([row.group.ownerUserId, ...row.memberIds]);
  const eventSet = new Set(events.map((item) => item.id));
  return {
    group: { ...row.group },
    members: row.memberIds.map(mockFriendOf),
    events,
    places,
    bookings: mockBookings.filter((booking) => booking.status === "active" && memberSet.has(booking.userId) && eventSet.has(booking.eventId)).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id)),
    route: mockWeGroupRoute(events, places),
    budget: mockWeGroupBudget(memberSet, eventSet),
    photos: row.photoUrls.map((url): ReviewPhoto => ({ url })),
    // Backend goingByEvent parity: a member with an active booking on a bound event is «going» to it.
    goingByEvent: events.map((event) => ({ eventId: event.id, going: [...memberSet].filter((userId) => mockBookings.some((booking) => booking.status === "active" && booking.userId === userId && booking.eventId === event.id)).map(mockFriendOf) })),
    budgetLimitRub: row.budgetLimitRub,
    photosTotal: row.photosTotal,
  };
}

/** Backend WeGroupsService.toSummary parity: what GET /we-groups answers per group — counts and the next title, not the screen. */
export function mockWeGroupSummary(card: WeGroupCard, now: Date = new Date()): WeGroupSummary {
  const upcoming = card.events.filter((event) => Date.parse(event.startsAt) >= now.getTime()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return {
    group: card.group,
    membersCount: card.members.length,
    upcomingEventsCount: upcoming.length,
    photosTotal: card.photosTotal,
    budgetTotalRub: card.budget?.totalRub ?? null,
    nextEventTitle: upcoming[0]?.title ?? null,
  };
}

/** Backend groupRoute parity: event points by startsAt, then not-yet-used extra places by id; null under two points. */
function mockWeGroupRoute(events: Event[], places: Place[]): DayRoute | null {
  const points: RoutePoint[] = [];
  const usedPlaces = new Set<string>();
  const sortedEvents = [...events].filter((row) => row.placeId !== null).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  for (const event of sortedEvents) {
    const place = mockPlaces.find((item) => item.id === event.placeId);
    if (!place) continue;
    points.push({ title: event.title, at: new Date(event.startsAt).toISOString(), latitude: place.latitude, longitude: place.longitude, eventId: event.id, placeId: place.id });
    usedPlaces.add(place.id);
  }
  const extraPlaces = [...places].filter((row) => !usedPlaces.has(row.id)).sort((a, b) => a.id.localeCompare(b.id));
  for (const place of extraPlaces) {
    points.push({ title: place.title, at: null, latitude: place.latitude, longitude: place.longitude, eventId: null, placeId: place.id });
  }
  const sliced = points.slice(0, 8);
  if (sliced.length < 2) return null;
  return mockDayRoute(sliced);
}

/** Backend groupBudget parity: expenses of the demo-hosted plans bound to the group events; null without plans or expenses. */
function mockWeGroupBudget(memberSet: Set<string>, eventSet: Set<string>): PlanBudget | null {
  if (eventSet.size === 0 || !memberSet.has(mockDemoUser.id)) return null;
  const planIds = new Set(mockPlans.filter((card) => eventSet.has(card.plan.eventId)).map((card) => card.plan.id));
  if (planIds.size === 0) return null;
  const rows = mockPlanExpenses.filter((row) => planIds.has(row.planId));
  if (rows.length === 0) return null;
  return mockBudgetFromExpenses(rows);
}

function findMockWeGroup(id: string): MockWeGroupRow | null {
  return mockWeGroups.find((row) => row.group.id === id) ?? null;
}

function isMockWeGroupMember(row: MockWeGroupRow, userId: string): boolean {
  return row.group.ownerUserId === userId || row.memberIds.includes(userId);
}

/** Mock GET /we-groups: screens of the demo user's groups, newest first (backend listForUser parity). */
export function listMockWeGroups(): WeGroupCard[] {
  return [...mockWeGroups]
    .filter((row) => isMockWeGroupMember(row, mockDemoUser.id))
    .sort((a, b) => Date.parse(b.group.createdAt) - Date.parse(a.group.createdAt) || a.group.id.localeCompare(b.group.id))
    .map(mockWeGroupScreen);
}

/** Mock GET /we-groups/:id: "unknown" -> 404, "forbidden" non-member -> 403 (backend requireMember parity). */
export function getMockWeGroup(id: string): WeGroupCard | "unknown" | "forbidden" {
  const row = findMockWeGroup(id);
  if (!row) return "unknown";
  if (!isMockWeGroupMember(row, mockDemoUser.id)) return "forbidden";
  return mockWeGroupScreen(row);
}

/** Mock POST /we-groups (backend create parity): owner always a member, every member id must be a known user. */
export function createMockWeGroup(payload: CreateWeGroupWrite): WeGroupCard | "unknown_user" {
  const known = new Set([mockDemoUser.id, ...mockFriendIds]);
  const memberIds = [...new Set([mockDemoUser.id, ...payload.memberIds])];
  if (memberIds.some((id) => !known.has(id))) return "unknown_user";
  const now = new Date().toISOString();
  mockWeGroupSeq += 1;
  const row: MockWeGroupRow = {
    group: { id: `91000000-0000-4000-8000-${String(mockWeGroupSeq).padStart(12, "0")}`, ownerUserId: mockDemoUser.id, title: payload.title.trim(), chatLink: `https://max.ru/join/we-group-${mockWeGroupSeq}`, status: "active", createdAt: now, updatedAt: now, archivedAt: null },
    memberIds,
    eventIds: [],
    placeIds: [],
    budgetLimitRub: null,
    photoUrls: [],
    photosTotal: 0,
  };
  mockWeGroups.push(row);
  return mockWeGroupScreen(row);
}

/** Mock POST /we-groups/:id/events|places (backend addEvent/addPlace parity): duplicate binds are idempotent; "archived" -> 409. */
export function bindMockWeGroupItem(id: string, kind: "event" | "place", itemId: string): WeGroupCard | "unknown" | "forbidden" | "archived" | "no_target" {
  const row = findMockWeGroup(id);
  if (!row) return "unknown";
  if (!isMockWeGroupMember(row, mockDemoUser.id)) return "forbidden";
  if (row.group.status === "archived") return "archived";
  if (kind === "event") {
    if (!mockEvents.some((item) => item.id === itemId && item.published !== false)) return "no_target";
    if (!row.eventIds.includes(itemId)) row.eventIds.push(itemId);
  } else {
    if (!mockPlaces.some((item) => item.id === itemId && item.published !== false)) return "no_target";
    if (!row.placeIds.includes(itemId)) row.placeIds.push(itemId);
  }
  return mockWeGroupScreen(row);
}

/** Mock POST /we-groups/:id/photos: any member, including after archive — the album is the trip's history. */
export function addMockWeGroupPhoto(id: string, url: string): WeGroupCard | "unknown" | "forbidden" {
  const row = findMockWeGroup(id);
  if (!row) return "unknown";
  if (!isMockWeGroupMember(row, mockDemoUser.id)) return "forbidden";
  row.photoUrls.push(url);
  row.photosTotal += 1;
  return mockWeGroupScreen(row);
}

/** Mock POST /we-groups/:id/archive (backend archive parity): owner only, idempotent. */
export function archiveMockWeGroup(id: string): WeGroupCard | "unknown" | "forbidden" {
  const row = findMockWeGroup(id);
  if (!row) return "unknown";
  if (!isMockWeGroupMember(row, mockDemoUser.id)) return "forbidden";
  if (row.group.ownerUserId !== mockDemoUser.id) return "forbidden";
  if (row.group.status !== "archived") {
    const now = new Date().toISOString();
    row.group.status = "archived";
    row.group.archivedAt = now;
    row.group.updatedAt = now;
  }
  return mockWeGroupScreen(row);
}
