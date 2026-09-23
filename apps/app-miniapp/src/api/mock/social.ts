// START_MODULE_CONTRACT
// PURPOSE: Mock social graph store: friends, the gathering flow, UGC micro-events, reverse discovery and people matching.
// SCOPE: Friend availability and gatherings, micro-events with their join counters, friend place discovery and the people matcher; the HTTP surface is in ./social.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - friendAvailability - per-friend free/busy/unknown for the gathering flow (mock)
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
// - friendPlaceLayer - mock GET /discovery/friend-places: places friends checked in at, grouped, privacy-gated
// - discoverySummary - per-friend unseen places minus the demo user's check-ins, privacy-gated (mock GET /discovery, backend DiscoveryService.summary parity)
// - friendRoute - chronological unseen places of one friend; own/not-friend/hidden map to 403/404/403 (mock GET /discovery/friends/:userId/route, backend parity)
// - peopleSuggest - mockFriends matched on seeded interests or a shared upcoming event with distances from the requested coords (mock GET /people, backend PeopleService parity)
// END_MODULE_MAP

import { MicroEventSchema, TimestampSchema } from "@max-events/api-contracts";
import type { DiscoveryFriendPlaces, DiscoveryResponse, FriendActivityByFriend, FriendAvailability, FriendPlaceVisit, FriendRoute, Gathering, InviteeResponse, MicroEvent, ParticipationStatus, PeopleCandidate, PeopleMatchContext, PeopleResponse, Place } from "@max-events/api-contracts";
import { type CreateGathering, type CreateMicroEvent } from "../client";
import { mockCheckIns } from "./bookings";
import { mockParticipations } from "./catalog";
import { MOCK_NOW, PLACE_STAMP, haversineKm, mockDemoUser, mockEvents, mockFriendIds, mockFriends, mockPlaces } from "./fixtures";
import { profileFor } from "./profile";

/** Mock availability per friend (by mockFriends index); the backend P1-6-b does not exist yet. */
const MOCK_AVAILABILITY: FriendAvailability["availability"][] = ["free", "busy", "unknown", "free", "free", "busy", "unknown"];

export function friendAvailability(): FriendAvailability[] {
  return mockFriends.map((friend, index) => ({ friend, availability: MOCK_AVAILABILITY[index] }));
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

type MicroEventSeed = Omit<MicroEvent, "createdAt">;

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
];

export const mockMicroEvents: MicroEvent[] = [];

const mockMicroMemberships = new Set<string>();

let mockMicroSeq = 0;

export function seedMockMicroEvents(): void {
  mockMicroEvents.length = 0;
  mockMicroMemberships.clear();
  mockMicroSeq = MICRO_EVENT_SEED.length;
  for (const seed of MICRO_EVENT_SEED) {
    mockMicroEvents.push({ ...seed, participantIds: [...seed.participantIds], createdAt: PLACE_STAMP });
    for (const participant of seed.participantIds) mockMicroMemberships.add(`${participant}:${seed.id}`);
  }
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
    participantIds: [payload.userId],
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
    const privacy = profileFor(friend.id).privacy;
    if (privacy.visitHistory === "hidden" || privacy.routes === "hidden") return;
    const visitedAt = new Date(MOCK_NOW.getTime() - (MOCK_DISCOVERY_VISIT_SEED.length - order) * 86_400_000).toISOString();
    const entry = byPlace.get(place.id) ?? { place, friends: [], lastVisitAt: visitedAt };
    if (!entry.friends.some((row) => row.id === friend.id)) entry.friends.push(friend);
    if (Date.parse(visitedAt) > Date.parse(entry.lastVisitAt)) entry.lastVisitAt = visitedAt;
    byPlace.set(place.id, entry);
  });
  return [...byPlace.values()].sort((a, b) => Date.parse(b.lastVisitAt) - Date.parse(a.lastVisitAt) || a.place.title.localeCompare(b.place.title));
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
