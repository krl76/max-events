// Live smoke: run every GET endpoint used by the miniapp (apps/app-miniapp/src/api/client.ts)
// against a real backend and validate each response with the zod contracts.
//
// Usage: bun tools/live-smoke.mjs [baseUrl]
//   baseUrl  — argv[2] or env SMOKE_BASE_URL, default http://localhost:3100/api
//   bot token — env SMOKE_BOT_TOKEN, default local-dev-token
//
// Exit code: 1 when any check FAILs; SKIP (no seed id) and SKIP-FAIL (KNOWN_FAILURES) do not fail the run.

import { createHmac } from "node:crypto";
import { AchievementSchema, AuthResponseSchema, CalendarResponseSchema, DiscoveryResponseSchema, EventSalesReportSchema, EventSchema, FeedPostSchema, FriendActivityByFriendSchema, FriendAvailabilitySchema, FriendRouteSchema, FriendSchema, GatheringSchema, LeisureOptionSchema, ListItemSchema, ListSchema, MemoryPointSchema, MicroEventSchema, MyCitySummarySchema, NearbyTimelineSchema, OrganizerEventStatsSchema, OrganizerRatingResponseSchema, ParticipationStatusSchema, PeopleResponseSchema, PlacePageSchema, PlaceSchema, PlanBudgetSchema, PlanCardSchema, ProfileSchema, PromoCampaignSchema, PromoCodeSchema, PromotionCampaignSchema, PromotionPlacementsSchema, RatingSummarySchema, StorySchema, TargetedPromotionsResponseSchema, TodayResponseSchema, UserSchema, VisitStatsSchema, VoteSchema, WaitlistEntrySchema, WeGroupScreenSchema, WheretoResponseSchema } from "../packages/api-contracts/src/index.js";

const BASE = process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3100/api";
const BOT_TOKEN = process.env.SMOKE_BOT_TOKEN ?? "local-dev-token";
const ORIGIN = { lat: "55.75", lng: "37.61", latitude: "55.75", longitude: "37.61" };

// Expected failures: printed as SKIP-FAIL, never fail the exit code.
const KNOWN_FAILURES = [{ path: "/stories", issue: "#431", reason: "GET /api/stories is not implemented on the backend yet" }];

/** Signed MAX initData for a local bot token — https://dev.max.ru/docs/webapps/validation (secret = HMAC("WebAppData", token), hash over sorted URL-decoded pairs). */
function buildInitData(token) {
  const pairs = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 777000111, first_name: "Smoke", last_name: "Runner", username: "max_events_smoke" }),
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

const ctx = { userId: null, eventId: null, placeId: null, friendId: null, listId: null, planId: null, weGroupId: null, voteId: null };
const pick = (key, select) => (body) => {
  const value = select(body);
  if (typeof value === "string") ctx[key] = value;
};
const NEEDS_ORGANIZER_EVENT = "requires an event owned by the smoke user; a read-only smoke has none (backend answers 403 by design)";

const CHECKS = [
  { path: "/stories", schema: StorySchema.array() },
  { path: "/events", schema: EventSchema.array(), pick: pick("eventId", (b) => b[0]?.id) },
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
  { path: () => (ctx.gatheringId ? `/gatherings/${ctx.gatheringId}` : null), schema: GatheringSchema, skipReason: "no list endpoint and no seed data to source a gathering id", label: "/gatherings/:id" },
  { path: () => `/today?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`, schema: TodayResponseSchema },
  { path: () => `/nearby?latitude=${ORIGIN.latitude}&longitude=${ORIGIN.longitude}`, schema: NearbyTimelineSchema },
  { path: () => `/nearby/free?hours=2&mood=relax&latitude=${ORIGIN.latitude}&longitude=${ORIGIN.longitude}`, schema: LeisureOptionSchema.array() },
  { path: () => (ctx.planId ? `/plans/${ctx.planId}` : null), schema: PlanCardSchema, skipReason: "no plans for the smoke user (empty bootstrap list)", label: "/plans/:id" },
  { path: () => (ctx.planId ? `/plans/${ctx.planId}/budget` : null), schema: PlanBudgetSchema, skipReason: "no plans for the smoke user (empty bootstrap list)", label: "/plans/:id/budget" },
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
  { path: () => null, schema: EventSalesReportSchema, skipReason: NEEDS_ORGANIZER_EVENT, label: "/organizer/events/:id/sales" },
  { path: () => null, schema: OrganizerEventStatsSchema, skipReason: NEEDS_ORGANIZER_EVENT, label: "/organizer/events/:id/stats" },
  { path: () => null, schema: PromoCampaignSchema.array(), skipReason: NEEDS_ORGANIZER_EVENT, label: "/organizer/events/:id/campaigns" },
  { path: () => null, schema: PromotionCampaignSchema.array(), skipReason: NEEDS_ORGANIZER_EVENT, label: "/organizer/events/:id/promotions" },
  { path: () => null, schema: PromoCodeSchema.array(), skipReason: NEEDS_ORGANIZER_EVENT, label: "/organizer/events/:id/promocodes" },
  { path: () => `/organizers/${ctx.userId}/rating`, schema: OrganizerRatingResponseSchema },
  { path: () => (ctx.weGroupId ? `/we-groups/${ctx.weGroupId}` : null), schema: WeGroupScreenSchema, skipReason: "no we-groups for the smoke user (empty bootstrap list)", label: "/we-groups/:id" },
  { path: () => (ctx.voteId ? `/votes/${ctx.voteId}` : null), schema: VoteSchema, skipReason: "no votes for the smoke user (empty bootstrap list)", label: "/votes/:id" },
  // the miniapp reads 404 here as "no waitlist entry" (getMyWaitlistEntry -> null)
  { path: () => (ctx.eventId ? `/waitlist/me?eventId=${ctx.eventId}&userId=${ctx.userId}` : null), schema: WaitlistEntrySchema, allowStatuses: [404], note: "404 is the contract for 'no entry'", skipReason: "no events (empty bootstrap list)", label: "/waitlist/me" },
];

function zodSummary(error) {
  const issue = error?.issues?.[0];
  return issue ? `${issue.code} at ${issue.path?.join(".") || "(root)"}: ${issue.message}` : String(error);
}

async function main() {
  const initData = buildInitData(BOT_TOKEN);
  const headers = { accept: "application/json", "x-max-init-data": initData };

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

  let failures = 0;
  for (const check of CHECKS) {
    const path = typeof check.path === "function" ? check.path() : check.path;
    const shown = path ?? check.label ?? "(unresolved)";
    if (path === null) {
      console.log(`SKIP    GET ${shown} — ${check.skipReason}`);
      continue;
    }
    const known = KNOWN_FAILURES.find((k) => k.path === path);
    let res;
    try {
      res = await fetch(`${BASE}${path}`, { headers });
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
      console.log(`SKIPFL  GET ${path} — http ${status} (known failure, issue ${known.issue}: ${known.reason})`);
      continue;
    }
    if (!allowed) {
      failures += 1;
      console.log(`FAIL    GET ${path} — http ${status}${res.networkError ? ` ${res.networkError}` : ""}`);
      continue;
    }
    if (!zodOk) {
      failures += 1;
      console.log(`FAIL    GET ${path} — http ${status} / zod ${zodSummary(parsed.error)}`);
      continue;
    }
    console.log(`OK      GET ${path} — http ${status}${check.note ? ` (${check.note})` : ""}`);
  }
  console.log(failures === 0 ? "\nsmoke: all checks passed" : `\nsmoke: ${failures} check(s) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
