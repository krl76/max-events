// START_MODULE_CONTRACT
// PURPOSE: Mock plan store: plan cards and their series, the shared budget, the autoplan draft, day routes, the plan timeline of макет экрана 15, the calendar and the calendar shared with a friend (макет, экран 22).
// SCOPE: In-memory plans, expenses, timelines, the shared calendar and route building; the HTTP surface is in ./plans.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockPlans - plan card fixtures for the plans list and plan screens; the demo plan carries a chat link, the second one none (backend P1-7-b does not exist yet)
// - createMockPlan - mock POST /plans: the manual plan plus the occurrences of its series
// - cancelMockPlan - mock DELETE /plans/:id: one meeting or the whole series
// - resetMockPlans - restore seeded plan cards, dropping autoplan drafts (test isolation)
// - planCards - plan fixtures sorted by the soonest meeting first
// - planCard - single plan card by plan id (or null)
// - mockPlanExpenses - shared with groups
// - nextMockPlanId - Next plan id off the shared plan sequence; the assist day builder persists its plan through the same counter
// - resetMockPlanExpenses - Restore the seeded plan expenses (test isolation); the we-group reset shares this store
// - mockBudgetFromExpenses - expenses -> per-person nets + debts (backend budgetFromExpenses parity, incl. the id-rotated remainder split)
// - mockPlanBudget - mock GET /plans/:id/budget (404 unknown plan)
// - addMockPlanExpense - Mock POST /plans/:id/expenses (backend addExpense parity): 404 unknown plan; 400 payer/shares outside the party; the demo host may attribute payments to any party member
// - calendarEntries - active bookings of a user enriched with event and place
// - createMockAutoPlan - autoplan after «Пойду»: saved draft plan + walk estimate + food picks + dinner->road->meetup->event timeline (mock POST /plans/auto, backend parity)
// - mockDayRoute - Ordered points -> walking legs and totals (backend toDayRoute parity)
// - buildMockDayRoute - resolve 2..8 event/place stops to points and haversine walking legs (mock POST /routes, backend parity)
// - optimizeMockDayRoute - keep-first permutation minimizing the total distance, with savings (mock POST /routes/optimize)
// - mockPlanTimeline - dinner -> ride -> meeting -> event steps of макет экрана 15 (mock GET /plans/:id/timeline; the ride is the #504 gap)
// - openMockPlanChat - mock POST /plans/:id/chat: issues the chat link P1-7-b will issue
// - addMockPlanParticipant - mock POST /plans/:id/participants (backend addParticipant parity: host only, friends only, no duplicates)
// - mockSharedCalendar - mock GET /calendar/shared: the peer records of макет экрана 22
// - joinMockSharedCalendarEntry - mock POST /calendar/shared/entries/:id/going: «Пойду» on a peer record
// - addMockSharedCalendarPeer - mock POST /calendar/shared/peers: share the calendar with one more friend
// - resetMockSharedCalendar - restore the seeded shared calendar (test isolation)
// END_MODULE_MAP

import { upcomingRecurringAts } from "@max-events/api-contracts";
import type { AutoPlanProposal, AutoPlanTimelineEntry, Booking, CreateAutoPlanWrite, CreateDayRouteWrite, CreatePlanExpenseWrite, CreatePlanWrite, DayRoute, Event, EventCategory, Friend, OptimizeRoute, Place, PlanBudget, PlanCancelScope, PlanCard, PlanDebt, PlanParticipant, RouteLeg, RoutePoint } from "@max-events/api-contracts";
import type { PlanTimeline, PlanTimelineStep, SharedCalendar, SharedCalendarEntry, SharedCalendarPeer } from "../client";
import { mockBookings } from "./bookings";
import { PLACE_STAMP, haversineKm, haversineMeters, mockDemoUser, mockEvents, mockFriendIds, mockFriends, mockPlaces } from "./fixtures";

/** Plans fixtures for the plans list and plan screens (backend P1-7-b does not exist yet); events reference mockEvents, distance is precomputed to the meeting point. */
export const mockPlans: PlanCard[] = [
  {
    plan: {
      id: "90000000-0000-4000-8000-000000000001",
      hostUserId: "a0000000-0000-4000-8000-000000000001",
      eventId: mockEvents[0].id,
      participants: [
        { friend: mockFriends[0], status: "confirmed" },
        { friend: mockFriends[1], status: "confirmed" },
        { friend: mockFriends[2], status: "invited" },
      ],
      meetingPoint: "у метро Смоленская",
      meetingAt: "2026-09-19T18:20:00+03:00",
      chatLink: "https://max.ru/chat/mock-plan-1",
      recurringRule: null,
      seriesId: null,
      createdAt: PLACE_STAMP,
      updatedAt: PLACE_STAMP,
    },
    event: mockEvents[0],
    distanceMeters: 850,
  },
  {
    plan: {
      id: "90000000-0000-4000-8000-000000000002",
      hostUserId: "a0000000-0000-4000-8000-000000000001",
      eventId: mockEvents[2].id,
      participants: [
        { friend: mockFriends[3], status: "confirmed" },
        { friend: mockFriends[4], status: "declined" },
      ],
      meetingPoint: "у входа в Парк Горького",
      meetingAt: "2026-09-20T09:30:00+03:00",
      chatLink: null,
      recurringRule: null,
      seriesId: null,
      createdAt: PLACE_STAMP,
      updatedAt: PLACE_STAMP,
    },
    event: mockEvents[2],
    distanceMeters: 1200,
  },
];

/** Backend parity: a new series spawns its four nearest occurrences up front (PlansService.spawnSeries). */
const MOCK_SERIES_SPAWN = 4;

/** Cancelled plans stay out of the list, the way the backend hides a soft-cancelled one. */
const mockCancelledPlanIds = new Set<string>();

/** Plans the assistant put together — behind the «MAX СОБРАЛ» badge of макета экрана 15; the demo plan is seeded as one, every autoplan draft joins it. */
const mockMaxAssembledPlanIds = new Set<string>([mockPlans[0].plan.id]);

/**
 * Mock POST /plans: the manual plan, plus the occurrences of its series. The template carries the rule
 * and every plan of the series carries the seriesId, so the screen can offer «эта встреча» or «вся серия».
 */
export function createMockPlan(payload: CreatePlanWrite, now = new Date()): PlanCard | "no_event" {
  const event = mockEvents.find((item) => item.id === payload.eventId);
  if (!event) return "no_event";
  const stamp = new Date().toISOString();
  const nextId = () => {
    mockPlanSeq += 1;
    return `90000000-0000-4000-8000-${String(mockPlanSeq).padStart(12, "0")}`;
  };
  const participants = payload.participantIds.flatMap((id) => {
    const friend = mockFriends.find((row) => row.id === id);
    return friend ? [{ friend, status: "invited" as const }] : [];
  });
  const rule = payload.recurringRule ?? null;
  const templateId = nextId();
  const template: PlanCard = {
    plan: { id: templateId, hostUserId: mockDemoUser.id, eventId: event.id, participants, meetingPoint: payload.meetingPoint, meetingAt: payload.meetingAt, chatLink: null, recurringRule: rule, seriesId: rule === null ? null : templateId, createdAt: stamp, updatedAt: stamp },
    event,
    distanceMeters: 0,
  };
  mockPlans.push(template);
  if (rule === null) return template;
  const meetingAt = new Date(payload.meetingAt);
  for (const at of upcomingRecurringAts(meetingAt, rule, meetingAt > now ? meetingAt : now, MOCK_SERIES_SPAWN)) {
    mockPlans.push({
      // An occurrence carries no rule of its own; the backend resolves the series rule for the DTO.
      plan: { ...template.plan, id: nextId(), meetingAt: at.toISOString(), recurringRule: rule, seriesId: templateId, createdAt: stamp, updatedAt: stamp },
      event,
      distanceMeters: 0,
    });
  }
  return template;
}

/** Mock DELETE /plans/:id: one meeting, or every plan of the series when scope says so. */
export function cancelMockPlan(planId: string, scope: PlanCancelScope): "ok" | "no_plan" {
  const card = mockPlans.find((row) => row.plan.id === planId && !mockCancelledPlanIds.has(row.plan.id));
  if (!card) return "no_plan";
  const seriesId = card.plan.seriesId;
  const doomed = scope === "series" && seriesId !== null ? mockPlans.filter((row) => row.plan.seriesId === seriesId) : [card];
  for (const row of doomed) mockCancelledPlanIds.add(row.plan.id);
  return "ok";
}

const MOCK_PLAN_SEED = [...mockPlans];

let mockPlanSeq = MOCK_PLAN_SEED.length;

/** Restore the seeded plan cards, dropping autoplan drafts (test isolation). */
export function resetMockPlans(): void {
  mockCancelledPlanIds.clear();
  mockPlans.length = 0;
  mockPlans.push(...MOCK_PLAN_SEED);
  mockPlanSeq = MOCK_PLAN_SEED.length;
  mockPlanChatLinks.clear();
  mockPlanExtraParticipants.clear();
  mockMaxAssembledPlanIds.clear();
  mockMaxAssembledPlanIds.add(MOCK_PLAN_SEED[0].plan.id);
}

/**
 * What POST /plans/:id/chat and POST /plans/:id/participants wrote, kept beside the seeded cards instead
 * of inside them: the seed array holds the very objects it restores, so a mutation would survive the reset.
 */
const mockPlanChatLinks = new Map<string, string>();

const mockPlanExtraParticipants = new Map<string, PlanParticipant[]>();

function withMockPlanOverlay(card: PlanCard): PlanCard {
  const chatLink = mockPlanChatLinks.get(card.plan.id);
  const extra = mockPlanExtraParticipants.get(card.plan.id);
  if (chatLink === undefined && extra === undefined) return card;
  return { ...card, plan: { ...card.plan, chatLink: chatLink ?? card.plan.chatLink, participants: extra === undefined ? card.plan.participants : [...card.plan.participants, ...extra] } };
}

/** Plans of the demo user enriched with event and distance, soonest meeting first. */
export function planCards(): PlanCard[] {
  // A cancelled plan is hidden rather than deleted, the way the backend soft-cancels a series slot.
  return mockPlans
    .filter((row) => !mockCancelledPlanIds.has(row.plan.id))
    .sort((a, b) => a.plan.meetingAt.localeCompare(b.plan.meetingAt))
    .map(withMockPlanOverlay);
}

/** Single plan card by plan id, or null. */
export function planCard(id: string): PlanCard | null {
  const found = mockPlans.find((card) => card.plan.id === id && !mockCancelledPlanIds.has(card.plan.id));
  return found === undefined ? null : withMockPlanOverlay(found);
}

/** In-memory plan expense row (PlanExpenseEntity parity: createdAt stored as ISO). */
interface MockPlanExpense {
  id: string;
  planId: string;
  title: string;
  amountRub: number;
  payerUserId: string;
  shareUserIds: string[];
  createdAt: string;
}

const PLAN_ONE_ID = "90000000-0000-4000-8000-000000000001";

const PLAN_TWO_ID = "90000000-0000-4000-8000-000000000002";

const MOCK_PLAN_EXPENSE_SEED: MockPlanExpense[] = [
  { id: "96000000-0000-4000-8000-000000000001", planId: PLAN_ONE_ID, title: "Билеты", amountRub: 3600, payerUserId: mockDemoUser.id, shareUserIds: [mockDemoUser.id, mockFriendIds[0], mockFriendIds[1]], createdAt: "2026-08-01T12:00:00+03:00" },
  { id: "96000000-0000-4000-8000-000000000002", planId: PLAN_ONE_ID, title: "Кафе после концерта", amountRub: 1000, payerUserId: mockFriendIds[0], shareUserIds: [mockDemoUser.id, mockFriendIds[0], mockFriendIds[1]], createdAt: "2026-08-01T12:01:00+03:00" },
  { id: "96000000-0000-4000-8000-000000000003", planId: PLAN_TWO_ID, title: "Завтрак перед субботником", amountRub: 1001, payerUserId: mockDemoUser.id, shareUserIds: [mockDemoUser.id, mockFriendIds[3]], createdAt: "2026-08-01T12:02:00+03:00" },
  { id: "96000000-0000-4000-8000-000000000004", planId: PLAN_TWO_ID, title: "Проезд", amountRub: 300, payerUserId: mockFriendIds[3], shareUserIds: [mockDemoUser.id, mockFriendIds[3]], createdAt: "2026-08-01T12:03:00+03:00" },
];

export const mockPlanExpenses: MockPlanExpense[] = [...MOCK_PLAN_EXPENSE_SEED];

let mockPlanExpenseSeq = MOCK_PLAN_EXPENSE_SEED.length;

/** Next plan id off the shared plan sequence; the assist day builder persists its plan through the same counter. */
export function nextMockPlanId(): string {
  mockPlanSeq += 1;
  return `90000000-0000-4000-8000-${String(mockPlanSeq).padStart(12, "0")}`;
}

/** Restore the seeded plan expenses (test isolation); the we-group reset shares this store. */
export function resetMockPlanExpenses(): void {
  mockPlanExpenses.length = 0;
  mockPlanExpenses.push(...MOCK_PLAN_EXPENSE_SEED);
  mockPlanExpenseSeq = MOCK_PLAN_EXPENSE_SEED.length;
}

/** Backend settleBalances parity: greedy debtor->creditor settle, debtors by balance asc/id, creditors by balance desc/id. */
function mockSettleBalances(balances: Map<string, number>): PlanDebt[] {
  const debtors = [...balances.entries()].filter(([, value]) => value < 0).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const creditors = [...balances.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const debts: PlanDebt[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(-debtors[i]![1], creditors[j]![1]);
    if (pay > 0) debts.push({ fromUserId: debtors[i]![0], toUserId: creditors[j]![0], amountRub: pay });
    debtors[i]![1] += pay;
    creditors[j]![1] -= pay;
    if (debtors[i]![1] === 0) i += 1;
    if (creditors[j]![1] === 0) j += 1;
  }
  return debts;
}

/** Backend budgetFromExpenses parity, incl. the remainder split rotated by the expense-id charcode offset. */
export function mockBudgetFromExpenses(rows: MockPlanExpense[], extraParty: Iterable<string> = []): PlanBudget {
  const ordered = [...rows].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
  const party = new Set(extraParty);
  for (const row of ordered) {
    party.add(row.payerUserId);
    for (const id of row.shareUserIds) party.add(id);
  }
  const people = [...party].sort();
  const paid = new Map(people.map((id) => [id, 0]));
  const share = new Map(people.map((id) => [id, 0]));
  for (const row of ordered) {
    paid.set(row.payerUserId, (paid.get(row.payerUserId) ?? 0) + row.amountRub);
    const ids = [...new Set(row.shareUserIds)].sort();
    if (ids.length === 0) continue;
    const n = ids.length;
    const base = Math.floor(row.amountRub / n);
    const rem = row.amountRub % n;
    const offset = [...row.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % n;
    ids.forEach((id, index) => {
      const extra = rem > 0 && (index - offset + n) % n < rem ? 1 : 0;
      share.set(id, (share.get(id) ?? 0) + base + extra);
    });
  }
  const balances = new Map(people.map((id) => [id, (paid.get(id) ?? 0) - (share.get(id) ?? 0)]));
  return {
    expenses: ordered.map((row) => ({ id: row.id, planId: row.planId, title: row.title, amountRub: row.amountRub, payerUserId: row.payerUserId, shareUserIds: [...row.shareUserIds], createdAt: row.createdAt })),
    perPerson: people.map((userId) => ({ userId, paidRub: paid.get(userId) ?? 0, shareRub: share.get(userId) ?? 0, netRub: balances.get(userId) ?? 0 })),
    debts: mockSettleBalances(balances),
    totalRub: ordered.reduce((sum, row) => sum + row.amountRub, 0),
  };
}

/** Backend spendPartyIds parity: the mock serves the demo user as the host of every seeded plan, so the party is the host + confirmed participants. */
function mockSpendPartyIds(planId: string): Set<string> {
  const card = planCard(planId);
  const confirmed = card ? card.plan.participants.filter((row) => row.status === "confirmed").map((row) => row.friend.id) : [];
  return new Set([mockDemoUser.id, ...confirmed]);
}

/** Mock GET /plans/:id/budget: 404 unknown plan; the demo user hosts every seeded plan, so canView always passes. */
export function mockPlanBudget(planId: string): PlanBudget | null {
  if (!planCard(planId)) return null;
  const rows = mockPlanExpenses.filter((row) => row.planId === planId);
  return mockBudgetFromExpenses(rows, mockSpendPartyIds(planId));
}

/** Mock POST /plans/:id/expenses (backend addExpense parity): 404 unknown plan; 400 payer/shares outside the party; the demo host may attribute payments to any party member. */
export function addMockPlanExpense(planId: string, payload: CreatePlanExpenseWrite): PlanBudget | null | "invalid" {
  if (!planCard(planId)) return null;
  const party = mockSpendPartyIds(planId);
  if (!party.has(payload.payerUserId) || payload.shareUserIds.some((id) => !party.has(id))) return "invalid";
  mockPlanExpenseSeq += 1;
  mockPlanExpenses.push({ id: `96000000-0000-4000-8000-${String(mockPlanExpenseSeq).padStart(12, "0")}`, planId, title: payload.title.trim(), amountRub: payload.amountRub, payerUserId: payload.payerUserId, shareUserIds: [...new Set(payload.shareUserIds)], createdAt: new Date().toISOString() });
  return mockBudgetFromExpenses(
    mockPlanExpenses.filter((row) => row.planId === planId),
    party,
  );
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

// Backend plans.service parity: walking pace, food radius and the dinner->road->meetup->event buffers.
const WALK_M_PER_MIN = 80;

const FOOD_RADIUS_KM = 2;

const MEETUP_BUFFER_MIN = 20;

const DINNER_MIN = 70;

function walkingMinutes(meters: number): number {
  return Math.max(0, Math.round(meters / WALK_M_PER_MIN));
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
    plan: { id: `90000000-0000-4000-8000-${String(mockPlanSeq).padStart(12, "0")}`, hostUserId: mockDemoUser.id, eventId: event.id, participants: [], meetingPoint, meetingAt: meetupAt.toISOString(), chatLink: null, recurringRule: null, seriesId: null, createdAt: now, updatedAt: now },
    event,
    distanceMeters: meters,
  };
  mockPlans.push(card);
  mockMaxAssembledPlanIds.add(card.plan.id);
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
export function mockDayRoute(points: RoutePoint[]): DayRoute {
  const legs: RouteLeg[] = [];
  let totalMeters = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const meters = haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude);
    totalMeters += meters;
    legs.push({ fromTitle: from.title, toTitle: to.title, travelMinutes: walkingMinutes(meters), distanceKm: Math.round((meters / 1000) * 10) / 10, mode: "walk", transfers: 0, priceRub: null });
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

/* ---------- Макет, экран 15 «План на вечер»: таймлайн вечера ---------- */

// City taxi pace and fare the mock quotes until the routing domain learns about transport (#504).
const TAXI_M_PER_MIN = 420;

const TAXI_BASE_RUB = 200;

const TAXI_RUB_PER_KM = 60;

/** What the closing step of an evening is called: the design writes «Концерт», not «Событие». */
const MOCK_STEP_TITLE: Record<EventCategory, string> = { afisha: "Концерт", sport: "Спорт", tourism: "Экскурсия", volunteering: "Волонтёрство" };

function mockTaxiLeg(meters: number): { minutes: number; priceRub: number } {
  return { minutes: Math.max(5, Math.round(meters / TAXI_M_PER_MIN)), priceRub: Math.round((TAXI_BASE_RUB + (meters / 1000) * TAXI_RUB_PER_KM) / 10) * 10 };
}

function mockMoscowTime(at: Date): string {
  return at.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
}

/**
 * Mock GET /plans/:id/timeline: ужин -> дорога -> встреча -> событие (макет, экран 15). The dinner and the
 * meeting come out of the plan itself; the ride is the gap #504 names — the routing domain measures distance
 * and knows nothing about transport, so its mode, minutes and fare are the mock's, behind the final shape.
 * An event whose fixture carries no venue still gets a full evening: the anchor falls back to the first park.
 */
export function mockPlanTimeline(planId: string): PlanTimeline | null {
  const card = planCard(planId);
  if (card === null) return null;
  const { plan, event } = card;
  const anchor = (event.placeId === null ? null : (mockPlaces.find((item) => item.id === event.placeId) ?? null)) ?? mockPlaces[0];
  const food = mockPlaces
    .filter((item) => item.category === "food")
    .map((item) => ({ item, km: haversineKm(anchor.latitude, anchor.longitude, item.latitude, item.longitude) }))
    .sort((a, b) => a.km - b.km)[0]?.item;
  const meetingAt = new Date(plan.meetingAt);
  const steps: PlanTimelineStep[] = [];
  if (food !== undefined) {
    const ride = mockTaxiLeg(haversineMeters(food.latitude, food.longitude, anchor.latitude, anchor.longitude));
    const rideAt = new Date(meetingAt.getTime() - ride.minutes * 60_000);
    const dinnerAt = new Date(rideAt.getTime() - DINNER_MIN * 60_000);
    steps.push({ at: dinnerAt.toISOString(), title: "Ужин рядом", detail: `${food.title} · ${food.address}`, transfer: null, eventId: null });
    steps.push({ at: rideAt.toISOString(), title: "Дорога", detail: `Такси · ${ride.minutes} мин · ${ride.priceRub} ₽`, transfer: { mode: "taxi", minutes: ride.minutes, priceRub: ride.priceRub }, eventId: null });
  }
  steps.push({ at: plan.meetingAt, title: "Встреча", detail: `Сбор ${mockMoscowTime(meetingAt)} ${plan.meetingPoint}`, transfer: null, eventId: null });
  steps.push({ at: event.startsAt, title: MOCK_STEP_TITLE[event.category], detail: event.placeId === null ? `${event.title} · ${event.city}` : `${event.title} · ${anchor.title}`, transfer: null, eventId: event.id });
  return { assembledByMax: mockMaxAssembledPlanIds.has(planId), steps };
}

/** Mock POST /plans/:id/chat: hands out the link P1-7-b will hand out once the plan chat exists server-side. */
export function openMockPlanChat(planId: string): PlanCard | null {
  const card = planCard(planId);
  if (card === null) return null;
  if (card.plan.chatLink === null) mockPlanChatLinks.set(planId, `https://max.ru/chat/mock-plan-${planId.slice(-4)}`);
  return planCard(planId);
}

/** Mock POST /plans/:id/participants (backend addParticipant parity): the host only, friends only, no duplicates. */
export function addMockPlanParticipant(planId: string, userId: string): PlanCard | "no_plan" | "invalid" {
  const card = planCard(planId);
  if (card === null) return "no_plan";
  if (card.plan.hostUserId !== mockDemoUser.id || userId === mockDemoUser.id) return "invalid";
  const friend = mockFriends.find((row) => row.id === userId);
  if (friend === undefined) return "invalid";
  if (!card.plan.participants.some((row) => row.friend.id === userId)) {
    mockPlanExtraParticipants.set(planId, [...(mockPlanExtraParticipants.get(planId) ?? []), { friend, status: "invited" }]);
  }
  return planCard(planId) ?? "no_plan";
}

/* ---------- Макет, экран 22 «Календарь планов»: общий календарь ---------- */

function sharedEntry(id: string, owner: Friend, source: Event, bothGoing: boolean): SharedCalendarEntry {
  return { id, owner, title: source.title, startsAt: source.startsAt, endsAt: source.endsAt, bothGoing, needsResponse: !bothGoing, eventId: source.id };
}

/**
 * Seeded half of the shared calendar: what Анна put into it. The first record is the event the demo plan is
 * built around, so the design's «оба идёте» has something to be true about; the second runs from noon to nine
 * the same evening, which is the overlap the screen has to warn about.
 */
const MOCK_SHARED_ENTRY_SEED: SharedCalendarEntry[] = [sharedEntry("97000000-0000-4000-8000-000000000001", mockFriends[0], mockEvents[0], true), sharedEntry("97000000-0000-4000-8000-000000000002", mockFriends[0], mockEvents[1], false), sharedEntry("97000000-0000-4000-8000-000000000003", mockFriends[0], mockEvents[10], false)];

const MOCK_SHARED_PEER_SEED: SharedCalendarPeer[] = [{ friend: mockFriends[0], canEdit: true }];

const MOCK_SHARED_INVITE_URL = "https://max.ru/calendar/mock-shared";

const mockSharedEntries: SharedCalendarEntry[] = MOCK_SHARED_ENTRY_SEED.map((row) => ({ ...row }));

const mockSharedPeers: SharedCalendarPeer[] = MOCK_SHARED_PEER_SEED.map((row) => ({ ...row }));

/** Mock GET /calendar/shared: the peer half of the calendar (макет, экран 22); no notion of a shared record exists server-side. */
export function mockSharedCalendar(): SharedCalendar {
  return { peers: mockSharedPeers.map((row) => ({ ...row })), entries: [...mockSharedEntries].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((row) => ({ ...row })), inviteUrl: MOCK_SHARED_INVITE_URL };
}

/** Mock POST /calendar/shared/entries/:id/going: «Пойду» on a record the peer added. */
export function joinMockSharedCalendarEntry(entryId: string): SharedCalendar | null {
  const row = mockSharedEntries.find((item) => item.id === entryId);
  if (row === undefined) return null;
  row.bothGoing = true;
  row.needsResponse = false;
  return mockSharedCalendar();
}

/** Mock POST /calendar/shared/peers: share the calendar with one more friend, idempotently. */
export function addMockSharedCalendarPeer(userId: string): SharedCalendar | null {
  const friend = mockFriends.find((row) => row.id === userId);
  if (friend === undefined) return null;
  if (!mockSharedPeers.some((row) => row.friend.id === userId)) mockSharedPeers.push({ friend, canEdit: true });
  return mockSharedCalendar();
}

/** Restore the seeded shared calendar (test isolation). */
export function resetMockSharedCalendar(): void {
  mockSharedEntries.length = 0;
  mockSharedEntries.push(...MOCK_SHARED_ENTRY_SEED.map((row) => ({ ...row })));
  mockSharedPeers.length = 0;
  mockSharedPeers.push(...MOCK_SHARED_PEER_SEED.map((row) => ({ ...row })));
}
