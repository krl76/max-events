// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the social graph: friends, the gathering flow, UGC micro-events, reverse discovery and people matching.
// SCOPE: /api/friends[/activity|/availability|/close|/suggestions|/follows|/sync], /api/gatherings[/:id[/response]], /api/micro-events[/:id[/join]], /api/discovery[/friend-places|/friends/:userId/route], /api/people.
// DEPENDS: ./social.js, ./fixtures.js, ../client.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - socialRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { CreatePlanExpenseWriteSchema, GatheringResponseWriteSchema, IdSchema } from "@max-events/api-contracts";
import { type CreateGathering, type CreateMicroEvent } from "../client";
import { MOCK_PEOPLE_CENTER, mockEvents, mockFriends, parseBookingBody, parseMockOrigin } from "./fixtures";
import { mockCloseFriendsOf } from "./profile.routes";
import { addMockMicroEventExpense, createMockGathering, createMockMicroEvent, discoverySummary, followMockFriends, friendActivityByFriend, friendAvailability, friendPlaceLayer, friendRoute, friendSuggestions, friendsSyncState, joinMockMicroEvent, leaveMockMicroEvent, microEventCard, microEvents, mockGatherings, mockMicroEventBudget, peopleSuggest, respondMockGathering, syncMockFriends } from "./social";

export function socialRoutes(url: URL, init: RequestInit | undefined): Response | null {
  if (url.pathname === "/api/friends/activity") {
    return Response.json(friendActivityByFriend());
  }
  if (url.pathname === "/api/friends/sync") {
    return init?.method === "POST" ? Response.json(syncMockFriends()) : Response.json(friendsSyncState());
  }
  if (url.pathname === "/api/friends/suggestions") {
    return Response.json(friendSuggestions());
  }
  if (url.pathname === "/api/friends/close") {
    return Response.json(mockCloseFriendsOf());
  }
  if (url.pathname === "/api/friends/follows" && init?.method === "PUT") {
    const payload = parseBookingBody(init) as { userIds?: unknown } | undefined;
    if (typeof payload !== "object" || payload === null || !Array.isArray(payload.userIds) || !payload.userIds.every((id) => typeof id === "string")) return new Response(null, { status: 400 });
    const followed = followMockFriends(payload.userIds);
    return followed === "unknown" ? new Response(null, { status: 404 }) : Response.json(followed);
  }
  if (url.pathname === "/api/friends") {
    return Response.json(mockFriends);
  }
  if (url.pathname === "/api/friends/availability") {
    if (!url.searchParams.get("eventId")) return new Response(null, { status: 400 });
    return Response.json(friendAvailability());
  }
  const discoveryRoute = /^\/api\/discovery\/friends\/([^/]+)\/route$/.exec(url.pathname);
  if (discoveryRoute) {
    if (!IdSchema.safeParse(discoveryRoute[1]).success) return new Response(null, { status: 400 });
    const route = friendRoute(discoveryRoute[1]);
    if (route === "own" || route === "hidden") return new Response(null, { status: 403 });
    if (route === "not_friend") return new Response(null, { status: 404 });
    return Response.json(route);
  }
  if (url.pathname === "/api/discovery/friend-places") {
    return Response.json(friendPlaceLayer());
  }
  if (url.pathname === "/api/discovery") {
    return Response.json(discoverySummary());
  }
  if (url.pathname === "/api/people") {
    const origin = parseMockOrigin(url);
    if (origin === "invalid") return new Response(null, { status: 400 });
    const [latitude, longitude] = origin ?? MOCK_PEOPLE_CENTER;
    return Response.json(peopleSuggest(latitude, longitude));
  }
  if (url.pathname === "/api/gatherings" && init?.method === "POST") {
    const payload = parseBookingBody(init) as CreateGathering | undefined;
    if (typeof payload !== "object" || payload === null || !Array.isArray(payload.friendIds)) return new Response(null, { status: 400 });
    if (!mockEvents.some((item) => item.id === payload.eventId)) return new Response(null, { status: 404 });
    const gathering = createMockGathering(payload);
    return gathering ? Response.json(gathering) : new Response(null, { status: 400 });
  }
  const gatheringResponse = /^\/api\/gatherings\/([^/]+)\/response$/.exec(url.pathname);
  if (gatheringResponse && init?.method === "PATCH") {
    if (!IdSchema.safeParse(gatheringResponse[1]).success) return new Response(null, { status: 400 });
    const parsed = GatheringResponseWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const result = respondMockGathering(gatheringResponse[1], parsed.data.response);
    return result === "unknown" ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
  }
  const gathering = /^\/api\/gatherings\/([^/]+)$/.exec(url.pathname);
  if (gathering) {
    const found = mockGatherings.get(gathering[1]);
    return found ? Response.json(found) : new Response(null, { status: 404 });
  }
  if (url.pathname === "/api/micro-events" && init?.method === "POST") {
    const payload = parseBookingBody(init) as CreateMicroEvent | undefined;
    const limit = payload?.participantsLimit;
    const limitOk = limit === undefined || limit === null || typeof limit === "number";
    if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || typeof payload.title !== "string" || typeof payload.startsAt !== "string" || !limitOk) return new Response(null, { status: 400 });
    const result = createMockMicroEvent(payload);
    return result === "no_place" ? new Response(null, { status: 404 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
  }
  if (url.pathname === "/api/micro-events") {
    return Response.json(microEvents());
  }
  const microJoin = /^\/api\/micro-events\/([^/]+)\/join$/.exec(url.pathname);
  if (microJoin && init?.method === "POST") {
    const userId = url.searchParams.get("userId") ?? "";
    if (userId === "") return new Response(null, { status: 400 });
    const result = joinMockMicroEvent(microJoin[1], userId);
    return result === null ? new Response(null, { status: 404 }) : result === "full" || result === "closed" ? new Response(null, { status: 409 }) : Response.json(result);
  }
  if (microJoin && init?.method === "DELETE") {
    const userId = url.searchParams.get("userId") ?? "";
    if (userId === "") return new Response(null, { status: 400 });
    const result = leaveMockMicroEvent(microJoin[1], userId);
    return result === null ? new Response(null, { status: 404 }) : Response.json(result);
  }
  const microBudget = /^\/api\/micro-events\/([^/]+)\/budget$/.exec(url.pathname);
  if (microBudget) {
    const userId = url.searchParams.get("userId") ?? "";
    if (userId === "") return new Response(null, { status: 400 });
    const budget = mockMicroEventBudget(microBudget[1], userId);
    return budget === null ? new Response(null, { status: 404 }) : budget === "forbidden" ? new Response(null, { status: 403 }) : Response.json(budget);
  }
  const microExpenses = /^\/api\/micro-events\/([^/]+)\/expenses$/.exec(url.pathname);
  if (microExpenses && init?.method === "POST") {
    const userId = url.searchParams.get("userId") ?? "";
    const parsed = CreatePlanExpenseWriteSchema.safeParse(parseBookingBody(init));
    if (userId === "" || !parsed.success) return new Response(null, { status: 400 });
    const budget = addMockMicroEventExpense(microExpenses[1], userId, parsed.data);
    return budget === null ? new Response(null, { status: 404 }) : budget === "forbidden" ? new Response(null, { status: 403 }) : budget === "invalid" ? new Response(null, { status: 400 }) : Response.json(budget);
  }
  const microEvent = /^\/api\/micro-events\/([^/]+)$/.exec(url.pathname);
  if (microEvent) {
    if (!IdSchema.safeParse(microEvent[1]).success) return new Response(null, { status: 400 });
    const card = microEventCard(microEvent[1]);
    return card === null ? new Response(null, { status: 404 }) : Response.json(card);
  }
  return null;
}
