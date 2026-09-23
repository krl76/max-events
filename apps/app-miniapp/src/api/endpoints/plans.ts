// START_MODULE_CONTRACT
// PURPOSE: Plan endpoints of the api client: plan cards, the autoplan draft, day routes, the shared budget and the calendar.
// SCOPE: GET/POST /plans[/auto|/:id[/budget|/expenses]], DELETE /plans/:id, POST /routes[/optimize], GET /calendar.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarEntry - calendar item: active booking enriched with its event and place
// - withPlans - ApiClient.listPlans / getPlan / createPlan / cancelPlan / createAutoPlan / createDayRoute / optimizeDayRoute / getPlanBudget / addPlanExpense / listCalendar
// END_MODULE_MAP

import { AutoPlanProposalSchema, CalendarResponseSchema, DayRouteSchema, OptimizeRouteSchema, PlanBudgetSchema, PlanCardSchema } from "@max-events/api-contracts";
import type { AutoPlanProposal, Booking, CreatePlanExpenseWrite, CreatePlanWrite, DayRoute, Event, OptimizeRoute, Place, PlanBudget, PlanCancelScope, PlanCard, RouteStopWrite } from "@max-events/api-contracts";
import type { ApiMixin } from "./transport";

/** Calendar item: active booking enriched with its event and place. */
export interface CalendarEntry {
  booking: Booking;
  event: Event;
  place: Place | null;
}

export function withPlans<TBase extends ApiMixin>(Base: TBase) {
  return class PlanEndpoints extends Base {
    listPlans(origin: { latitude: number; longitude: number } | null = null): Promise<PlanCard[]> {
      const query = origin === null ? "" : `?${new URLSearchParams({ lat: String(origin.latitude), lng: String(origin.longitude) }).toString()}`;
      return this.request(`/plans${query}`, PlanCardSchema.array());
    }

    getPlan(id: string): Promise<PlanCard> {
      return this.request(`/plans/${id}`, PlanCardSchema);
    }

    createPlan(payload: CreatePlanWrite): Promise<PlanCard> {
      return this.request("/plans", PlanCardSchema, { body: payload });
    }

    /** Cancels one meeting by default; "series" takes the repeats with it. */
    async cancelPlan(planId: string, scope: PlanCancelScope = "occurrence"): Promise<void> {
      await this.requestVoid(`/plans/${planId}?scope=${scope}`, { method: "DELETE" });
    }

    createAutoPlan(eventId: string, latitude: number, longitude: number): Promise<AutoPlanProposal> {
      return this.request("/plans/auto", AutoPlanProposalSchema, { body: { eventId, latitude, longitude } });
    }

    createDayRoute(stops: RouteStopWrite[], latitude?: number, longitude?: number): Promise<DayRoute> {
      return this.request("/routes", DayRouteSchema, { body: { stops, latitude, longitude } });
    }

    optimizeDayRoute(stops: RouteStopWrite[], latitude?: number, longitude?: number): Promise<OptimizeRoute> {
      return this.request("/routes/optimize", OptimizeRouteSchema, { body: { stops, latitude, longitude } });
    }

    getPlanBudget(planId: string): Promise<PlanBudget> {
      return this.request(`/plans/${planId}/budget`, PlanBudgetSchema);
    }

    addPlanExpense(planId: string, payload: CreatePlanExpenseWrite): Promise<PlanBudget> {
      return this.request(`/plans/${planId}/expenses`, PlanBudgetSchema, { body: payload });
    }

    async listCalendar(): Promise<CalendarEntry[]> {
      const response = await this.request("/calendar", CalendarResponseSchema);
      return [...response.upcoming, ...response.past];
    }
  };
}
