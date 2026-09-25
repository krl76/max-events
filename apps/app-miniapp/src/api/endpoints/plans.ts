// START_MODULE_CONTRACT
// PURPOSE: Plan endpoints of the api client: plan cards, the autoplan draft, day routes, the shared budget, the plan timeline of макет экран 15, the calendar and the calendar shared with a friend (макет, экран 22).
// SCOPE: GET/POST /plans[/auto|/:id[/budget|/expenses|/timeline|/chat|/participants]], PATCH /plans/:id/participants/me, DELETE /plans/:id, POST /routes[/optimize], GET /calendar[/shared], POST /calendar/shared/{peers,entries/:id/going}; the client-side aggregates CalendarEntry, PlanTimeline and SharedCalendar live here.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarEntry - calendar item: active booking enriched with its event and place
// - PlanTransferMode - how the party moves between two points of a plan: on foot, by metro or by taxi (#504)
// - PlanTransfer - one ride between two points: mode, minutes and fare (#504, mock)
// - PlanTimelineStep - one line of макет экран 15: a stop, or the ride to the next one
// - PlanTimeline - GET /plans/:id/timeline: whether MAX assembled the plan plus its steps (mock)
// - SharedCalendarPeer - whom the calendar is shared with and whether they may edit it (mock)
// - SharedCalendarEntry - one record the peer put into the shared calendar (mock)
// - SharedCalendar - GET /calendar/shared: peers, their records and the invite link (mock)
// - withPlans - ApiClient.listPlans / getPlan / createPlan / cancelPlan / addPlanParticipant / respondToPlan / createAutoPlan / createDayRoute / optimizeDayRoute / getPlanBudget / addPlanExpense / getPlanTimeline / createPlanChat / listCalendar / getSharedCalendar / joinSharedCalendarEntry / addSharedCalendarPeer
// END_MODULE_MAP

import { AutoPlanProposalSchema, CalendarResponseSchema, DayRouteSchema, FriendSchema, OptimizeRouteSchema, PlanBudgetSchema, PlanCardSchema } from "@max-events/api-contracts";
import type { AutoPlanProposal, Booking, CreatePlanExpenseWrite, CreatePlanWrite, DayRoute, Event, Friend, OptimizeRoute, Place, PlanBudget, PlanCancelScope, PlanCard, RouteStopWrite } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/** Calendar item: active booking enriched with its event and place. */
export interface CalendarEntry {
  booking: Booking;
  event: Event;
  place: Place | null;
}

/**
 * How the party gets from one point of a plan to the next. The routing domain knows distance and
 * nothing about transport (#504), and its own vocabulary stops at walk/metro — «Такси · 32 мин · 620 ₽»
 * of макет экран 15 is the third mode that endpoint will have to carry.
 */
export type PlanTransferMode = "walk" | "metro" | "taxi";

/** One ride between two points of a plan: how the party moves, how long it takes and what it costs (#504). */
export interface PlanTransfer {
  mode: PlanTransferMode;
  minutes: number;
  /** Fare, ₽; null for a mode nobody pays for, like walking. */
  priceRub: number | null;
}

/** One line of the evening (макет, экран 15): a stop, or — when `transfer` is set — the ride to the next one. */
export interface PlanTimelineStep {
  at: string;
  title: string;
  detail: string;
  transfer: PlanTransfer | null;
  /** The event behind the step; null for a dinner, a ride or a meeting point. */
  eventId: string | null;
}

/** The evening laid out step by step (макет, экран 15). */
export interface PlanTimeline {
  /** Behind the «MAX СОБРАЛ» badge: the assistant put this plan together, the viewer did not. */
  assembledByMax: boolean;
  steps: PlanTimelineStep[];
}

const PlanTimelineSchema: ZodSchema<PlanTimeline> = {
  safeParse(data: unknown) {
    const invalid = { success: false as const, error: "invalid plan timeline" };
    if (typeof data !== "object" || data === null) return invalid;
    const raw = data as Record<string, unknown>;
    if (typeof raw.assembledByMax !== "boolean" || !Array.isArray(raw.steps)) return invalid;
    const steps: PlanTimelineStep[] = [];
    for (const entry of raw.steps) {
      if (typeof entry !== "object" || entry === null) return invalid;
      const step = entry as Record<string, unknown>;
      if (typeof step.at !== "string" || typeof step.title !== "string" || typeof step.detail !== "string") return invalid;
      if (step.eventId !== null && step.eventId !== undefined && typeof step.eventId !== "string") return invalid;
      let transfer: PlanTransfer | null = null;
      if (step.transfer !== null && step.transfer !== undefined) {
        if (typeof step.transfer !== "object") return invalid;
        const leg = step.transfer as Record<string, unknown>;
        if (leg.mode !== "walk" && leg.mode !== "metro" && leg.mode !== "taxi") return invalid;
        if (typeof leg.minutes !== "number" || (leg.priceRub !== null && typeof leg.priceRub !== "number")) return invalid;
        transfer = { mode: leg.mode, minutes: leg.minutes, priceRub: leg.priceRub ?? null };
      }
      steps.push({ at: step.at, title: step.title, detail: step.detail, transfer, eventId: (step.eventId as string | undefined) ?? null });
    }
    return { success: true as const, data: { assembledByMax: raw.assembledByMax, steps } };
  },
};

/** Whom the calendar is shared with, and whether they may put records into it (макет, экран 22). */
export interface SharedCalendarPeer {
  friend: Friend;
  canEdit: boolean;
}

/** One record the peer put into the shared calendar (макет, экран 22). */
export interface SharedCalendarEntry {
  id: string;
  /** Who added it: the design names them under the title («добавила Анна»). */
  owner: Friend;
  title: string;
  startsAt: string;
  endsAt: string | null;
  /** The viewer is going to this one too — the design draws both faces on the row. */
  bothGoing: boolean;
  /** The viewer has not answered yet, so the row offers «Пойду». */
  needsResponse: boolean;
  /** The event behind the record, when the peer added one from the catalogue. */
  eventId: string | null;
}

/** The calendar shared with a friend (макет, экран 22): the peers, their records and the invite link. */
export interface SharedCalendar {
  peers: SharedCalendarPeer[];
  entries: SharedCalendarEntry[];
  /** Link behind «Ссылка на календарь»; null until one is issued. */
  inviteUrl: string | null;
}

const SharedCalendarSchema: ZodSchema<SharedCalendar> = {
  safeParse(data: unknown) {
    const invalid = { success: false as const, error: "invalid shared calendar" };
    if (typeof data !== "object" || data === null) return invalid;
    const raw = data as Record<string, unknown>;
    if (!Array.isArray(raw.peers) || !Array.isArray(raw.entries)) return invalid;
    if (raw.inviteUrl !== null && raw.inviteUrl !== undefined && typeof raw.inviteUrl !== "string") return invalid;
    const peers: SharedCalendarPeer[] = [];
    for (const entry of raw.peers) {
      if (typeof entry !== "object" || entry === null) return invalid;
      const peer = entry as Record<string, unknown>;
      const friend = FriendSchema.safeParse(peer.friend);
      if (!friend.success || typeof peer.canEdit !== "boolean") return invalid;
      peers.push({ friend: friend.data, canEdit: peer.canEdit });
    }
    const entries: SharedCalendarEntry[] = [];
    for (const item of raw.entries) {
      if (typeof item !== "object" || item === null) return invalid;
      const row = item as Record<string, unknown>;
      const owner = FriendSchema.safeParse(row.owner);
      if (!owner.success || typeof row.id !== "string" || typeof row.title !== "string" || typeof row.startsAt !== "string") return invalid;
      if (typeof row.bothGoing !== "boolean" || typeof row.needsResponse !== "boolean") return invalid;
      if (row.endsAt !== null && row.endsAt !== undefined && typeof row.endsAt !== "string") return invalid;
      if (row.eventId !== null && row.eventId !== undefined && typeof row.eventId !== "string") return invalid;
      entries.push({ id: row.id, owner: owner.data, title: row.title, startsAt: row.startsAt, endsAt: (row.endsAt as string | undefined) ?? null, bothGoing: row.bothGoing, needsResponse: row.needsResponse, eventId: (row.eventId as string | undefined) ?? null });
    }
    return { success: true as const, data: { peers, entries, inviteUrl: (raw.inviteUrl as string | undefined) ?? null } };
  },
};

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

    /** Host-only (backend PlansService.addParticipant): behind «Изменить» of the «Компания» card, макет экран 15. */
    addPlanParticipant(planId: string, userId: string): Promise<PlanCard> {
      return this.request(`/plans/${planId}/participants`, PlanCardSchema, { body: { userId } });
    }

    /** Invitee answer to a plan (backend PlansService.respond). */
    respondToPlan(planId: string, status: "confirmed" | "declined"): Promise<PlanCard> {
      return this.request(`/plans/${planId}/participants/me`, PlanCardSchema, { method: "PATCH", body: { status } });
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

    /** The evening step by step (макет, экран 15); mock until the transfers of #504 exist server-side. */
    getPlanTimeline(planId: string): Promise<PlanTimeline> {
      return this.request(`/plans/${planId}/timeline`, PlanTimelineSchema);
    }

    /** Opens the chat of a plan and returns the card carrying its link; mock until P1-7-b lands. */
    createPlanChat(planId: string): Promise<PlanCard> {
      return this.request(`/plans/${planId}/chat`, PlanCardSchema, { method: "POST" });
    }

    async listCalendar(): Promise<CalendarEntry[]> {
      const response = await this.request("/calendar", CalendarResponseSchema);
      return [...response.upcoming, ...response.past];
    }

    /** The half of the calendar that belongs to the friends it is shared with (макет, экран 22); mock. */
    getSharedCalendar(): Promise<SharedCalendar> {
      return this.request("/calendar/shared", SharedCalendarSchema);
    }

    /** «Пойду» on a record the peer added; answers with the calendar the row now belongs to. */
    joinSharedCalendarEntry(entryId: string): Promise<SharedCalendar> {
      return this.request(`/calendar/shared/entries/${entryId}/going`, SharedCalendarSchema, { method: "POST" });
    }

    /** «Добавить друга»: share the calendar with one more person. */
    addSharedCalendarPeer(userId: string): Promise<SharedCalendar> {
      return this.request("/calendar/shared/peers", SharedCalendarSchema, { body: { userId } });
    }
  };
}
