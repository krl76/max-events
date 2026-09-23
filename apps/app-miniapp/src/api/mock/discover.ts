// START_MODULE_CONTRACT
// PURPOSE: Mock discovery store: the today digest of экран 08, the guided suggestion wizard, the nearby timeline with its free-window chains, the NL assistant and the swipe deck of экран 09.
// SCOPE: Time-relative fixture selection, the deterministic assist heuristics and the seeded swipe deck; the HTTP surface is in ./discover.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MOCK_TODAY_ORIGIN - viewer coords the digest measures its distances from when the request carries none
// - todayPicks - digest of экран 08 from fixtures: summary counters plus curated cards, one of them carrying the after_me hint
// - SWIPE_CATEGORY_PLACES - which place categories each filter chip of экран 09 admits
// - mockSwipeSeeds - per-venue swipe fixtures: the offer, the area line, the amenities, the friends and the match score (#498)
// - mockSwipeDecisions - swipes taken in this session, keyed by place id; a decided venue leaves the deck
// - resetMockSwipeDecisions - clear the taken swipes (test isolation)
// - swipeCandidates - mock GET /discover/swipe: undecided venues of the chosen category, best match first
// - recordSwipeDecision - mock POST /discover/swipe/:placeId: remember the swipe; false for an unknown venue
// - nearbyTimeline - four-bucket nearby timeline from fixtures, haversine distance from the requested coords (mock GET /nearby)
// - leisureOptions - deterministic per-mood leisure chains from fixtures inside the free window (mock GET /nearby/free)
// - MOCK_ASSIST_RATE_LIMIT - assist rate limit (backend AssistRateLimiter parity: 20 hits / 10 min)
// - resetMockAssist - clear the assist rate-limit window (test isolation)
// - mockParseAssistQuery - deterministic NL criteria heuristics (backend parse-nl parity)
// - wheretoSuggestions - "Куда пойдём?" suggestions from upcoming fixtures (backend selectWheretoItems parity, max 5)
// - mockAssistSuggest - explained picks with history/partner explanations (mock POST /assist, backend AssistService.suggest parity)
// - mockAssistSaturdayKey - next Saturday (today counts) Moscow day key from MOCK_NOW (backend nextSaturdayKey parity)
// - mockAssistDay - upcoming Saturday stops (startsAt >= now) + planDraft, plan persisted when save=true (mock POST /assist/day, backend planSaturday parity)
// END_MODULE_MAP

import type { AssistCriteria, AssistDayResponse, AssistPick, AssistQueryWrite, AssistResponse, Event, EventCategory, Friend, LeisureMood, LeisureOption, LeisureStop, NearbyBucket, NearbyCard, NearbyTimeline, Place, PlaceCategory, PlanCard, WheretoMood, WheretoQuery, WheretoResponse } from "@max-events/api-contracts";
import type { SwipeCandidate, SwipeCategory, SwipeDecision, TodayCard, TodayDigest } from "../client";
import { mockCheckIns, remainingSeats } from "./bookings";
import { mockEventDistanceKm, mockEventRatingValue, placePageFor } from "./catalog";
import { HOUR_MS, MOCK_NOW, haversineKm, mockDemoUser, mockEvents, mockFriendIds, mockFriends, mockPlaces, moscowDateKey, moscowHour } from "./fixtures";
import { listsFor, mockListItems } from "./lists";
import { mockPlans, nextMockPlanId } from "./plans";

/** Where the digest measures from when the request carries no coordinates: the city centre the map opens on. */
export const MOCK_TODAY_ORIGIN = { latitude: 55.7522, longitude: 37.6156 };

/**
 * Digest of экран 08: curated cards from fixtures; the showcase friends (Анна → выставка, Катя →
 * фестиваль) back the friends counter. The last card carries the after_me hint — the label the design
 * shows as a dismissible card — next to the distance and the free seats it prints as its chips.
 * fromCategory is the word the sentence is built from (the contract types it as free text, not as the
 * EventCategory enum), so the mock answers the genitive the hint reads with.
 */
export function todayPicks(origin: { latitude: number; longitude: number } = MOCK_TODAY_ORIGIN): TodayDigest {
  const enrich = (event: Event, labels: TodayCard["labels"]): TodayCard => ({
    event,
    labels,
    distanceKm: mockEventDistanceKm(event, origin),
    rating: mockEventRatingValue(event.id),
    placeTitle: mockPlaces.find((place) => place.id === event.placeId)?.title ?? null,
  });
  const cards: TodayCard[] = [
    enrich(mockEvents[1], [
      { kind: "distance", minutes: 15 },
      { kind: "friend_attending", friendName: "Анна" },
    ]),
    enrich(mockEvents[11], [
      { kind: "distance", minutes: 20 },
      { kind: "friend_attending", friendName: "Катя" },
    ]),
    enrich(mockEvents[9], [{ kind: "free_entry" }, { kind: "spots_left", count: remainingSeats(mockEvents[9].id) ?? 0 }]),
    enrich(mockEvents[14], [
      { kind: "after_me", fromCategory: "джаза", afterCount: 4 },
      { kind: "distance", minutes: 8 },
      { kind: "spots_left", count: 12 },
    ]),
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

/** Which venue categories each filter chip of экран 09 admits; «all» admits every category there is. */
export const SWIPE_CATEGORY_PLACES: Record<SwipeCategory, readonly PlaceCategory[]> = {
  all: ["park", "museum", "food", "sport", "other"],
  food: ["food"],
  outdoors: ["park"],
  sport: ["sport"],
};

/**
 * Per-venue swipe fixtures (#498). None of this is in the backend: there is no candidate feed, no
 * amenity list on a place and nothing that scores a venue against a person, so the deck is seeded by
 * place id and answers the shape the future endpoint will.
 */
export const mockSwipeSeeds: Record<string, { offerLabel: string; areaLine: string; amenities: string[]; pricePerHourRub: number | null; matchPercent: number; friendIndexes: number[] }> = {
  [mockPlaces[0].id]: { offerLabel: "Мангальная зона", areaLine: "Парк Горького · набережная у пруда", amenities: ["навес от дождя", "розетка", "мангал и решётки"], pricePerHourRub: 800, matchPercent: 92, friendIndexes: [0, 1] },
  [mockPlaces[1].id]: { offerLabel: "Постоянная экспозиция", areaLine: "Волхонка · десять минут от метро", amenities: ["гардероб", "аудиогид", "кафе на первом этаже"], pricePerHourRub: null, matchPercent: 74, friendIndexes: [0] },
  [mockPlaces[2].id]: { offerLabel: "Падел-корты", areaLine: "Лужники · южное ядро", amenities: ["раздевалка", "аренда ракеток", "душ"], pricePerHourRub: 1200, matchPercent: 86, friendIndexes: [1, 3] },
  [mockPlaces[3].id]: { offerLabel: "Фудмолл", areaLine: "Тверская Застава · три этажа корнеров", amenities: ["веранда", "детский уголок", "работает до полуночи"], pricePerHourRub: null, matchPercent: 68, friendIndexes: [2] },
  [mockPlaces[4].id]: { offerLabel: "Летняя веранда", areaLine: "Крымский Вал · у входа в парк", amenities: ["навес от дождя", "розетка", "завтраки весь день"], pricePerHourRub: null, matchPercent: 81, friendIndexes: [2, 4] },
};

/** Swipes taken in this session; a venue the viewer has already judged does not come back in the deck. */
export const mockSwipeDecisions = new Map<string, SwipeDecision>();

/** Clear the taken swipes (test isolation). */
export function resetMockSwipeDecisions(): void {
  mockSwipeDecisions.clear();
}

function swipeCandidate(place: Place, origin: { latitude: number; longitude: number } | null): SwipeCandidate {
  const seed = mockSwipeSeeds[place.id];
  const page = placePageFor(place.id, mockDemoUser.id);
  const friends: Friend[] = (seed?.friendIndexes ?? []).flatMap((index) => (mockFriends[index] === undefined ? [] : [mockFriends[index]]));
  return {
    place,
    areaLine: seed?.areaLine ?? null,
    offerLabel: seed?.offerLabel ?? null,
    distanceKm: origin === null ? null : Math.round(haversineKm(origin.latitude, origin.longitude, place.latitude, place.longitude) * 10) / 10,
    rating: page?.rating === null || page?.rating === undefined ? null : Math.round(page.rating.summary.averageStars * 10) / 10,
    reviewsCount: page?.rating?.summary.reviewsCount ?? null,
    pricePerHourRub: seed?.pricePerHourRub ?? null,
    amenities: seed?.amenities ?? [],
    friendsHere: friends,
    matchPercent: seed?.matchPercent ?? null,
  };
}

/** Mock GET /discover/swipe: published venues of the chosen category the viewer has not judged yet, best match first. */
export function swipeCandidates(category: SwipeCategory = "all", origin: { latitude: number; longitude: number } | null = null): SwipeCandidate[] {
  const admitted = SWIPE_CATEGORY_PLACES[category];
  return mockPlaces
    .filter((place) => place.published !== false && admitted.includes(place.category) && !mockSwipeDecisions.has(place.id))
    .map((place) => swipeCandidate(place, origin))
    .sort((a, b) => (b.matchPercent ?? -1) - (a.matchPercent ?? -1) || a.place.id.localeCompare(b.place.id));
}

/** Mock POST /discover/swipe/:placeId: remember the swipe; false for a venue that does not exist. */
export function recordSwipeDecision(placeId: string, decision: SwipeDecision): boolean {
  if (!mockPlaces.some((place) => place.id === placeId && place.published !== false)) return false;
  mockSwipeDecisions.set(placeId, decision);
  return true;
}

const NEARBY_MAX_KM = 15;

/** Exclusive bucket of an event start relative to the demo now (mirrors the backend nearbyBucket). */
function mockNearbyBucket(startsAt: string, now: Date = MOCK_NOW): NearbyBucket | null {
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

/** Backend selectWheretoItems parity: mood -> categories, budget (!isPaid free / <=3000 under_3000), company soft filters, upcoming from MOCK_NOW, soonest first, max 5 (fixtures carry no published flag). */
export function wheretoSuggestions(query: WheretoQuery, now: Date = MOCK_NOW): WheretoResponse {
  const moodCategories: Record<WheretoMood, EventCategory[]> = { active: ["sport", "tourism"], calm: ["afisha"], unusual: ["volunteering", "tourism"] };
  return {
    items: mockEvents
      .filter((item) => new Date(item.startsAt).getTime() >= now.getTime())
      .filter((item) => moodCategories[query.mood].includes(item.category))
      .filter((item) => query.budget === "any" || !item.isPaid || (query.budget === "under_3000" && item.priceRub !== null && item.priceRub <= 3000))
      .filter((item) => query.company !== "partner" || item.category !== "volunteering")
      .filter((item) => query.company !== "kids" || (item.priceRub ?? 0) <= 3000)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
      .slice(0, 5),
  };
}

/** Backend matchAssistEvents parity: events from MOCK_NOW filtered by the parsed criteria, soonest first, max 7 (fixtures carry no published flag). */
function mockAssistMatches(criteria: AssistCriteria, now: Date = MOCK_NOW): Event[] {
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

/** Backend AssistService.planSaturday parity: up to 4 stops of the nearest Saturday, past hours excluded (startsAt >= now), + planDraft; with save=true the plan is persisted into the mock plans, plan is null otherwise; error tags map to 429/400 in the interceptor. */
export function mockAssistDay(payload: AssistQueryWrite, now: Date = MOCK_NOW): AssistDayResponse | MockAssistError {
  if (!mockAssistRateHit()) return "rate_limited";
  const cleaned = mockSanitizeAssistQuery(payload.query);
  if (!cleaned) return "invalid";
  const date = mockAssistSaturdayKey(now);
  const catalog = mockEvents
    .filter((item) => moscowDateKey(item.startsAt) === date && new Date(item.startsAt).getTime() >= now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .slice(0, 4);
  if (catalog.length === 0) return "no_events";
  const stops = catalog.map((stopEvent) => ({ at: stopEvent.startsAt, event: stopEvent, explanation: "Слот субботнего дня" }));
  const first = catalog[0];
  const planDraft = { eventId: first.id, participantIds: [] as string[], meetingPoint: first.title, meetingAt: first.startsAt };
  let plan: PlanCard | null = null;
  if (payload.save === true) {
    const now = new Date().toISOString();
    plan = { plan: { id: nextMockPlanId(), hostUserId: mockDemoUser.id, eventId: planDraft.eventId, participants: [], meetingPoint: planDraft.meetingPoint, meetingAt: planDraft.meetingAt, chatLink: null, recurringRule: null, seriesId: null, createdAt: now, updatedAt: now }, event: first, distanceMeters: 0 };
    mockPlans.push(plan);
  }
  return { summary: `Собрал день на субботу ${date}: ${stops.length} событий`, date, stops, planDraft, plan };
}
