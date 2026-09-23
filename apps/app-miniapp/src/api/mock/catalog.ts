// START_MODULE_CONTRACT
// PURPOSE: Mock catalog store: the event and place page aggregates, the catalog filter and the participation counters.
// SCOPE: filterMockEvents, eventDetails, placePageFor, participationStats and the in-memory participations; the HTTP surface is in ./catalog.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - filterMockEvents - apply catalog filters to fixtures (date matches the local day of startsAt)
// - mockParticipations - shared with catalog.routes, social
// - nextMockParticipationSeq - Bumps and returns the participation sequence; the route table writes participations from its own module, and an imported binding is read-only
// - mockPlaceStatuses - viewer statuses on venues (макет, экран 03); mock-only until the slot domain lands (#492), shared with catalog.routes and feed
// - resetMockParticipations - restore seeded participations and clear the venue statuses (test isolation)
// - participationStats - per-event status counters, friends count and own status
// - placePageFor - place social page aggregate: today events, friend visits, place rating, popularity, personal visits (mock)
// - eventDetails - shared with catalog.routes
// END_MODULE_MAP

import type { Event, Participation, ParticipationStatus, PlacePage } from "@max-events/api-contracts";
import { type EventFilters, type EventRating, type ParticipationStats } from "../client";
import { checkInFor, mockBookings, mockCheckIns, remainingSeats } from "./bookings";
import { MOCK_TODAY, PLACE_STAMP, mockDemoUser, mockEvents, mockFriendIds, mockFriends, mockOrganization, mockOrganizers, mockPlaces, moscowDateKey } from "./fixtures";
import { eventPromoted } from "./promo";
import { eventRating, mockReviews } from "./reviews";

export function filterMockEvents(events: Event[], filters: EventFilters): Event[] {
  const city = filters.city?.toLowerCase();
  return events.filter((item) => {
    if (filters.category !== undefined && item.category !== filters.category) return false;
    if (city !== undefined && item.city.toLowerCase() !== city) return false;
    if (filters.date !== undefined && item.startsAt.slice(0, 10) !== filters.date) return false;
    if (filters.minRating === undefined) return true;
    // Backend parity: an event nobody reviewed has no average, so it is not "at least N stars".
    const summary = eventRating(item.id)?.summary;
    return summary !== undefined && summary.reviewsCount > 0 && summary.averageStars >= filters.minRating;
  });
}

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

export const mockParticipations = new Map<string, Participation>();

/**
 * Viewer status on a venue, keyed `${userId}:${placeId}` (макет, экран 03, блок «Твой статус на этой
 * площадке»). Participation is an event-level domain: a place has no such surface until the slot
 * domain lands (#492), so this store stands in for it behind the endpoint signature.
 */
export const mockPlaceStatuses = new Map<string, ParticipationStatus>();

let mockParticipationSeq = 0;

/** Bumps and returns the participation sequence; the route table writes participations from its own module, and an imported binding is read-only. */
export function nextMockParticipationSeq(): number {
  mockParticipationSeq += 1;
  return mockParticipationSeq;
}

function seedMockParticipations(): void {
  mockParticipations.clear();
  mockPlaceStatuses.clear();
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

/** Restores seeded participations and clears the venue statuses (test isolation). */
export function resetMockParticipations(): void {
  seedMockParticipations();
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

export function eventDetails(eventId: string, userId: string): object | null {
  // EventDetailsService throws NotFound for published === false: once moderation hides an event, its
  // page stops answering, organizer and all.
  const event = mockEvents.find((item) => item.id === eventId && item.published !== false);
  if (!event) return null;
  const active = mockBookings.find((booking) => booking.eventId === eventId && booking.userId === userId && booking.status === "active");
  return {
    event: eventPromoted(event),
    place: mockPlaces.find((item) => item.id === event.placeId) ?? null,
    organizer: mockOrganizers[0],
    organization: mockOrganization,
    remainingSeats: remainingSeats(eventId),
    activeBookingId: active?.id ?? null,
    checkInId: checkInFor(userId, eventId)?.id ?? null,
  };
}
