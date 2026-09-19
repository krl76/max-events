// START_MODULE_CONTRACT
// PURPOSE: Plan screen: event (link to the event page), participants with statuses, meeting point and time, shared budget with expenses and debts (#218).
// SCOPE: Data via apiClient.getPlan (mock or live); presentational rendering; navigation to the event page; budget lives in ./BudgetSection.js (participant-only, server-gated); no route (P3-2/3-3).
// DEPENDS: ../api/client.js (apiClient), ../routing/router.js, @max-events/api-contracts (PlanCard, PlanParticipantStatus), ./PlansPage.js (planMeetingLabel), ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PLAN_STATUS_LABELS - ru labels for participant statuses (invited/confirmed/declined)
// - PlanState - union of plan fetch states (loading / error / ready)
// - PlanView - presentational: event link, participants with statuses, meeting line
// - PlanPage - route container: loads the plan by id; the budget section is embedded in PlanView
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { PlanCard, PlanParticipantStatus } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useRoute } from "../routing/router";
import { BudgetSection } from "./BudgetSection";
import { planMeetingLabel } from "./PlansPage";

export const PLAN_STATUS_LABELS: Record<PlanParticipantStatus, string> = { invited: "приглашён", confirmed: "подтвердил", declined: "отказался" };

export type PlanState = { status: "loading" } | { status: "error" } | { status: "ready"; card: PlanCard };

export function PlanView({ state, onOpenEvent }: { state: PlanState; onOpenEvent: (eventId: string) => void }) {
  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить план.</p>;
  const { plan, event } = state.card;
  return (
    <section className="app-plan">
      <button type="button" className="app-plan-event" onClick={() => onOpenEvent(event.id)}>
        {event.title}
      </button>
      <p className="app-plan-meeting">{planMeetingLabel(plan)}</p>
      <ul className="app-plan-participants">
        {plan.participants.map(({ friend, status }) => (
          <li key={friend.id} className="app-plan-participant">
            <span className="app-plan-friend-name">{friend.name}</span>
            <span className={`app-plan-friend-status app-plan-friend-status--${status}`}>{PLAN_STATUS_LABELS[status]}</span>
          </li>
        ))}
      </ul>
      <BudgetSection planId={plan.id} members={plan.participants.map(({ friend }) => friend)} />
    </section>
  );
}

export function PlanPage({ id }: { id: string }) {
  const { navigate } = useRoute();
  const [state, setState] = useState<PlanState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getPlan(id).then(
      (card) => {
        if (alive) setState({ status: "ready", card });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [id]);
  return <PlanView state={state} onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })} />;
}
