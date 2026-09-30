// START_MODULE_CONTRACT
// PURPOSE: Mock profile store: the seeded profiles, the visit statistics they derive, achievements, my-city, the taste graph, the экран 36 counters and the экран 41 app settings.
// SCOPE: Profile state and everything computed from check-ins; the HTTP surface is in ./profile.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - visitStatsFor - Visit statistics derived from the check-ins of a user: events, unique places, their districts, per-category counters
// - achievementsFor - the four README achievements with progress derived from visit stats
// - myCityFor - my-city summary and memory points derived from the check-ins of a user
// - tasteProfile - taste graph of a user, derived from their mock check-ins (empty until they visit something)
// - afterMePicks - mock GET /taste/after-me: more of the strongest visited category, backend wording parity
// - profileCountersFor - экран 36 counters: events and places from the visit history, «компании» = visited events a friend was at too (#496)
// - visitedPlacesFor - impressions grid of экран 36: the places of the viewer's check-ins with their visit counts, most visited first
// - userPostsFor - post grid of экран 36: the seeded own posts plus everything this author published live, newest first
// - deleteMockProfilePost - drop a seeded tile after DELETE /feed/:id, so the profile grid matches the wall
// - DEFAULT_APP_SETTINGS - the экран 41 preferences a user starts with
// - appSettingsFor - stored app settings of a user, seeded from the defaults
// - updateMockAppSettings - merge a patch into the stored app settings
// - resetMockAppSettings - drop the stored app settings (test isolation)
// - mockCustomAvatars - avatars the demo user uploaded over their MAX one
// - userFor - the User behind an id: the demo user with their custom avatar, or a friend
// - mockProfiles - shared with profile.routes
// - resetMockProfiles - restore the seeded friend profiles (test isolation)
// - profileFor - shared with profile.routes, social
// END_MODULE_MAP

import { DEFAULT_PRIVACY, DEFAULT_SMART_ALERTS, EventCategorySchema, PlaceCategorySchema, formatAfterMeExplanation } from "@max-events/api-contracts";
import type { Achievement, AfterMeResponse, Event, EventCategory, MemoryPoint, MyCitySummary, Profile, TasteProfile, TasteTransition, User, VisitStats } from "@max-events/api-contracts";
import { type AppSettings, type ProfileCounters, type ProfilePost, type UpdateAppSettings, type VisitedPlace } from "../client";
import { mockCheckIns } from "./bookings";
import { mockFeedPosts } from "./feed";
import { MOCK_NOW, PLACE_STAMP, mockDemoUser, mockEvents, mockFriends, mockPlaces } from "./fixtures";
import { mockReviews } from "./reviews";

/** Backend districtKey parity: a neighbourhood is a 0.01° geo cell of a visited place. */
function mockDistrictKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

/** Visit statistics derived from the check-ins of a user: events, unique places, their districts, per-category counters. */
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
  const districts = new Set(
    [...placeIds].flatMap((id) => {
      const place = mockPlaces.find((candidate) => candidate.id === id);
      return place ? [mockDistrictKey(place.latitude, place.longitude)] : [];
    }),
  );
  return {
    userId,
    placesCount: placeIds.size,
    eventsCount: mine.filter((item) => item.eventId !== null).length,
    districtsCount: districts.size,
    byCategory: EventCategorySchema.options.map((category) => ({ category, count: byCategory.get(category) ?? 0 })),
  };
}

/** The four README achievements («Исследователь города», «Музыкальный фанат», «Город за выходные», «Волонтер») with progress from visit stats. */
export function achievementsFor(stats: VisitStats): Achievement[] {
  const count = (category: string) => stats.byCategory.find((item) => item.category === category)?.count ?? 0;
  return [
    { code: "city_explorer", title: "Исследователь города", threshold: 10, progress: Math.min(stats.placesCount, 10), grantedAt: stats.placesCount >= 10 ? PLACE_STAMP : null },
    { code: "music_fan", title: "Музыкальный фанат", threshold: 5, progress: Math.min(count("afisha"), 5), grantedAt: count("afisha") >= 5 ? PLACE_STAMP : null },
    { code: "weekend_city", title: "Город за выходные", threshold: 3, progress: Math.min(stats.districtsCount, 3), grantedAt: stats.districtsCount >= 3 ? PLACE_STAMP : null },
    { code: "volunteer", title: "Волонтёр", threshold: 5, progress: Math.min(count("volunteering"), 5), grantedAt: count("volunteering") >= 5 ? PLACE_STAMP : null },
  ];
}

/** My-city summary and memory points derived from the check-ins of a user. */
export function myCityFor(userId: string): { summary: MyCitySummary; points: MemoryPoint[] } {
  const stats = visitStatsFor(userId);
  const summary: MyCitySummary = { userId, placesCount: stats.placesCount, eventsCount: stats.eventsCount, districtsCount: stats.districtsCount };
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

/**
 * Taste is computed from what the demo user actually did, not from a fixture: a fresh demo has an
 * empty graph and the «После меня» block stays hidden, and it appears once they tap «Я здесь» — the
 * same two states the backend produces. Weights follow TasteService.buildTasteGraph: a visit is 1,
 * a review adds stars/5 plus half a point for «пойду ещё раз».
 */
export function tasteProfile(userId: string, now: Date = MOCK_NOW): TasteProfile {
  const eventWeights = new Map<EventCategory, number>();
  for (const category of visitedEventCategories(userId)) eventWeights.set(category, (eventWeights.get(category) ?? 0) + 1);
  for (const review of mockReviews.filter((row) => row.userId === userId)) {
    const event = mockEvents.find((candidate) => candidate.id === review.eventId);
    if (!event) continue;
    eventWeights.set(event.category, (eventWeights.get(event.category) ?? 0) + review.stars / 5 + (review.wouldGoAgain ? 0.5 : 0));
  }
  const placeWeights = new Map<string, number>();
  for (const item of mockCheckIns.filter((row) => row.userId === userId && row.placeId !== null)) {
    const place = mockPlaces.find((candidate) => candidate.id === item.placeId);
    if (place) placeWeights.set(place.category, (placeWeights.get(place.category) ?? 0) + 1);
  }
  return {
    userId,
    // Schema order, like the backend: a consumer reading [0] as "the strongest" would be wrong there.
    eventCategories: EventCategorySchema.options.flatMap((category) => (eventWeights.has(category) ? [{ category, weight: eventWeights.get(category)! }] : [])),
    placeCategories: PlaceCategorySchema.options.flatMap((category) => (placeWeights.has(category) ? [{ category, weight: placeWeights.get(category)! }] : [])),
    transitions: visitTransitions(userId),
    updatedAt: now.toISOString(),
  };
}

function visitedEventCategories(userId: string): EventCategory[] {
  return visitedEventsInOrder(userId).map((event) => event.category);
}

function visitedEventsInOrder(userId: string): Event[] {
  return mockCheckIns
    .filter((item) => item.userId === userId && item.eventId !== null)
    .slice()
    .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt))
    .flatMap((item) => {
      const event = mockEvents.find((candidate) => candidate.id === item.eventId);
      return event ? [event] : [];
    });
}

/** Consecutive visits of different categories, the same "what did they do after X" the backend counts. */
function visitTransitions(userId: string): TasteTransition[] {
  const counts = new Map<string, number>();
  const visited = visitedEventsInOrder(userId);
  for (let index = 1; index < visited.length; index += 1) {
    const from = visited[index - 1]!.category;
    const to = visited[index]!.category;
    if (from === to) continue;
    counts.set(`${from}>${to}`, (counts.get(`${from}>${to}`) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [fromCategory, toCategory] = key.split(">") as [EventCategory, EventCategory];
      return { fromCategory, toCategory, count };
    })
    .sort((a, b) => b.count - a.count || a.fromCategory.localeCompare(b.fromCategory));
}

/** TasteService.strongestAfterMe parity, including the tie-break: schema order wins, not the alphabet. */
function strongestMockAfterMe(profile: TasteProfile): { fromCategory: EventCategory; toCategory: EventCategory; afterCount: number } | null {
  let topFrom: EventCategory | null = null;
  let topWeight = 0;
  for (const category of EventCategorySchema.options) {
    const weight = profile.eventCategories.find((row) => row.category === category)?.weight ?? 0;
    if (weight > topWeight) {
      topFrom = category;
      topWeight = weight;
    }
  }
  if (!topFrom || topWeight <= 0) return null;
  let toCategory = topFrom;
  let toCount = 0;
  for (const transition of profile.transitions) {
    if (transition.fromCategory !== topFrom || transition.toCategory === topFrom) continue;
    if (transition.count > toCount || (transition.count === toCount && transition.toCategory.localeCompare(toCategory) < 0)) {
      toCategory = transition.toCategory;
      toCount = transition.count;
    }
  }
  return { fromCategory: topFrom, toCategory, afterCount: Math.round(topWeight) };
}

/**
 * Mock of GET /taste/after-me: upcoming events of the suggested category in the viewer's city, soonest
 * first, five at most — the same query the backend runs, so a suggestion can also come back with no
 * events at all when the city has nothing upcoming.
 */
export function afterMePicks(userId: string, now: Date = MOCK_NOW): AfterMeResponse {
  const suggestion = strongestMockAfterMe(tasteProfile(userId, now));
  if (!suggestion) return { suggestions: [] };
  const city = profileFor(userId).city;
  const events = mockEvents
    .filter((event) => event.category === suggestion.toCategory && event.city === city && new Date(event.startsAt).getTime() >= now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .slice(0, 5);
  return { suggestions: [{ ...suggestion, explanation: formatAfterMeExplanation(suggestion.afterCount, suggestion.fromCategory, suggestion.toCategory), events }] };
}

/**
 * What the demo account already has behind it. mockCheckIns starts empty on purpose — a check-in is
 * something the viewer does live — so экран 36 would open on three zeros and an empty impressions
 * grid without this. Kept separate from the check-in store so resetMockCheckIns stays a clean slate
 * for the tests that count check-ins; the counters below add the two together.
 */
const MOCK_VISIT_HISTORY: readonly { place: number; visits: number; withCompany: number }[] = [
  { place: 0, visits: 12, withCompany: 9 },
  { place: 2, visits: 9, withCompany: 8 },
  { place: 1, visits: 7, withCompany: 4 },
  { place: 3, visits: 5, withCompany: 5 },
];

/** The impressions grid of экран 36: where the viewer has been, most visited first. Live check-ins add to the seeded history. */
export function visitedPlacesFor(userId: string): VisitedPlace[] {
  const visits = new Map<string, number>();
  for (const row of MOCK_VISIT_HISTORY) visits.set(mockPlaces[row.place].id, row.visits);
  for (const item of mockCheckIns.filter((row) => row.userId === userId)) {
    const placeId = item.placeId ?? (item.eventId === null ? null : (mockEvents.find((candidate) => candidate.id === item.eventId)?.placeId ?? null));
    if (placeId !== null) visits.set(placeId, (visits.get(placeId) ?? 0) + 1);
  }
  return [...visits.entries()]
    .flatMap(([placeId, count]) => {
      const place = mockPlaces.find((candidate) => candidate.id === placeId);
      return place ? [{ placeId, title: place.title, visits: count, photoUrl: place.logoUrl ?? "/onboarding/gorky.jpg" }] : [];
    })
    .sort((a, b) => b.visits - a.visits || a.title.localeCompare(b.title));
}

/**
 * The three counters of экран 36. «Компании» has no counter in any service (#496): here it is the
 * share of the visits that happened with company, which is what the metric means on the design.
 */
export function profileCountersFor(userId: string): ProfileCounters {
  const seededVisits = MOCK_VISIT_HISTORY.reduce((sum, row) => sum + row.visits, 0);
  return {
    userId,
    eventsCount: seededVisits + visitStatsFor(userId).eventsCount,
    placesCount: visitedPlacesFor(userId).length,
    companiesCount: MOCK_VISIT_HISTORY.reduce((sum, row) => sum + row.withCompany, 0),
  };
}

/**
 * What the demo account has already published. Same reason MOCK_VISIT_HISTORY above exists: the seeded
 * wall posts belong to friends, so the post grid of экран 36 would open empty on a fresh demo and the
 * screen could never be looked at. By event index, newest last — the grid reverses them.
 */
const MOCK_OWN_POST_HISTORY: readonly { event: number; likes: number; comments: number }[] = [
  { event: 0, likes: 14, comments: 3 },
  { event: 2, likes: 31, comments: 7 },
  { event: 4, likes: 9, comments: 1 },
  { event: 6, likes: 22, comments: 4 },
  { event: 9, likes: 5, comments: 0 },
  { event: 10, likes: 47, comments: 12 },
  { event: 12, likes: 18, comments: 2 },
];

/**
 * The post grid of экран 36: what this person published, newest first. Seeded history first (demo
 * account only, so the empty state stays reachable for everyone else), then everything they published
 * live through экран 06 — publishing a post must put a tile on the profile, not only into the wall.
 */
const deletedProfilePosts = new Set<string>();

/** Seeded profile tiles are not feed posts; DELETE /feed/:id still has to drop them from the grid. */
export function deleteMockProfilePost(postId: string, userId: string): boolean {
  if (userId !== mockDemoUser.id) return false;
  if (deletedProfilePosts.has(postId)) return false;
  const seededIds = MOCK_OWN_POST_HISTORY.map((_, index) => `33000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
  if (!seededIds.includes(postId)) return false;
  deletedProfilePosts.add(postId);
  return true;
}

export function userPostsFor(userId: string): ProfilePost[] {
  const seeded: ProfilePost[] = userId !== mockDemoUser.id ? [] : MOCK_OWN_POST_HISTORY.flatMap((row, index) => postTile(`33000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, mockEvents[row.event].id, null, row.likes, row.comments));
  const live = mockFeedPosts.filter((post) => post.author.id === userId).flatMap((post) => postTile(post.id, post.eventId, post.photoUrl, post.likesCount, post.comments.length));
  // Обе половины сложены по возрастанию времени, поэтому разворачивается общий список, а не каждая
  return [...seeded, ...live].reverse().filter((post) => !deletedProfilePosts.has(post.postId));
}

/** A post about an event the fixtures do not have is no tile at all: the cover has nowhere to come from. */
function postTile(postId: string, eventId: string | null, photoUrl: string | null, likesCount: number, commentsCount: number): ProfilePost[] {
  if (eventId === null) return [{ postId, eventId: null, eventTitle: "Пост", category: "afisha", photoUrl, likesCount, commentsCount }];
  const event = mockEvents.find((candidate) => candidate.id === eventId);
  return event === undefined ? [] : [{ postId, eventId, eventTitle: event.title, category: event.category, photoUrl, likesCount, commentsCount }];
}

/** What a user starts экран 41 with: the radius of «рядом», quiet hours at night, permissions granted. */
export const DEFAULT_APP_SETTINGS: Omit<AppSettings, "userId"> = {
  searchRadiusKm: 5,
  showOnMap: true,
  lookingForCompany: true,
  seatFreed: true,
  quietHours: true,
  quietHoursFrom: "23:00",
  quietHoursTo: "09:00",
  organizerMode: false,
  geoAccess: true,
  contactsAccess: true,
};

const mockAppSettings = new Map<string, AppSettings>();

export function appSettingsFor(userId: string): AppSettings {
  return mockAppSettings.get(userId) ?? { userId, ...DEFAULT_APP_SETTINGS };
}

export function updateMockAppSettings(userId: string, patch: UpdateAppSettings): AppSettings {
  const updated: AppSettings = { ...appSettingsFor(userId), ...patch, userId };
  mockAppSettings.set(userId, updated);
  return updated;
}

export function resetMockAppSettings(): void {
  mockAppSettings.clear();
}

export const mockProfiles = new Map<string, Profile>();

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
    mockProfiles.set(friend.id, { userId: friend.id, city: "Москва", interests: [...seed.interests], smartAlerts: { ...DEFAULT_SMART_ALERTS }, privacy: seed.routesHidden ? { visitHistory: "friends", routes: "hidden" } : { ...DEFAULT_PRIVACY }, recommendationsEnabled: true, bio: index === 0 ? "Афиша, выставки, долгие ужины." : "", coverUrl: null });
  });
}
seedMockProfiles();

export function resetMockProfiles(): void {
  seedMockProfiles();
  mockCustomAvatars.clear();
}

export function profileFor(userId: string): Profile {
  return mockProfiles.get(userId) ?? { userId, city: "Москва", interests: [], smartAlerts: { ...DEFAULT_SMART_ALERTS }, privacy: { ...DEFAULT_PRIVACY }, recommendationsEnabled: true, bio: "", coverUrl: null };
}

/** In-app avatars keyed by user id; the MAX photo stays on mockDemoUser until one is picked. */
export const mockCustomAvatars = new Map<string, string>();

export function userFor(userId: string): User | null {
  if (userId === mockDemoUser.id) return { ...mockDemoUser, avatarUrl: mockCustomAvatars.get(userId) ?? mockDemoUser.avatarUrl };
  const friend = mockFriends.find((person) => person.id === userId);
  if (friend === undefined) return null;
  const [firstName, ...rest] = friend.name.split(" ");
  return { id: friend.id, maxUserId: friend.id, firstName: firstName ?? friend.name, lastName: rest.join(" ") || null, username: null, avatarUrl: mockCustomAvatars.get(userId) ?? friend.avatarUrl, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };
}
