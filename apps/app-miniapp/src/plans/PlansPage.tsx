// START_MODULE_CONTRACT
// PURPOSE: Plans list screen: plan cards per the README example (event, «Ты + N друзей», «Сбор <время> <место>», «<расстояние> от тебя»).
// SCOPE: Data via apiClient.listPlans (mock or live); presentational rendering; navigation to the plan screen; no budget (P4-8) and no route (P3-2/3-3).
// DEPENDS: ../api/client.js (apiClient), ../routing/router.js, @max-events/api-contracts (PlanCard, Plan), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - planParticipantsLabel - «Ты + N друзей» with ru pluralization (друг/друга/друзей)
// - formatMeetingTime - «18:20» ru time formatting
// - formatDistance - «850 м» / «1,2 км»
// - planMeetingLabel - «Сбор <время> <место>» line shared by the card and the plan screen
// - PlansState - union of plans fetch states (loading / error / ready)
// - PlansView - presentational: one card per plan per the README example
// - PlansPage - route container: loads the plan list, entries to the «Мы» groups and the day route builder
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { Plan, PlanCard } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppNavTiles } from "../ui/primitives";

export function planParticipantsLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "друг" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "друга" : "друзей";
  return `Ты + ${count} ${word}`;
}

export function formatMeetingTime(meetingAt: string): string {
  return new Date(meetingAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} м`;
  return `${(Math.round(meters / 100) / 10).toLocaleString("ru-RU", { minimumFractionDigits: 1 })} км`;
}

export function planMeetingLabel(plan: Plan): string {
  return `Сбор ${formatMeetingTime(plan.meetingAt)} ${plan.meetingPoint}`;
}

export type PlansState = { status: "loading" } | { status: "error" } | { status: "ready"; cards: PlanCard[] };

export function PlansView({ state, onOpen }: { state: PlansState; onOpen: (planId: string) => void }) {
  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить планы.</p>;
  if (state.cards.length === 0) return <p className="app-state">Пока нет планов.</p>;
  return (
    <>
      {state.cards.map(({ plan, event, distanceMeters }) => (
        <button key={plan.id} type="button" className="app-card app-card--link" onClick={() => onOpen(plan.id)}>
          <div className="app-card-body">
            <span className="app-card-title">{event.title}</span>
            <span className="app-card-subtitle">{planParticipantsLabel(plan.participants.length)}</span>
            <span className="app-card-subtitle">{planMeetingLabel(plan)}</span>
            <span className="app-card-subtitle">{formatDistance(distanceMeters)} от тебя</span>
          </div>
          <span className="app-row-chevron" aria-hidden="true">
            <ActionIcon name="chevron" size={16} strokeWidth={2} />
          </span>
        </button>
      ))}
    </>
  );
}

export function PlansPage() {
  const { navigate } = useRoute();
  const [state, setState] = useState<PlansState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.listPlans().then(
      (cards) => {
        if (alive) setState({ status: "ready", cards });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  return (
    <>
      <AppNavTiles
        items={[
          { icon: "user", label: "Мы", onClick: () => navigate({ name: "we-groups" }) },
          { icon: "pin", label: "Маршрут на день", onClick: () => navigate({ name: "day-route" }) },
        ]}
      />
      <PlansView state={state} onOpen={(planId) => navigate({ name: "plan", id: planId })} />
    </>
  );
}
