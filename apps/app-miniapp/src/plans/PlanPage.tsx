// START_MODULE_CONTRACT
// PURPOSE: Plan screen: event (link to the event page), participants with statuses, meeting point and time, shared budget with expenses and debts (#218).
// SCOPE: Data via apiClient.getPlan (mock or live); presentational rendering; navigation to the event page; budget lives in ./BudgetSection.js (participant-only, server-gated); no route (P3-2/3-3).
// DEPENDS: ../api/client.js (apiClient), ../routing/router.js, @max-events/api-contracts (PlanCard, PlanParticipantStatus), ./PlansPage.js (planMeetingLabel), ../max/bridge.js (openExternalLink), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PLAN_STATUS_LABELS - ru labels for participant statuses (invited/confirmed/declined)
// - PlanState - union of plan fetch states (loading / error / ready)
// - PlanView - presentational: event link, participants with statuses, meeting line, chat link button when the plan chat exists
// - PlanPage - route container: loads the plan by id; the budget section is embedded in PlanView
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { PlanCard, PlanParticipantStatus, PlanCancelScope } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { planRepeatLabel } from "./PlanCreatePage";
import { useAuth } from "../auth/AuthContext";
import { useRoute } from "../routing/router";
import { BudgetSection } from "./BudgetSection";
import { planMeetingLabel } from "./PlansPage";
import { openExternalLink } from "../max/bridge";
import { AppButton, AppState } from "../ui/primitives";

export const PLAN_STATUS_LABELS: Record<PlanParticipantStatus, string> = { invited: "ждёт ответа", confirmed: "идёт", declined: "не идёт" };

export type PlanState = { status: "loading" } | { status: "error" } | { status: "ready"; card: PlanCard };

interface PlanViewProps {
  state: PlanState;
  onOpenEvent: (eventId: string) => void;
  /** The viewer: only the host may cancel, so nobody else is offered a button that answers 403. */
  viewerId?: string | null;
  /** Set once «Отменить» was pressed: the choice of scope is the second step, not a surprise. */
  cancelling?: boolean;
  cancelFailed?: boolean;
  onCancelStart?: () => void;
  onCancelDismiss?: () => void;
  onCancel?: (scope: PlanCancelScope) => void;
}

export function PlanView({ state, onOpenEvent, viewerId = null, cancelling = false, cancelFailed = false, onCancelStart = () => {}, onCancelDismiss = () => {}, onCancel = () => {} }: PlanViewProps) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить план.</AppState>;
  const { plan, event } = state.card;
  const repeat = planRepeatLabel(plan.recurringRule);
  return (
    <section className="app-plan">
      <button type="button" className="app-plan-event" onClick={() => onOpenEvent(event.id)}>
        {event.title}
      </button>
      <p className="app-plan-meeting">{planMeetingLabel(plan)}</p>
      {repeat !== null && <p className="app-gathering-hint">Повторяется {repeat}</p>}
      {plan.chatLink !== null && (
        <AppButton tone="secondary" onClick={() => openExternalLink(plan.chatLink!)}>
          В чат плана
        </AppButton>
      )}
      <ul className="app-plan-participants">
        {plan.participants.map(({ friend, status }) => (
          <li key={friend.id} className="app-plan-participant">
            <span className="app-plan-friend-name">{friend.name}</span>
            <span className={`app-plan-friend-status app-plan-friend-status--${status}`}>{PLAN_STATUS_LABELS[status]}</span>
          </li>
        ))}
      </ul>
      <BudgetSection planId={plan.id} members={plan.participants.map(({ friend }) => friend)} />
      {viewerId === plan.hostUserId && cancelling ? (
        <div className="app-plan-cancel">
          {/* A repeating plan asks which one: cancelling every future meeting by accident cannot be undone. */}
          <AppButton tone="danger" stretched onClick={() => onCancel("occurrence")}>
            {plan.seriesId === null ? "Отменить план" : "Отменить эту встречу"}
          </AppButton>
          {plan.seriesId !== null && (
            <AppButton tone="danger" stretched onClick={() => onCancel("series")}>
              Отменить всю серию
            </AppButton>
          )}
          <AppButton tone="secondary" stretched onClick={onCancelDismiss}>
            Не отменять
          </AppButton>
        </div>
      ) : viewerId === plan.hostUserId ? (
        <AppButton tone="secondary" stretched onClick={onCancelStart}>
          Отменить
        </AppButton>
      ) : null}
      {cancelFailed && <AppState error>Не удалось отменить план.</AppState>}
    </section>
  );
}

export function PlanPage({ id }: { id: string }) {
  const { navigate } = useRoute();
  const auth = useAuth();
  const viewerId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<PlanState>({ status: "loading" });
  const [cancelling, setCancelling] = useState(false);
  const [cancelFailed, setCancelFailed] = useState(false);
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
  return (
    <PlanView
      state={state}
      onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })}
      viewerId={viewerId}
      cancelling={cancelling}
      cancelFailed={cancelFailed}
      onCancelStart={() => {
        setCancelFailed(false);
        setCancelling(true);
      }}
      onCancelDismiss={() => setCancelling(false)}
      onCancel={(scope) => {
        setCancelFailed(false);
        apiClient.cancelPlan(id, scope).then(
          () => navigate({ name: "plans" }),
          () => {
            setCancelling(false);
            setCancelFailed(true);
          },
        );
      }}
    />
  );
}
