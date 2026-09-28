// START_MODULE_CONTRACT
// PURPOSE: «Моё» screen: personal space behind one row of filter pills — plans (plan cards per the README example: event, «Ты + N друзей», «Сбор <время> <место>», «<расстояние> от тебя»), own bookings, the shared month calendar and saved lists.
// SCOPE: Data via apiClient.listPlans (mock or live) at the fixed Moscow center origin; presentational rendering; navigation to the plan screen; the bookings, calendar and saved sections reuse the CalendarPage/ListsPage containers; no budget (P4-8) and no route (P3-2/3-3).
// DEPENDS: ../api/client.js (apiClient), ../catalog/MapScreen.js (MOSCOW_CENTER), ../catalog/format.js (pluralRu), ../calendar/CalendarPage.js (CalendarPage), ../lists/ListsPage.js (ListsPage), ../routing/router.js, @max-events/api-contracts (PlanCard, Plan), ../ui/primitives.js, ../ui/gestures.js (useSwipe, dampOffset), ../ui/theme.css
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
// - heroDragPx - смещение героя за пальцем; у края затухает и не уходит дальше соседней карточки
// - heroIndexAfterDirection - страница после свайпа влево или вправо
// - heroShiftPx - сдвиг ленты: страница плюс живой жест
// - heroSlideMs - доезд соседней карточки короче, дальний прыжок чуть дольше
// - PlansHero - ближайшие планы: уходящая карточка едет с пальцем, следующая въезжает
// END_MODULE_MAP

import { useEffect, useMemo, useRef, useState } from "react";
import { dampOffset, useSwipe } from "../ui/gestures";
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

/** Край ленты: палец чувствует ответ, но карточка не уезжает в пустоту. */
export const HERO_EDGE_DAMP_PX = 72;

const HERO_SLIDE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Смещение за пальцем. Дальше одной карточки не тянем — иначе между соседями открывается дыра. */
export function heroDragPx(offset: number, index: number, count: number, width: number): number {
  if (count <= 1 || width <= 0) return 0;
  const atStart = index <= 0 && offset > 0;
  const atEnd = index >= count - 1 && offset < 0;
  const eased = atStart || atEnd ? dampOffset(offset, HERO_EDGE_DAMP_PX) : offset;
  return Math.max(-width, Math.min(width, eased));
}

export function heroIndexAfterDirection(index: number, count: number, direction: "left" | "right"): number {
  if (count <= 1) return index;
  if (direction === "left") return Math.min(count - 1, index + 1);
  return Math.max(0, index - 1);
}

/** Пиксели, не проценты: так доезд интерполируется без скачка между calc(% ) и px. */
export function heroShiftPx(index: number, dragPx: number, width: number): number {
  if (width <= 0) return 0;
  return -index * width + dragPx;
}

/** Одна карточка — мягкий доезд. Если палец уже почти довёл её, хвост короче — иначе лента плывёт после отпускания. */
export function heroSlideMs(from: number, to: number, remaining = 1): number {
  const pages = Math.max(1, Math.abs(to - from));
  const base = Math.min(680, 460 + (pages - 1) * 70);
  const ratio = Math.min(1, Math.max(0, remaining));
  return Math.round(Math.max(160, base * Math.max(0.34, ratio)));
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readTranslateX(node: HTMLElement): number | null {
  const value = getComputedStyle(node).transform;
  if (value === "none") return 0;
  const matrix3d = /matrix3d\(([^)]+)\)/.exec(value);
  const matrix = /matrix\(([^)]+)\)/.exec(value);
  const raw = matrix3d?.[1] ?? matrix?.[1];
  if (raw === undefined) return null;
  const parts = raw.split(",");
  const tx = matrix3d === null ? parts[4] : parts[12];
  if (tx === undefined) return null;
  const parsed = Number(tx.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/** Лента, а не подмена карточки: сосед виден во время жеста, поэтому смена не моргает картинку. */
function PlansHero({ cards, onOpen, onSettled }: { cards: PlanCard[]; onOpen: (planId: string) => void; onSettled: (index: number) => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const live = useRef<Animation | null>(null);
  const dragRef = useRef(0);
  const widthRef = useRef(0);
  const finishTimer = useRef<number | null>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [moving, setMoving] = useState(false);
  const page = cards.length === 0 ? 0 : Math.min(index, cards.length - 1);

  useEffect(() => {
    const node = frame.current;
    if (node === null || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      widthRef.current = node.clientWidth;
      setWidth(node.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);
      const animation = live.current;
      live.current = null;
      if (animation !== null) {
        animation.onfinish = null;
        animation.cancel();
      }
    };
  }, []);

  function readWidth(): number {
    const next = frame.current?.clientWidth ?? widthRef.current;
    widthRef.current = next;
    return next;
  }

  function stopLive(): void {
    const animation = live.current;
    live.current = null;
    if (animation === null) return;
    animation.onfinish = null;
    animation.cancel();
  }

  function clearFinish(): void {
    if (finishTimer.current === null) return;
    window.clearTimeout(finishTimer.current);
    finishTimer.current = null;
  }

  function settle(next: number): void {
    clearFinish();
    stopLive();
    setMoving(false);
    onSettled(next);
  }

  function glideTo(next: number): void {
    const node = track.current;
    const w = readWidth();
    if (w !== width) setWidth(w);
    const from = node === null ? heroShiftPx(page, dragRef.current, w) : (readTranslateX(node) ?? heroShiftPx(page, dragRef.current, w));
    const to = heroShiftPx(next, 0, w);
    const span = Math.abs(to - heroShiftPx(page, 0, w));
    const travel = Math.abs(to - from);
    const remaining = span <= 0 ? (w <= 0 ? 1 : travel / w) : travel / span;
    stopLive();
    clearFinish();
    dragRef.current = 0;
    setDrag(0);
    setIndex(next);
    if (node === null || w <= 0 || prefersReducedMotion() || Math.abs(from - to) < 0.5 || typeof node.animate !== "function") {
      setMoving(false);
      onSettled(next);
      return;
    }
    setMoving(true);
    const duration = heroSlideMs(page, next, remaining);
    const animation = node.animate([{ transform: `translate3d(${from}px, 0, 0)` }, { transform: `translate3d(${to}px, 0, 0)` }], { duration, easing: HERO_SLIDE_EASE, fill: "both" });
    live.current = animation;
    const landed = next;
    animation.onfinish = () => {
      if (live.current !== animation) return;
      settle(landed);
    };
    finishTimer.current = window.setTimeout(() => {
      if (live.current !== animation) return;
      settle(landed);
    }, duration + 80);
  }

  const gesture = useSwipe({
    axis: "x",
    disabled: cards.length < 2 || moving,
    onOffset: (value) => {
      const w = readWidth();
      if (w !== width) setWidth(w);
      const next = heroDragPx(value, page, cards.length, w);
      dragRef.current = next;
      const node = track.current;
      if (node !== null) node.style.transform = `translate3d(${heroShiftPx(page, next, w)}px, 0, 0)`;
      setDrag(next);
    },
    onCancel: () => {
      if (Math.abs(dragRef.current) < 1) {
        dragRef.current = 0;
        setDrag(0);
        return;
      }
      glideTo(page);
    },
    onSwipe: (direction) => {
      if (direction !== "left" && direction !== "right") return;
      glideTo(heroIndexAfterDirection(page, cards.length, direction));
    },
  });

  const shift = heroShiftPx(page, drag, width);
  return (
    <>
      <div className="app-plans-hero-frame" ref={frame} {...gesture}>
        <div className="app-plans-hero-track" ref={track} style={{ transform: `translate3d(${shift}px, 0, 0)`, willChange: drag !== 0 || moving ? "transform" : undefined }}>
          {cards.map((card, position) => (
            <button key={card.plan.id} type="button" className="app-plans-hero" aria-hidden={position === page ? undefined : true} tabIndex={position === page ? undefined : -1} onClick={() => onOpen(card.plan.id)}>
              <AppMedia category={card.event.category} src={pictured(card.event.id, card.event.coverUrl)} />
              <span className="app-plans-hero-copy">
                <span className="app-plans-hero-title">{card.event.title}</span>
                <span className="app-plans-hero-when">{planWhenPlace(card.plan)}</span>
                <span className="app-plans-hero-facts">
                  <span>
                    <ActionIcon name="users" size={14} />
                    {planPartyLabel(card.plan.participants.length)}
                  </span>
                  <span>
                    <ActionIcon name="pin" size={14} />
                    {formatDistance(card.distanceMeters)}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
      {cards.length > 1 && (
        <div className="app-plans-dots" role="tablist" aria-label="Ближайшие планы">
          {cards.map((card, dot) => (
            <button
              key={card.plan.id}
              type="button"
              className={dot === page ? "app-plans-dot app-plans-dot--on" : "app-plans-dot"}
              aria-label={card.event.title}
              aria-selected={dot === page}
              onClick={() => {
                if (dot !== page) glideTo(dot);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
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
      <PlansHero cards={state.cards} onOpen={onOpen} onSettled={setFeatured} />
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
