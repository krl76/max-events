// Live smoke: run every GET endpoint used by the miniapp (apps/app-miniapp/src/api/client.ts)
// against a real backend and validate each response with the zod contracts, then create fixtures
// through the write API (plan, we-group, vote, gathering, micro-event, organizer event) and
// exercise the user write paths (participation, check-ins, profile, feed, lists, waitlist, reviews).
//
// Usage: bun tools/live-smoke.mjs [baseUrl]
//   baseUrl  — argv[2] or env SMOKE_BASE_URL, default http://localhost:3100/api
//   bot token — env SMOKE_BOT_TOKEN, default local-dev-token
//
// Exit code: 1 when any check FAILs; SKIP (no seed id) and SKIP-FAIL (KNOWN_FAILURES) do not fail the run.

import { createHmac } from "node:crypto";
import {
  AchievementSchema,
  AuthResponseSchema,
  BookingWithSeatsSchema,
  CalendarResponseSchema,
  CheckInSchema,
  DiscoveryResponseSchema,
  EventSalesReportSchema,
  EventSchema,
  FeedPostSchema,
  FriendActivityByFriendSchema,
  FriendAvailabilitySchema,
  FriendRouteSchema,
  FriendSchema,
  GatheringSchema,
  LeisureOptionSchema,
  ListItemSchema,
  ListSchema,
  MemoryPointSchema,
  MicroEventSchema,
  MyCitySummarySchema,
  NearbyTimelineSchema,
  OrganizerEventStatsSchema,
  OrganizerRatingResponseSchema,
  OrganizerSessionSchema,
  ParticipationSchema,
  ParticipationStatusSchema,
  PeopleResponseSchema,
  PlacePageSchema,
  PlaceSchema,
  PlanBudgetSchema,
  PlanCardSchema,
  ProfileSchema,
  PromoCampaignSchema,
  PromoCodeSchema,
  PromotionCampaignSchema,
  PromotionPlacementsSchema,
  RatingSummarySchema,
  ReviewSchema,
  StorySchema,
  TargetedPromotionsResponseSchema,
  TodayResponseSchema,
  UserSchema,
  VisitStatsSchema,
  VoteSchema,
  WaitlistEntrySchema,
  WeGroupScreenSchema,
  WheretoResponseSchema,
} from "../packages/api-contracts/src/index.js";

const BASE = process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3100/api";
const BOT_TOKEN = process.env.SMOKE_BOT_TOKEN ?? "local-dev-token";
const ORIGIN = { lat: "55.75", lng: "37.61", latitude: "55.75", longitude: "37.61" };

// Expected failures: printed as SKIP-FAIL, never fail the exit code.
// Currently empty: GET /api/stories landed with #431, so no check is expected to fail.
const KNOWN_FAILURES = [];

/** Signed MAX initData for a local bot token — https://dev.max.ru/docs/webapps/validation (secret = HMAC("WebAppData", token), hash over sorted URL-decoded pairs). */
function buildInitData(token, user = { id: 777000111, first_name: "Smoke", last_name: "Runner", username: "max_events_smoke" }) {
  const pairs = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify(user),
  };
  const dataCheckString = Object.keys(pairs)
    .sort()
    .map((key) => `${key}=${pairs[key]}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const encoded = Object.entries(pairs)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `${encoded}&hash=${hash}`;
}

// --- client-side aggregate validators, mirroring apps/app-miniapp/src/api/client.ts (no new deps: contract schemas + plain checks) ---

const ok = (data) => ({ success: true, data });
const fail = (error) => ({ success: false, error });
const via = (schema) => (value) => schema.safeParse(value);
const strOrNull = (value) => (value === null || typeof value === "string" ? ok(value) : fail("expected string|null"));
const numOrNull = (value) => (value === null || typeof value === "number" ? ok(value) : fail("expected number|null"));

function objectOf(name, fields) {
  return {
    safeParse(data) {
      if (typeof data !== "object" || data === null) return fail(`${name}: expected an object`);
      const out = {};
      for (const [key, validate] of Object.entries(fields)) {
        const res = validate(data[key]);
        if (!res.success) return fail(`${name}.${key}: ${typeof res.error === "string" ? res.error : "schema mismatch"}`);
        out[key] = res.data;
      }
      return ok(out);
    },
  };
}

function arrayOf(name, itemSchema) {
  return {
    safeParse(data) {
      if (!Array.isArray(data)) return fail(`${name}: expected an array`);
      for (const item of data) {
        const res = itemSchema.safeParse(item);
        if (!res.success) return fail(`${name}[]: schema mismatch`);
      }
      return ok(data);
    },
  };
}

const EventDetailsSchema = objectOf("EventDetails", { event: via(EventSchema), place: (v) => (v === null ? ok(null) : PlaceSchema.safeParse(v)), organizer: (v) => (v === null ? ok(null) : UserSchema.safeParse(v)), remainingSeats: numOrNull, activeBookingId: strOrNull, checkInId: strOrNull });

const ParticipationStatsSchema = objectOf("ParticipationStats", {
  counts: (value) => {
    if (typeof value !== "object" || value === null) return fail("expected an object");
    for (const [status, count] of Object.entries(value)) {
      if (!ParticipationStatusSchema.safeParse(status).success || typeof count !== "number") return fail("invalid counts");
    }
    return ok(value);
  },
  friendsCount: (v) => (typeof v === "number" ? ok(v) : fail("expected number")),
  myStatus: (v) => (v === null ? ok(null) : ParticipationStatusSchema.safeParse(v)),
});

const ListSummaryArraySchema = arrayOf("ListSummary", objectOf("ListSummary", { list: via(ListSchema), itemsCount: (v) => (typeof v === "number" ? ok(v) : fail("expected number")), savedItemId: strOrNull, participants: (v) => (v === undefined ? ok([]) : FriendSchema.array().safeParse(v)) }));

const ListItemCardSchema = objectOf("ListItemCard", { item: via(ListItemSchema), event: via(EventSchema), addedBy: (v) => (v === null || v === undefined ? ok(null) : FriendSchema.safeParse(v)) });
const ListScreenSchema = objectOf("ListScreen", { list: via(ListSchema), participants: via(FriendSchema.array()), items: via(arrayOf("ListItemCard", ListItemCardSchema)) });

const MyCityPayloadSchema = objectOf("MyCityPayload", { summary: via(MyCitySummarySchema), points: via(MemoryPointSchema.array()) });

const nullishNumber = (v) => (v === null || v === undefined || typeof v === "number" ? ok(v ?? null) : fail("expected number|null"));
const EventRatingSchema = objectOf("EventRating", { summary: via(RatingSummarySchema), categoryAverages: via(objectOf("categoryAverages", { atmosphere: nullishNumber, organization: nullishNumber, price: nullishNumber, place: nullishNumber })) });

// Organizer list items are the contract entity plus a client-side draft flag; the entity part is what the backend owes us.
const OrganizerEventArraySchema = EventSchema.array();
const OrganizerPlaceArraySchema = PlaceSchema.array();

// --- check table (every frontend GET; order matters: bootstrap rows feed ids to the parametrized ones) ---

const ctx = { userId: null, partnerUserId: null, eventId: null, eventIds: [], placeId: null, friendId: null, listId: null, planId: null, weGroupId: null, voteId: null, gatheringId: null, microEventId: null, feedPostId: null, listItemId: null, organizerEventId: null };
const pick = (key, select) => (body) => {
  const value = select(body);
  if (typeof value === "string") ctx[key] = value;
};

const CHECKS = [
  { path: "/stories", schema: StorySchema.array() },
  {
    path: "/events",
    schema: EventSchema.array(),
    pick: (b) => {
      pick("eventId", (x) => x[0]?.id)(b);
      if (Array.isArray(b)) ctx.eventIds = b.map((row) => row?.id).filter((id) => typeof id === "string");
    },
  },
  { path: "/places", schema: PlaceSchema.array(), pick: pick("placeId", (b) => b[0]?.id) },
  { path: "/friends", schema: FriendSchema.array(), pick: pick("friendId", (b) => b[0]?.id) },
  { path: () => `/lists?userId=${ctx.userId}`, schema: ListSummaryArraySchema, pick: pick("listId", (b) => b[0]?.list?.id) },
  { path: () => `/plans?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`, schema: PlanCardSchema.array(), pick: pick("planId", (b) => b[0]?.plan?.id ?? b[0]?.id) },
  { path: "/we-groups", schema: WeGroupScreenSchema.array(), pick: pick("weGroupId", (b) => b[0]?.group?.id ?? b[0]?.id) },
  // backend-only list endpoint used solely to source a vote id for GET /votes/:id
  { path: "/votes", schema: VoteSchema.array(), note: "bootstrap for /votes/:id (not called by the miniapp)", pick: pick("voteId", (b) => b[0]?.id) },
  { path: () => (ctx.eventId ? `/events/${ctx.eventId}` : null), schema: EventSchema, skipReason: "no events (empty bootstrap list)", label: "/events/:id" },
  { path: () => (ctx.eventId ? `/events/${ctx.eventId}/details?userId=${ctx.userId}` : null), schema: EventDetailsSchema, skipReason: "no events (empty bootstrap list)", label: "/events/:id/details" },
  { path: () => (ctx.eventId ? `/events/${ctx.eventId}/participation/stats?userId=${ctx.userId}` : null), schema: ParticipationStatsSchema, skipReason: "no events (empty bootstrap list)", label: "/events/:id/participation/stats" },
  { path: () => (ctx.eventId ? `/events/${ctx.eventId}/rating` : null), schema: EventRatingSchema, skipReason: "no events (empty bootstrap list)", label: "/events/:id/rating" },
  { path: () => (ctx.eventId ? `/events/${ctx.eventId}/organizer-rating` : null), schema: OrganizerRatingResponseSchema, skipReason: "no events (empty bootstrap list)", label: "/events/:id/organizer-rating" },
  { path: () => (ctx.placeId ? `/places/${ctx.placeId}` : null), schema: PlaceSchema, skipReason: "no places (empty bootstrap list)", label: "/places/:id" },
  { path: () => (ctx.placeId ? `/places/${ctx.placeId}/page?userId=${ctx.userId}` : null), schema: PlacePageSchema, skipReason: "no places (empty bootstrap list)", label: "/places/:id/page" },
  { path: "/profile", schema: ProfileSchema },
  { path: () => `/users/${ctx.userId}/visit-stats`, schema: VisitStatsSchema },
  { path: () => `/users/${ctx.userId}/achievements`, schema: AchievementSchema.array() },
  { path: () => `/users/${ctx.userId}/my-city`, schema: MyCityPayloadSchema },
  { path: "/calendar", schema: CalendarResponseSchema },
  { path: () => `/friends/activity?userId=${ctx.userId}`, schema: FriendActivityByFriendSchema.array() },
  { path: () => (ctx.eventId ? `/friends/availability?eventId=${ctx.eventId}` : null), schema: FriendAvailabilitySchema.array(), skipReason: "no events (empty bootstrap list)", label: "/friends/availability" },
  { path: () => `/today?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`, schema: TodayResponseSchema },
  { path: () => `/nearby?latitude=${ORIGIN.latitude}&longitude=${ORIGIN.longitude}`, schema: NearbyTimelineSchema },
  { path: () => `/nearby/free?hours=2&mood=relax&latitude=${ORIGIN.latitude}&longitude=${ORIGIN.longitude}`, schema: LeisureOptionSchema.array() },
  { path: () => (ctx.listId ? `/lists/${ctx.listId}` : null), schema: ListScreenSchema, skipReason: "no lists (empty bootstrap list)", label: "/lists/:id" },
  { path: () => (ctx.eventId ? `/feed?eventId=${ctx.eventId}` : null), schema: FeedPostSchema.array(), skipReason: "no events (empty bootstrap list)", label: "/feed" },
  { path: "/micro-events", schema: MicroEventSchema.array() },
  { path: "/discovery", schema: DiscoveryResponseSchema },
  { path: () => (ctx.friendId ? `/discovery/friends/${ctx.friendId}/route` : null), schema: FriendRouteSchema, skipReason: "no friends (empty bootstrap list)", label: "/discovery/friends/:userId/route" },
  { path: () => `/people?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`, schema: PeopleResponseSchema },
  { path: "/whereto?company=friends&mood=active&budget=any", schema: WheretoResponseSchema },
  { path: "/promotions/placements", schema: PromotionPlacementsSchema },
  { path: "/promotions/for-me", schema: TargetedPromotionsResponseSchema },
  { path: "/organizer/events", schema: OrganizerEventArraySchema },
  { path: "/organizer/places", schema: OrganizerPlaceArraySchema },
  { path: () => `/organizers/${ctx.userId}/rating`, schema: OrganizerRatingResponseSchema },
  // the miniapp reads 404 here as "no waitlist entry" (getMyWaitlistEntry -> null)
  { path: () => (ctx.eventId ? `/waitlist/me?eventId=${ctx.eventId}&userId=${ctx.userId}` : null), schema: WaitlistEntrySchema, allowStatuses: [404], note: "404 is the contract for 'no entry'", skipReason: "no events (empty bootstrap list)", label: "/waitlist/me" },
];

// --- fixture writes: create the entities the read-only phase has no ids for, then run every user write path ---
// Order matters: rows consume ids picked by the rows above them; a failed row leaves its id null
// and every row below SKIPs instead of cascading into unrelated 404/409 FAILs.

const futureISO = () => new Date(Date.now() + 48 * 3600 * 1000).toISOString();

const WRITE_CHECKS = [
  // Organizer flow: the miniapp calls POST /auth/organizer/login (see main), but the backend guards
  // organizer endpoints with the regular MAX initData session, so the smoke user acts as the organizer.
  // capacity 1: one booking fills the event, which the waitlist row below requires.
  { method: "POST", path: "/organizer/events", body: () => ({ title: `Smoke event ${new Date().toISOString()}`, description: "live-smoke fixture", category: "afisha", city: "Москва", placeId: null, startsAt: futureISO(), endsAt: null, isPaid: false, priceRub: null, paymentUrl: null, capacity: 1 }), schema: EventSchema, note: "draft", pick: pick("organizerEventId", (b) => b?.id) },
  { method: "POST", path: () => (ctx.organizerEventId ? `/organizer/events/${ctx.organizerEventId}/publish` : null), skipReason: "organizer event draft was not created", schema: EventSchema },
  // The booking fills the capacity-1 event and is the prerequisite for POST /reviews (booked users only).
  { method: "POST", path: () => (ctx.organizerEventId ? "/bookings" : null), skipReason: "organizer event draft was not created", body: () => ({ userId: ctx.userId, eventId: ctx.organizerEventId }), schema: BookingWithSeatsSchema },
  // Partner user: the waitlist only accepts a full event the joining user has not booked themselves.
  { method: "POST", path: () => (ctx.organizerEventId ? "/waitlist" : null), as: "partner", skipReason: "organizer event draft was not created", body: () => ({ eventId: ctx.organizerEventId }), schema: WaitlistEntrySchema },
  { method: "POST", path: () => (ctx.organizerEventId ? "/reviews" : null), skipReason: "organizer event draft was not created", body: () => ({ eventId: ctx.organizerEventId, stars: 5, wouldGoAgain: true, text: "live-smoke review" }), schema: ReviewSchema },
  { method: "POST", path: () => (ctx.eventId ? "/plans" : null), skipReason: "no events (empty bootstrap list)", body: () => ({ eventId: ctx.eventId, participantIds: [], meetingPoint: "У центрального входа", meetingAt: futureISO() }), schema: PlanCardSchema, pick: pick("planId", (b) => b?.plan?.id) },
  { method: "POST", path: "/we-groups", body: () => ({ title: `Smoke we-group ${new Date().toISOString()}`, memberIds: [] }), schema: WeGroupScreenSchema, pick: pick("weGroupId", (b) => b?.group?.id) },
  { method: "POST", path: () => (ctx.weGroupId && ctx.eventId ? `/we-groups/${ctx.weGroupId}/events` : null), skipReason: "we-group or events missing", body: () => ({ eventId: ctx.eventId }), schema: WeGroupScreenSchema },
  { method: "POST", path: () => (ctx.weGroupId && ctx.placeId ? `/we-groups/${ctx.weGroupId}/places` : null), skipReason: "we-group or places missing", body: () => ({ placeId: ctx.placeId }), schema: WeGroupScreenSchema },
  { method: "POST", path: () => (ctx.eventIds.length >= 2 && ctx.friendId ? "/votes" : null), skipReason: "vote needs two published events and a friend", body: () => ({ title: "Куда идём в пятницу?", eventIds: [ctx.eventIds[0], ctx.eventIds[1]], participantIds: [ctx.friendId] }), schema: VoteSchema, pick: pick("voteId", (b) => b?.id) },
  { method: "POST", path: () => (ctx.voteId ? `/votes/${ctx.voteId}/ballots` : null), skipReason: "vote was not created", body: () => ({ eventId: ctx.eventIds[0] }), schema: VoteSchema },
  { method: "POST", path: () => (ctx.eventId && ctx.friendId ? "/gatherings" : null), skipReason: "gathering needs an event and a friend", body: () => ({ eventId: ctx.eventId, friendIds: [ctx.friendId], proposedMeetingAt: futureISO() }), schema: GatheringSchema, pick: pick("gatheringId", (b) => b?.id) },
  { method: "POST", path: "/micro-events", body: () => ({ title: `Smoke micro-event ${new Date().toISOString()}`, startsAt: futureISO(), locationText: "Парк Горького, главный вход", participantsLimit: 6 }), schema: MicroEventSchema, pick: pick("microEventId", (b) => b?.id) },
  // Partner user: the micro-event author is an auto-participant, so join/leave is only meaningful for someone else.
  { method: "POST", path: () => (ctx.microEventId ? `/micro-events/${ctx.microEventId}/join` : null), as: "partner", skipReason: "micro-event was not created", schema: MicroEventSchema },
  { method: "DELETE", path: () => (ctx.microEventId ? `/micro-events/${ctx.microEventId}/join` : null), as: "partner", skipReason: "micro-event was not created", schema: MicroEventSchema },
  { method: "PUT", path: () => (ctx.eventId ? `/events/${ctx.eventId}/participation` : null), skipReason: "no events (empty bootstrap list)", body: () => ({ status: "going" }), schema: ParticipationSchema },
  { method: "DELETE", path: () => (ctx.eventId ? `/events/${ctx.eventId}/participation` : null), skipReason: "no events (empty bootstrap list)", schema: ParticipationSchema },
  { method: "POST", path: () => (ctx.eventId ? "/check-ins" : null), skipReason: "no events (empty bootstrap list)", body: () => ({ eventId: ctx.eventId }), schema: CheckInSchema },
  { method: "PATCH", path: "/profile", body: () => ({ city: "Москва" }), schema: ProfileSchema },
  { method: "POST", path: () => (ctx.eventId ? "/feed" : null), skipReason: "no events (empty bootstrap list)", body: () => ({ eventId: ctx.eventId, text: "live-smoke post" }), schema: FeedPostSchema, pick: pick("feedPostId", (b) => b?.id) },
  { method: "POST", path: () => (ctx.feedPostId ? `/feed/${ctx.feedPostId}/like` : null), skipReason: "feed post was not created", schema: FeedPostSchema },
  { method: "POST", path: () => (ctx.feedPostId ? `/feed/${ctx.feedPostId}/comments` : null), skipReason: "feed post was not created", body: () => ({ text: "live-smoke comment" }), schema: FeedPostSchema },
  { method: "POST", path: () => (ctx.listId && ctx.eventId ? `/lists/${ctx.listId}/items` : null), skipReason: "no lists or events (empty bootstrap list)", body: () => ({ eventId: ctx.eventId }), schema: ListItemSchema, pick: pick("listItemId", (b) => b?.id) },
  { method: "DELETE", path: () => (ctx.listId && ctx.listItemId ? `/lists/${ctx.listId}/items/${ctx.listItemId}` : null), skipReason: "list item was not created", schema: ListItemSchema },
];

// --- the read-only-phase SKIPs that the fixtures above resolve ---
const AFTER_WRITE_GETS = [
  { path: () => (ctx.planId ? `/plans/${ctx.planId}` : null), schema: PlanCardSchema, skipReason: "plan was not created by the write phase", label: "/plans/:id" },
  { path: () => (ctx.planId ? `/plans/${ctx.planId}/budget` : null), schema: PlanBudgetSchema, skipReason: "plan was not created by the write phase", label: "/plans/:id/budget" },
  { path: () => (ctx.weGroupId ? `/we-groups/${ctx.weGroupId}` : null), schema: WeGroupScreenSchema, skipReason: "we-group was not created by the write phase", label: "/we-groups/:id" },
  { path: () => (ctx.voteId ? `/votes/${ctx.voteId}` : null), schema: VoteSchema, skipReason: "vote was not created by the write phase", label: "/votes/:id" },
  { path: () => (ctx.gatheringId ? `/gatherings/${ctx.gatheringId}` : null), schema: GatheringSchema, skipReason: "gathering was not created by the write phase", label: "/gatherings/:id" },
  { path: () => (ctx.organizerEventId ? `/organizer/events/${ctx.organizerEventId}/sales` : null), schema: EventSalesReportSchema, skipReason: "organizer event was not created", label: "/organizer/events/:id/sales" },
  { path: () => (ctx.organizerEventId ? `/organizer/events/${ctx.organizerEventId}/stats` : null), schema: OrganizerEventStatsSchema, skipReason: "organizer event was not created", label: "/organizer/events/:id/stats" },
  { path: () => (ctx.organizerEventId ? `/organizer/events/${ctx.organizerEventId}/campaigns` : null), schema: PromoCampaignSchema.array(), skipReason: "organizer event was not created", label: "/organizer/events/:id/campaigns" },
  { path: () => (ctx.organizerEventId ? `/organizer/events/${ctx.organizerEventId}/promotions` : null), schema: PromotionCampaignSchema.array(), skipReason: "organizer event was not created", label: "/organizer/events/:id/promotions" },
  { path: () => (ctx.organizerEventId ? `/organizer/events/${ctx.organizerEventId}/promocodes` : null), schema: PromoCodeSchema.array(), skipReason: "organizer event was not created", label: "/organizer/events/:id/promocodes" },
];

function zodSummary(error) {
  const issue = error?.issues?.[0];
  return issue ? `${issue.code} at ${issue.path?.join(".") || "(root)"}: ${issue.message}` : String(error);
}

async function main() {
  const initData = buildInitData(BOT_TOKEN);

  const loginRes = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData }) }).catch((e) => ({ error: String(e) }));
  if (loginRes.error || !loginRes.ok) {
    console.error(`FAIL POST /auth/login — http ${loginRes.status ?? 0} ${loginRes.error ?? ""}`);
    process.exit(1);
  }
  const loginBody = await loginRes.json();
  const loginParsed = AuthResponseSchema.safeParse(loginBody);
  if (!loginParsed.success) {
    console.error(`FAIL POST /auth/login — http ${loginRes.status} / zod ${zodSummary(loginParsed.error)}`);
    process.exit(1);
  }
  ctx.userId = loginParsed.data.user.id;
  console.log(`OK      POST /auth/login — http ${loginRes.status} (userId=${ctx.userId})`);

  // A second MAX identity for the cross-user writes: the waitlist only accepts a user who did not
  // book the (full) event themselves, and a micro-event author is an auto-participant.
  const partnerInitData = buildInitData(BOT_TOKEN, { id: 777000222, first_name: "Smoke", last_name: "Partner", username: "max_events_smoke_partner" });
  const partnerRes = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: partnerInitData }) }).catch((e) => ({ error: String(e) }));
  const partnerParsed = partnerRes.error || !partnerRes.ok ? null : AuthResponseSchema.safeParse(await partnerRes.json().catch(() => undefined));
  if (!partnerParsed?.success) {
    console.error(`FAIL POST /auth/login — http ${partnerRes.status ?? 0} ${partnerRes.error ?? ""} / zod ${partnerParsed ? zodSummary(partnerParsed.error) : "(no body)"}`);
    process.exit(1);
  }
  ctx.partnerUserId = partnerParsed.data.user.id;
  console.log(`OK      POST /auth/login — http ${partnerRes.status} (userId=${ctx.partnerUserId}, partner user)`);

  // Organizer login: the miniapp calls POST /auth/organizer/login (OrganizerLoginWrite -> OrganizerSession),
  // but the backend exposes no such route and no organizer credentials exist in code — organizer
  // endpoints are guarded by the regular MAX initData session, which the write phase uses instead.
  let failures = 0;
  const orgLogin = await fetch(`${BASE}/auth/organizer/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login: "smoke", password: "smoke" }) }).catch((e) => ({ error: String(e) }));
  if (orgLogin.error || orgLogin.status === 404) {
    console.log(`SKIP    POST /auth/organizer/login — http ${orgLogin.status ?? 0} ${orgLogin.error ?? ""}(route not implemented on the backend; organizer endpoints use the MAX initData session instead)`);
  } else {
    const orgParsed = OrganizerSessionSchema.safeParse(await orgLogin.json().catch(() => undefined));
    if (orgLogin.ok && orgParsed.success) console.log(`OK      POST /auth/organizer/login — http ${orgLogin.status}`);
    else {
      failures += 1;
      console.log(`FAIL    POST /auth/organizer/login — http ${orgLogin.status}${orgParsed.success ? "" : ` / zod ${zodSummary(orgParsed.error)}`}`);
    }
  }

  for (const check of CHECKS) if (!(await runCheck(check, initData, partnerInitData))) failures += 1;
  console.log("\n— fixture writes and user write paths —");
  for (const check of WRITE_CHECKS) if (!(await runCheck(check, initData, partnerInitData))) failures += 1;
  console.log("\n— GETs over created fixtures —");
  for (const check of AFTER_WRITE_GETS) if (!(await runCheck(check, initData, partnerInitData))) failures += 1;

  console.log(failures === 0 ? "\nsmoke: all checks passed" : `\nsmoke: ${failures} check(s) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

/** One OK/FAIL/SKIP row of the table; false means the check failed and must fail the exit code. */
async function runCheck(check, initData, partnerInitData) {
  const method = check.method ?? "GET";
  const path = typeof check.path === "function" ? check.path() : check.path;
  const shown = path ?? check.label ?? "(unresolved)";
  if (path === null) {
    console.log(`SKIP    ${method} ${shown} — ${check.skipReason}`);
    return true;
  }
  const known = KNOWN_FAILURES.find((k) => k.path === path && (k.method ?? "GET") === method);
  let res;
  try {
    const headers = { accept: "application/json", "x-max-init-data": check.as === "partner" ? partnerInitData : initData };
    const reqBody = typeof check.body === "function" ? check.body() : check.body;
    if (reqBody !== undefined) headers["content-type"] = "application/json";
    res = await fetch(`${BASE}${path}`, { method, headers, body: reqBody === undefined ? undefined : JSON.stringify(reqBody) });
  } catch (e) {
    res = { status: 0, networkError: String(e) };
  }
  const status = res.status;
  const body = status === 0 ? undefined : await res.json().catch(() => undefined);
  const httpOk = status >= 200 && status < 300;
  const allowed = httpOk || (check.allowStatuses ?? []).includes(status);
  const parsed = httpOk ? check.schema.safeParse(body) : null;
  const zodOk = parsed === null ? true : parsed.success;
  if (zodOk && httpOk) check.pick?.(body);
  if (known && (!allowed || !zodOk)) {
    console.log(`SKIPFL  ${method} ${path} — http ${status} (known failure, issue ${known.issue}: ${known.reason})`);
    return true;
  }
  if (!allowed) {
    console.log(`FAIL    ${method} ${path} — http ${status}${res.networkError ? ` ${res.networkError}` : ""}`);
    return false;
  }
  if (!zodOk) {
    console.log(`FAIL    ${method} ${path} — http ${status} / zod ${zodSummary(parsed.error)}`);
    return false;
  }
  console.log(`OK      ${method} ${path} — http ${status}${check.note ? ` (${check.note})` : ""}`);
  return true;
}

await main();
