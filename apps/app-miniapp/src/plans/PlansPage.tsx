// START_MODULE_CONTRACT
// PURPOSE: «Моё» screen: personal space behind one row of filter pills — plans (plan cards per the README example: event, «Ты + N друзей», «Сбор <время> <место>», «<расстояние> от тебя»), own bookings, the shared month calendar and saved lists.
// SCOPE: Data via apiClient.listPlans (mock or live) at the fixed Moscow center origin; presentational rendering; navigation to the plan screen; the bookings, calendar and saved sections reuse the CalendarPage/ListsPage containers; no budget (P4-8) and no route (P3-2/3-3).
// DEPENDS: ../api/client.js (apiClient), ../catalog/MapScreen.js (MOSCOW_CENTER), ../catalog/format.js (pluralRu), ../calendar/CalendarPage.js (CalendarPage), ../lists/ListsPage.js (ListsPage), ../routing/router.js, @max-events/api-contracts (PlanCard, Plan), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - formatMeetingTime - «18:20» ru time formatting
// - formatDistance - «850 м» / «1,2 км»
// - planMeetingLabel - «Сбор <время> <место>» line shared by the card and the plan screen
// - planCompanyLabel - «Пока только ты» or «Ты + N друзей»
// - planDistanceLabel - «1,2 км от тебя»; past 80 km the line is «далеко», and «от центра» when the point is the city center
// - PlansState - union of plans fetch states (loading / error / ready)
// - PlansView - presentational: one card per plan per the README example
// - PlansTab - разделы «Моё» одним рядом пилюль: plans | bookings | calendar | saved
// - PlansPage - «Моё» route container: один ряд фильтров над планами, бронями, календарём и сохранённым; entries to the «Мы» groups and the day route builder
// END_MODULE_MAP

import { useEffect, useMemo, useState } from "react";
import type { Plan, PlanCard } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { browsedCityOrigin, useViewerOrigin } from "../geo/viewer-origin";
import { pluralRu } from "../catalog/format";
import { CalendarPage } from "../calendar/CalendarPage";
import { MyMicroEventsSection } from "../micro/MicroEvents";
import { ListsPage } from "../lists/ListsPage";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppChip, AppState, AppSkeleton, AppMedia } from "../ui/primitives";

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

/** Zero friends is not a company of zero. The host is already on the plan. */
export function planCompanyLabel(friendCount: number): string {
  if (friendCount <= 0) return "Пока только ты";
  return `Ты + ${friendCount} ${pluralRu(friendCount, "друг", "друга", "друзей")}`;
}

const PLAN_FAR_METERS = 80_000;

/** «850 м от тебя». A cross-country figure is not a route, and a city-center point must not say «от тебя». */
export function planDistanceLabel(distanceMeters: number, fromViewer = true): string {
  const who = fromViewer ? "от тебя" : "от центра";
  if (distanceMeters > PLAN_FAR_METERS) return `далеко ${who}`;
  return `${formatDistance(distanceMeters)} ${who}`;
}

export type PlansState = { status: "loading" } | { status: "error" } | { status: "ready"; cards: PlanCard[] };

export function PlansView({ state, onOpen, onExplore, onCreate, distancesFromViewer = true }: { state: PlansState; onOpen: (planId: string) => void; onExplore: () => void; onCreate?: () => void; distancesFromViewer?: boolean }) {
  // Above the early returns on purpose: with no plans yet this was the one screen where making one
  // by hand was unreachable — the empty state offered only «Найти событие».
  const create =
    onCreate === undefined ? null : (
      <button type="button" className="app-plans-create" onClick={onCreate}>
        <span className="app-plans-create-title">Свой план</span>
        <span className="app-plans-create-note">Событие, место и время</span>
      </button>
    );
  if (state.status === "loading")
    return (
      <>
        {[0, 1].map((row) => (
          <div key={row} className="app-card" aria-hidden="true">
            <div className="app-card-body">
              <AppSkeleton />
              <AppSkeleton variant="line-short" />
            </div>
          </div>
        ))}
      </>
    );
  if (state.status === "error")
    return (
      <>
        {create}
        <AppState error>Не удалось загрузить планы.</AppState>
      </>
    );
  if (state.cards.length === 0)
    return (
      <>
        {create}
        <AppState action={{ label: "Найти событие", onClick: onExplore }}>Пока нет планов. Выбери событие — и собери компанию.</AppState>
      </>
    );
  return (
    <>
      {create}
      {state.cards.map(({ plan, event, distanceMeters }) => (
        <button key={plan.id} type="button" className="app-card app-card--link" onClick={() => onOpen(plan.id)}>
          <AppMedia category={event.category} />
          <div className="app-card-body">
            <span className="app-card-title">{event.title}</span>
            <span className="app-card-subtitle">{planCompanyLabel(plan.participants.length)}</span>
            <span className="app-card-subtitle">{planMeetingLabel(plan)}</span>
            <span className="app-card-subtitle">{planDistanceLabel(distanceMeters, distancesFromViewer)}</span>
          </div>
          <span className="app-row-chevron" aria-hidden="true">
            <ActionIcon name="chevron" size={16} strokeWidth={2} />
          </span>
        </button>
      ))}
    </>
  );
}

export type PlansTab = "plans" | "bookings" | "calendar" | "saved";

/**
 * Один ряд вместо двух шапок. «Мои брони» жили во втором переключателе под этим рядом — два разных
 * элемента управления, одинаковых по смыслу, друг под другом. Здесь это четыре равноправных раздела
 * одного экрана, и выбор раздела выглядит одинаково независимо от того, какой раздел открыт.
 */
const PLANS_TABS: Array<{ id: PlansTab; label: string }> = [
  { id: "plans", label: "Планы" },
  { id: "bookings", label: "Мои брони" },
  { id: "calendar", label: "Календарь" },
  { id: "saved", label: "Сохранённое" },
];

export function PlansPage({ tab = "plans", inviteToken }: { tab?: PlansTab; inviteToken?: string }) {
  const { navigate } = useRoute();
  const origin = useViewerOrigin();
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [active, setActive] = useState<PlansTab>(tab);
  const [state, setState] = useState<PlansState>({ status: "loading" });
  const point = useMemo(() => (homeCity === null ? { latitude: origin.latitude, longitude: origin.longitude, fromViewer: true } : browsedCityOrigin(origin, homeCity)), [origin, homeCity]);
  useEffect(() => {
    let alive = true;
    apiClient.getProfile().then(
      (profile) => {
        if (alive) setHomeCity(profile.city);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.listPlans({ latitude: point.latitude, longitude: point.longitude }).then(
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
  }, [point.latitude, point.longitude]);
  return (
    <>
      <div className="app-tab-row" role="group" aria-label="Разделы «Моё»">
        {PLANS_TABS.map((item) => (
          <AppChip key={item.id} pressed={active === item.id} onClick={() => setActive(item.id)}>
            {item.label}
          </AppChip>
        ))}
      </div>
      {active === "plans" && (
        <div className="app-plans">
          <div className="app-plans-quick">
            <button type="button" onClick={() => navigate({ name: "we-groups" })}>
              <ActionIcon name="user" size={20} />
              Мы
            </button>
            <button type="button" onClick={() => navigate({ name: "day-route" })}>
              <ActionIcon name="pin" size={20} />
              Маршрут на день
            </button>
            <button type="button" onClick={() => navigate({ name: "assist", ask: null })}>
              <ActionIcon name="spark" size={20} />
              Спросить MAX
            </button>
          </div>
          <PlansView state={state} onOpen={(planId) => navigate({ name: "plan", id: planId })} onExplore={() => navigate({ name: "home" })} onCreate={() => navigate({ name: "plan-new" })} distancesFromViewer={point.fromViewer} />
          <MyMicroEventsSection />
        </div>
      )}
      {/* Одно и то же место в дереве на оба раздела календаря: переключение брони ↔ месяц не размонтирует
          контейнер и не перезапрашивает обе половины календаря заново. */}
      {(active === "bookings" || active === "calendar") && <CalendarPage tab={active === "calendar" ? "month" : "bookings"} inviteToken={active === "calendar" ? inviteToken : undefined} embedded />}
      {active === "saved" && <ListsPage />}
    </>
  );
}
