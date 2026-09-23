// START_MODULE_CONTRACT
// PURPOSE: Mock route table for plans: the plan cards, the autoplan draft, day routes, the shared budget and the calendar.
// SCOPE: POST /api/plans/auto, POST /api/routes[/optimize], GET/POST /api/plans, GET /api/plans/:id/budget, POST /api/plans/:id/expenses, DELETE/GET /api/plans/:id, GET /api/calendar.
// DEPENDS: ./plans.js, ./fixtures.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - plansRoutes - route table entry: null when the path belongs to another domain; /api/plans/:id is matched last, so /api/plans/auto keeps reaching its own branch
// END_MODULE_MAP

import { CreateAutoPlanWriteSchema, CreateDayRouteWriteSchema, CreatePlanExpenseWriteSchema, CreatePlanWriteSchema, IdSchema, PlanCancelScopeSchema } from "@max-events/api-contracts";
import { mockDemoUser, parseBookingBody } from "./fixtures";
import { addMockPlanExpense, buildMockDayRoute, calendarEntries, cancelMockPlan, createMockAutoPlan, createMockPlan, mockPlanBudget, optimizeMockDayRoute, planCard, planCards } from "./plans";

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
