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

import { useEffect, useMemo, useRef, useState } from "react";
import type { Plan, PlanCard } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { browsedCityOrigin, useViewerOrigin } from "../geo/viewer-origin";
import { pluralRu } from "../catalog/format";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppState, AppSkeleton, AppMedia } from "../ui/primitives";

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

/** «Сб, 20:34 · Парк культуры». The weekday is the day of the meeting, not a separate «сбор» line. */
export function planWhenPlace(plan: Plan): string {
  const when = new Date(plan.meetingAt);
  const weekday = when.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "");
  const titled = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${titled}, ${formatMeetingTime(plan.meetingAt)} · ${plan.meetingPoint}`;
}

/** The host counts. «3 участника» is the company, not «ты + N друзей». */
export function planPartyLabel(friendCount: number): string {
  const total = Math.max(friendCount, 0) + 1;
  return `${total} ${pluralRu(total, "участник", "участника", "участников")}`;
}

/** Horizontal swipe on the hero. A short drag is a tap, not a page change. */
  export function featuredAfterSwipe(index: number, count: number, deltaX: number): number {
  if (count <= 1 || Math.abs(deltaX) < 48) return index;
  if (deltaX < 0) return Math.min(count - 1, index + 1);
  return Math.max(0, index - 1);
}

export type PlansState = { status: "loading" } | { status: "error" } | { status: "ready"; cards: PlanCard[] };

function PlanCreate({ onCreate }: { onCreate?: () => void }) {
  if (onCreate === undefined) return null;
  return (
    <button type="button" className="app-plans-create" onClick={onCreate}>
      <span className="app-plans-create-mark" aria-hidden="true">
        <ActionIcon name="plus" size={18} strokeWidth={2.4} />
      </span>
      <span className="app-plans-create-copy">
        <span className="app-plans-create-title">Создать новый план</span>
        <span className="app-plans-create-note">Событие или маршрут на день</span>
      </span>
    </button>
  );
}

export function PlansView({ state, onOpen, onExplore, onCreate, distancesFromViewer = true }: { state: PlansState; onOpen: (planId: string) => void; onExplore: () => void; onCreate?: () => void; distancesFromViewer?: boolean }) {
  const [featured, setFeatured] = useState(0);
  const swipeStart = useRef<number | null>(null);
  const swiped = useRef(false);
  if (state.status === "loading")
    return (
      <div className="app-plans" aria-hidden="true">
        <AppSkeleton />
        <AppSkeleton variant="line-short" />
      </div>
    );
  if (state.status === "error")
    return (
      <div className="app-plans">
        <PlanCreate onCreate={onCreate} />
        <AppState error>Не удалось загрузить планы.</AppState>
      </div>
    );
  if (state.cards.length === 0)
    return (
      <div className="app-plans">
        <PlanCreate onCreate={onCreate} />
        <AppState action={{ label: "Найти событие", onClick: onExplore }}>Пока нет планов. Выбери событие — и собери компанию.</AppState>
      </div>
    );
  const index = Math.min(featured, state.cards.length - 1);
  const hero = state.cards[index]!;
  const rest = state.cards.filter((card) => card.plan.id !== hero.plan.id);
  return (
    <div className="app-plans">
      <p className="app-plans-kicker">Ближайший план</p>
      <button
        type="button"
        className="app-plans-hero"
        style={{ touchAction: "pan-y" }}
        onPointerDown={(event) => {
          swipeStart.current = event.clientX;
          swiped.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          if (swipeStart.current === null) return;
          const next = featuredAfterSwipe(index, state.cards.length, event.clientX - swipeStart.current);
          swipeStart.current = null;
          if (next === index) return;
          swiped.current = true;
          setFeatured(next);
        }}
        onClick={() => {
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          onOpen(hero.plan.id);
        }}
      >
        <AppMedia category={hero.event.category} src={pictured(hero.event.id, hero.event.coverUrl)} />
        <span className="app-plans-hero-copy">
          <span className="app-plans-hero-title">{hero.event.title}</span>
          <span className="app-plans-hero-when">{planWhenPlace(hero.plan)}</span>
          <span className="app-plans-hero-facts">
            <span>
              <ActionIcon name="users" size={14} />
              {planPartyLabel(hero.plan.participants.length)}
            </span>
            <span>
              <ActionIcon name="pin" size={14} />
              {formatDistance(hero.distanceMeters)}
            </span>
          </span>
        </span>
      </button>
      {state.cards.length > 1 && (
        <div className="app-plans-dots" role="tablist" aria-label="Ближайшие планы">
          {state.cards.map((card, dot) => (
            <button key={card.plan.id} type="button" className={dot === index ? "app-plans-dot app-plans-dot--on" : "app-plans-dot"} aria-label={card.event.title} aria-selected={dot === index} onClick={() => setFeatured(dot)} />
          ))}
        </div>
      )}
      <div className="app-plans-section">
        <h2>Мои планы</h2>
        <span>Все</span>
      </div>
      <ul className="app-plans-rows">
        {rest.map(({ plan, event, distanceMeters }) => (
          <li key={plan.id}>
            <button type="button" className="app-plans-row" onClick={() => onOpen(plan.id)}>
              <AppMedia category={event.category} src={pictured(event.id, event.coverUrl)} />
              <span className="app-plans-row-copy">
                <span className="app-plans-row-title">{event.title}</span>
                <span className="app-plans-row-meta">
                  {planWhenPlace(plan)} · {distancesFromViewer ? formatDistance(distanceMeters) : planDistanceLabel(distanceMeters, false)}
                </span>
              </span>
              <ActionIcon name="chevron" size={18} />
            </button>
          </li>
        ))}
      </ul>
      <PlanCreate onCreate={onCreate} />
    </div>
  );
}

export function PlansPage() {
  const { navigate } = useRoute();
  const origin = useViewerOrigin();
  const [homeCity, setHomeCity] = useState<string | null>(null);
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
    <section className="app-plans-screen" aria-label="Планы">
      <div className="app-plans-bar">
        <h1>Планы</h1>
      </div>
      <PlansView state={state} onOpen={(planId) => navigate({ name: "plan", id: planId })} onExplore={() => navigate({ name: "search" })} onCreate={() => navigate({ name: "plan-new" })} distancesFromViewer={point.fromViewer} />
    </section>
  );
}
