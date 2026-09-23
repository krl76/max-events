// START_MODULE_CONTRACT
// PURPOSE: Mock route table for plans: the plan cards, the autoplan draft, day routes, the shared budget, the evening timeline of макет экрана 15, the calendar and the calendar shared with a friend (макет, экран 22).
// SCOPE: POST /api/plans/auto, POST /api/routes[/optimize], GET/POST /api/plans, GET /api/plans/:id/{budget,timeline}, POST /api/plans/:id/{expenses,chat,participants}, DELETE/GET /api/plans/:id, GET /api/calendar[/shared], POST /api/calendar/shared/{peers,entries/:id/going}.
// DEPENDS: ./plans.js, ./fixtures.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - plansRoutes - route table entry: null when the path belongs to another domain; /api/plans/:id is matched last, so /api/plans/auto keeps reaching its own branch
// END_MODULE_MAP

import { CreateAutoPlanWriteSchema, CreateDayRouteWriteSchema, CreatePlanExpenseWriteSchema, CreatePlanWriteSchema, IdSchema, PlanCancelScopeSchema } from "@max-events/api-contracts";
import { mockDemoUser, parseBookingBody } from "./fixtures";
import { addMockPlanExpense, addMockPlanParticipant, addMockSharedCalendarPeer, buildMockDayRoute, calendarEntries, cancelMockPlan, createMockAutoPlan, createMockPlan, joinMockSharedCalendarEntry, mockPlanBudget, mockPlanTimeline, mockSharedCalendar, openMockPlanChat, optimizeMockDayRoute, planCard, planCards } from "./plans";

export function plansRoutes(url: URL, init: RequestInit | undefined): Response | null {
  if (url.pathname === "/api/plans/auto" && init?.method === "POST") {
    const parsed = CreateAutoPlanWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const proposal = createMockAutoPlan(parsed.data);
    return proposal === "no_event" ? new Response(null, { status: 404 }) : Response.json(proposal);
  }
  if (url.pathname === "/api/routes" && init?.method === "POST") {
    const parsed = CreateDayRouteWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const route = buildMockDayRoute(parsed.data);
    if (route === "no_event" || route === "no_place") return new Response(null, { status: 404 });
    if (route === "event_without_place") return new Response(null, { status: 400 });
    return Response.json(route);
  }
  if (url.pathname === "/api/routes/optimize" && init?.method === "POST") {
    const parsed = CreateDayRouteWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const result = optimizeMockDayRoute(parsed.data);
    if (result === "no_event" || result === "no_place") return new Response(null, { status: 404 });
    if (result === "event_without_place") return new Response(null, { status: 400 });
    return Response.json(result);
  }
  if (url.pathname === "/api/plans" && init?.method === "POST") {
    const parsed = CreatePlanWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const created = createMockPlan(parsed.data);
    return created === "no_event" ? new Response(null, { status: 404 }) : Response.json(created);
  }
  if (url.pathname === "/api/plans") {
    return Response.json(planCards());
  }
  const planBudget = /^\/api\/plans\/([^/]+)\/budget$/.exec(url.pathname);
  if (planBudget) {
    if (!IdSchema.safeParse(planBudget[1]).success) return new Response(null, { status: 400 });
    const budget = mockPlanBudget(planBudget[1]);
    return budget ? Response.json(budget) : new Response(null, { status: 404 });
  }
  const planExpenses = /^\/api\/plans\/([^/]+)\/expenses$/.exec(url.pathname);
  if (planExpenses && init?.method === "POST") {
    if (!IdSchema.safeParse(planExpenses[1]).success) return new Response(null, { status: 400 });
    const parsed = CreatePlanExpenseWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const budget = addMockPlanExpense(planExpenses[1], parsed.data);
    return budget === null ? new Response(null, { status: 404 }) : budget === "invalid" ? new Response(null, { status: 400 }) : Response.json(budget);
  }
  const planTimeline = /^\/api\/plans\/([^/]+)\/timeline$/.exec(url.pathname);
  if (planTimeline) {
    if (!IdSchema.safeParse(planTimeline[1]).success) return new Response(null, { status: 400 });
    const timeline = mockPlanTimeline(planTimeline[1]);
    return timeline ? Response.json(timeline) : new Response(null, { status: 404 });
  }
  const planChat = /^\/api\/plans\/([^/]+)\/chat$/.exec(url.pathname);
  if (planChat && init?.method === "POST") {
    if (!IdSchema.safeParse(planChat[1]).success) return new Response(null, { status: 400 });
    const card = openMockPlanChat(planChat[1]);
    return card ? Response.json(card) : new Response(null, { status: 404 });
  }
  const planParticipants = /^\/api\/plans\/([^/]+)\/participants$/.exec(url.pathname);
  if (planParticipants && init?.method === "POST") {
    if (!IdSchema.safeParse(planParticipants[1]).success) return new Response(null, { status: 400 });
    const userId = IdSchema.safeParse(parseBookingBody(init)?.userId);
    if (!userId.success) return new Response(null, { status: 400 });
    const card = addMockPlanParticipant(planParticipants[1], userId.data);
    return card === "no_plan" ? new Response(null, { status: 404 }) : card === "invalid" ? new Response(null, { status: 400 }) : Response.json(card);
  }
  if (url.pathname === "/api/calendar/shared" && init?.method !== "POST") {
    return Response.json(mockSharedCalendar());
  }
  if (url.pathname === "/api/calendar/shared/peers" && init?.method === "POST") {
    const userId = IdSchema.safeParse(parseBookingBody(init)?.userId);
    if (!userId.success) return new Response(null, { status: 400 });
    const calendar = addMockSharedCalendarPeer(userId.data);
    return calendar ? Response.json(calendar) : new Response(null, { status: 404 });
  }
  const sharedGoing = /^\/api\/calendar\/shared\/entries\/([^/]+)\/going$/.exec(url.pathname);
  if (sharedGoing && init?.method === "POST") {
    if (!IdSchema.safeParse(sharedGoing[1]).success) return new Response(null, { status: 400 });
    const calendar = joinMockSharedCalendarEntry(sharedGoing[1]);
    return calendar ? Response.json(calendar) : new Response(null, { status: 404 });
  }
  if (url.pathname === "/api/calendar") {
    const entries = calendarEntries(mockDemoUser.id);
    const now = Date.now();
    const byStartAsc = (a: (typeof entries)[number], b: (typeof entries)[number]) => a.event.startsAt.localeCompare(b.event.startsAt);
    return Response.json({
      upcoming: entries.filter((entry) => new Date(entry.event.startsAt).getTime() >= now).sort(byStartAsc),
      past: entries.filter((entry) => new Date(entry.event.startsAt).getTime() < now).sort((a, b) => -byStartAsc(a, b)),
    });
  }
  const plan = /^\/api\/plans\/([^/]+)$/.exec(url.pathname);
  if (plan && init?.method === "DELETE") {
    if (!IdSchema.safeParse(plan[1]).success) return new Response(null, { status: 400 });
    const scope = PlanCancelScopeSchema.safeParse(url.searchParams.get("scope") ?? "occurrence");
    if (!scope.success) return new Response(null, { status: 400 });
    const cancelled = cancelMockPlan(plan[1], scope.data);
    return cancelled === "no_plan" ? new Response(null, { status: 404 }) : new Response(null, { status: 204 });
  }
  if (plan) {
    const found = planCard(plan[1]);
    return found ? Response.json(found) : new Response(null, { status: 404 });
  }
  return null;
}
