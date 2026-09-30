// START_MODULE_CONTRACT
// PURPOSE: «Рядом со мной» (макет, экраны 13 и 14): two modes behind the app-wide row of filter pills — the four-segment timeline inside the chosen search radius, and the free-window builder that turns hours plus a mood into a chain of stops.
// SCOPE: Data via apiClient.getNearbyTimeline/getLeisureOptions at useViewerOrigin; mode/hours/mood local state; «Открыть как план» creates a plan via apiClient.createPlan and pushes экран 15; loading/error/empty states for both modes.
// DEPENDS: ../api/client.js (apiClient, LeisureChain, LeisureChainStop), @max-events/api-contracts (LeisureMood, NearbyBucket, NearbyCard, NearbyTimeline), ../catalog/format.js (pluralRu), ../geo/profile-city.js, ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NEARBY_RADIUS_KM - the radius both the backend and the header line quote
// - NEARBY_BUCKETS - ordered bucket keys of the timeline
// - BUCKET_LABELS - ru segment headings (Сейчас / Через час / Вечером / Завтра)
// - LEISURE_MOOD_LABELS - ru labels per LeisureMood
// - LEISURE_HOURS - selectable free-window lengths (1..8, backend contract)
// - STOP_KIND_LABELS - ru caption over a chain stop: Место / Событие
// - NearbyMode - which of the two modes of the screen is open
// - NearbyState - timeline fetch state union (loading / error / ready)
// - LeisureState - chain fetch state union (loading / error / ready)
// - formatDistanceKm - «1,2 км»
// - bucketCountLabel - «4 места» next to a segment heading
// - nearbyCardWhen - the time under a timeline card: «идёт», «до 23:00» or the start hour
// - chainTitle - «Цепочка на 3 часа»
// - chainWindow - «19:00 – 22:00»: the window the chain occupies, from its first stop or from now
// - chainStopMeta - «19:00 · 0,4 км · 400 ₽» under a stop title
// - chainPlanDraft - the chain as a plan payload; null when it has no event to hang a plan on
// - nearbyLocationRoute - map pin plus a route the viewer can follow to that place
// - NearbyView - presentational: mode pills, the open mode, and the radius dock at the bottom
// - NearbyPage - route container: loads the timeline and the chain, creates the plan, wires navigation
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { LeisureMood, NearbyBucket, NearbyCard, NearbyTimeline } from "@max-events/api-contracts";
import { DEFAULT_APP_SETTINGS } from "@max-events/api-contracts";
import { apiClient, type LeisureChain, type LeisureChainStop } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { useProfileCityPoint } from "../geo/profile-city";
import { SEARCH_RADIUS_OPTIONS, radiusLabel } from "../profile/SettingsPage";
import { pictured } from "../ui/photos";
import { HeaderSlot, useHeaderTitle } from "../ui/Layout";
import { useRoute } from "../routing/router";
import { useMapAssistIds } from "../catalog/useMapAssistIds";
import { ActionIcon } from "../ui/icons";
import { AppMedia, AppSkeletonList, AppState } from "../ui/primitives";
import { cardMatchesQuery, cardOnDay, moscowDayKey } from "./nearby-filters";
import { SearchDayButton } from "../today/TodaySection";

/** Both the backend and the line under the header quote the same radius; one constant so they cannot drift. */
export const NEARBY_RADIUS_KM = 15;

export const NEARBY_BUCKETS = ["now", "inAnHour", "evening", "tomorrow"] as const satisfies readonly NearbyBucket[];

export const BUCKET_LABELS: Record<NearbyBucket, string> = { now: "Сейчас", inAnHour: "Через час", evening: "Вечером", tomorrow: "Завтра" };

export const LEISURE_MOOD_LABELS: Record<LeisureMood, string> = { relax: "Расслабиться", active: "Активно", friends: "С друзьями" };

export const LEISURE_HOURS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const STOP_KIND_LABELS: Record<LeisureChainStop["kind"], string> = { place: "Место", event: "Событие" };

export type NearbyMode = "timeline" | "free";

export type NearbyState = { status: "loading" } | { status: "error" } | { status: "ready"; timeline: NearbyTimeline };

export type LeisureState = { status: "loading" } | { status: "error" } | { status: "ready"; chains: LeisureChain[] };

export function formatDistanceKm(distanceKm: number): string {
  return `${distanceKm.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} км`;
}

export function bucketCountLabel(count: number): string {
  return `${count} ${pluralRu(count, "место", "места", "мест")}`;
}

const MOSCOW_TIME = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });

/**
 * The time a timeline card prints. In the «Сейчас» segment the event has already begun, so the useful
 * number is when it ends — «до 23:00» — and «идёт» is all that is left to say when nothing says when
 * it stops. Every other segment is still ahead, so its start hour is the answer.
 */
export function nearbyCardWhen(card: Pick<NearbyCard, "bucket"> & { event: Pick<NearbyCard["event"], "startsAt" | "endsAt"> }): string {
  if (card.bucket !== "now") return MOSCOW_TIME.format(new Date(card.event.startsAt));
  return card.event.endsAt === null ? "идёт" : `до ${MOSCOW_TIME.format(new Date(card.event.endsAt))}`;
}

export function chainTitle(hours: number): string {
  return `Цепочка на ${hours} ${pluralRu(hours, "час", "часа", "часов")}`;
}

/** «19:00 – 22:00». The window opens at the first stop that knows its hour, and otherwise right now. */
export function chainWindow(stops: readonly LeisureChainStop[], hours: number, now: Date = new Date()): string {
  const first = stops.find((stop) => stop.startsAt !== null)?.startsAt ?? null;
  const from = first === null ? now : new Date(first);
  const to = new Date(from.getTime() + hours * 60 * 60 * 1000);
  return `${MOSCOW_TIME.format(from)} – ${MOSCOW_TIME.format(to)}`;
}

/** «19:00 · 0,4 км · 400 ₽»; every part is dropped when the stop does not carry it (#504 distance, #492 venue price). */
export function chainStopMeta(stop: LeisureChainStop): string {
  const price = stop.free ? "бесплатно" : stop.priceRub === null ? null : `${stop.priceRub.toLocaleString("ru-RU")} ₽`;
  return [stop.startsAt === null ? null : MOSCOW_TIME.format(new Date(stop.startsAt)), stop.distanceKm === null ? null : formatDistanceKm(stop.distanceKm), price].filter((part) => part !== null).join(" · ");
}

/**
 * The chain as a plan (макет, экран 15). A plan hangs on an event — CreatePlanWrite has no shape for a
 * walk between two venues — so a chain made of places alone cannot become one, and says so rather than
 * inventing an event to carry it.
 */
export function chainPlanDraft(chain: LeisureChain): { eventId: string; participantIds: string[]; meetingPoint: string; meetingAt: string } | null {
  const first = chain.stops[0];
  const event = chain.stops.find((stop) => stop.kind === "event" && stop.eventId !== null);
  if (first === undefined || event?.eventId == null) return null;
  const meetingAt = first.startsAt ?? event.startsAt;
  if (meetingAt === null) return null;
  return { eventId: event.eventId, participantIds: [], meetingPoint: first.title, meetingAt };
}

interface NearbyViewProps {
  mode: NearbyMode;
  onMode: (mode: NearbyMode) => void;
  state: NearbyState;
  leisure: LeisureState;
  hours: number;
  mood: LeisureMood;
  now?: Date;
  planning?: boolean;
  onHours: (hours: number) => void;
  onMood: (mood: LeisureMood) => void;
  onRefresh: () => void;
  onRetryTimeline: () => void;
  onOpenPlan: (chain: LeisureChain) => void;
  onOpenEvent: (id: string) => void;
  onOpenLocation: (card: NearbyCard) => void;
  onOpenPlace: (id: string) => void;
  radiusKm?: number;
  onRadius?: (km: number) => void;
  originSource?: "geo" | "fallback";
  /** False when the radius is drawn around the profile city's center, not around the viewer. */
  inCity?: boolean;
  query?: string;
  onQuery?: (query: string) => void;
  searchOpen?: boolean;
  assistIds?: ReadonlySet<string> | null;
  dayKey?: string;
  onDay?: (key: string) => void;
}

export function nearbyLocationRoute(place: Pick<NearbyCard["place"], "id" | "latitude" | "longitude">): { name: "map"; pin: { lat: number; lng: number }; placeId: string; drawRoute: true } {
  return { name: "map", pin: { lat: place.latitude, lng: place.longitude }, placeId: place.id, drawRoute: true };
}

function TimelineCard({ card, onOpenEvent, onOpenLocation }: { card: NearbyCard; onOpenEvent: (id: string) => void; onOpenLocation: (card: NearbyCard) => void }) {
  return (
    <article className="app-nb-card">
      <button type="button" className="app-nb-card-open" onClick={() => onOpenEvent(card.event.id)}>
        <span className="app-nb-card-media">
          <AppMedia category={card.event.category} src={pictured(card.event.id, card.event.coverUrl)} />
          {card.promoted && <span className="app-nb-card-promo">Промо</span>}
        </span>
        <span className="app-nb-card-title">{card.event.title}</span>
      </button>
      <button type="button" className="app-nb-card-loc" aria-label={`Маршрут до ${card.place.title}`} onClick={() => onOpenLocation(card)}>
        <ActionIcon name="pin" size={14} strokeWidth={2.2} />
        <span>
          {card.place.title} · {nearbyCardWhen(card)}
        </span>
      </button>
      <span className="app-nb-card-km">{formatDistanceKm(card.distanceKm)}</span>
    </article>
  );
}

/** «от вас» only when the radius really starts at the viewer. A substituted city center must not say that. */
export function nearbyOriginCaption(inCity: boolean, source: "geo" | "fallback"): string {
  return inCity && source === "geo" ? "от вас" : "от центра города";
}

export function nearbyEmptyTitle(inCity: boolean): string {
  return inCity ? "Рядом пока ничего не начинается" : "В городе пока ничего не начинается";
}

export function nearbyErrorTitle(inCity: boolean): string {
  return inCity ? "Не удалось загрузить события рядом." : "Не удалось загрузить события в городе.";
}

export function nearbyScreenTitle(_inCity = true): string {
  return "Рядом";
}

function Timeline({ state, onRetryTimeline, onOpenEvent, onOpenLocation, radiusKm = NEARBY_RADIUS_KM, inCity = true, searching = false }: Pick<NearbyViewProps, "state" | "onRetryTimeline" | "onOpenEvent" | "onOpenLocation" | "radiusKm" | "inCity"> & { searching?: boolean }) {
  const segments = state.status === "ready" ? NEARBY_BUCKETS.map((bucket) => ({ bucket, cards: state.timeline[bucket] })).filter((segment) => segment.cards.length > 0) : [];

  return (
    <>
      {state.status === "loading" && <AppSkeletonList rows={3} />}
      {state.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRetryTimeline }}>
          {nearbyErrorTitle(inCity)}
        </AppState>
      )}
      {state.status === "ready" && segments.length === 0 && <AppState hint={searching ? "Можно другими словами — формы подберёт поиск" : `Мы смотрим только на ${radiusKm} км вокруг`}>{searching ? "Ничего не нашлось" : nearbyEmptyTitle(inCity)}</AppState>}
      {segments.map((segment) => (
        <section key={segment.bucket} className="app-nb-seg" aria-label={BUCKET_LABELS[segment.bucket]}>
          <div className="app-nb-seg-head">
            <h2 className="app-nb-seg-title">{BUCKET_LABELS[segment.bucket]}</h2>
            <span className="app-nb-seg-count">{bucketCountLabel(segment.cards.length)}</span>
          </div>
          <div className="app-nb-grid">
            {segment.cards.map((card) => (
              <TimelineCard key={card.event.id} card={card} onOpenEvent={onOpenEvent} onOpenLocation={onOpenLocation} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Chain({ chain, hours, now, planning, onRefresh, onOpenPlan, onOpenEvent, onOpenPlace }: { chain: LeisureChain; hours: number; now: Date } & Pick<NearbyViewProps, "planning" | "onRefresh" | "onOpenPlan" | "onOpenEvent" | "onOpenPlace">) {
  const draft = chainPlanDraft(chain);

  return (
    <div className="app-nearby-option">
      <div className="app-nb-chain-head">
        <h2 className="app-nb-chain-title">{chainTitle(hours)}</h2>
        <span className="app-nb-chain-window">{chainWindow(chain.stops, hours, now)}</span>
      </div>
      <ol className="app-nearby-stops">
        {chain.stops.map((stop, index) => (
          <li key={`${stop.title}-${index}`} className="app-nearby-stop">
            <span className="app-nb-stop-rail" aria-hidden="true">
              <span className="app-nb-stop-dot">{index + 1}</span>
              {index < chain.stops.length - 1 && <span className="app-nb-stop-line" />}
            </span>
            <button type="button" className="app-nb-stop-body" disabled={stop.eventId === null && stop.placeId === null} onClick={() => (stop.kind === "event" && stop.eventId !== null ? onOpenEvent(stop.eventId) : stop.placeId !== null ? onOpenPlace(stop.placeId) : undefined)}>
              <span className="app-nb-stop-kind">{STOP_KIND_LABELS[stop.kind]}</span>
              <span className="app-nearby-stop-title">{stop.title}</span>
              <span className="app-nb-stop-meta">{chainStopMeta(stop)}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="app-nearby-actions">
        <button type="button" className="app-nb-plan" disabled={draft === null || planning === true} onClick={() => onOpenPlan(chain)}>
          Открыть как план
        </button>
        <button type="button" className="app-nb-refresh" aria-label="Подобрать заново" onClick={onRefresh}>
          <ActionIcon name="refresh" size={20} strokeWidth={2.2} />
        </button>
      </div>
      {draft === null && <p className="app-nb-plan-hint">План собирается вокруг события — в этой цепочке его нет.</p>}
    </div>
  );
}

function FreeWindow({ leisure, hours, mood, now, planning, onHours, onMood, onRefresh, onOpenPlan, onOpenEvent, onOpenPlace }: { now: Date } & Pick<NearbyViewProps, "leisure" | "hours" | "mood" | "planning" | "onHours" | "onMood" | "onRefresh" | "onOpenPlan" | "onOpenEvent" | "onOpenPlace">) {
  return (
    <>
      <h2 className="app-nb-label">Сколько часов свободно</h2>
      <div className="app-nb-hours" role="radiogroup" aria-label="Сколько часов свободно">
        {LEISURE_HOURS.map((value) => (
          <button key={value} type="button" role="radio" aria-checked={hours === value} className={hours === value ? "app-nb-hour app-nb-hour--on" : "app-nb-hour"} onClick={() => onHours(value)}>
            {value}
          </button>
        ))}
      </div>
      <h2 className="app-nb-label">Настроение</h2>
      <div className="app-nb-moods" role="radiogroup" aria-label="Настроение">
        {(Object.keys(LEISURE_MOOD_LABELS) as LeisureMood[]).map((value) => (
          <button key={value} type="button" role="radio" aria-checked={mood === value} className={mood === value ? "app-nb-mood app-nb-mood--on" : "app-nb-mood"} onClick={() => onMood(value)}>
            {LEISURE_MOOD_LABELS[value]}
          </button>
        ))}
      </div>
      {leisure.status === "loading" && <AppSkeletonList rows={3} />}
      {leisure.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRefresh }}>
          Не удалось собрать цепочку.
        </AppState>
      )}
      {leisure.status === "ready" && leisure.chains.length === 0 && (
        <AppState hint="Попробуйте другое настроение или окно подлиннее" action={{ label: "Подобрать заново", onClick: onRefresh }}>
          В это окно цепочка не складывается
        </AppState>
      )}
      {leisure.status === "ready" && leisure.chains.map((chain) => <Chain key={chain.title} chain={chain} hours={hours} now={now} planning={planning} onRefresh={onRefresh} onOpenPlan={onOpenPlan} onOpenEvent={onOpenEvent} onOpenPlace={onOpenPlace} />)}
    </>
  );
}

const MODE_LABELS: Record<NearbyMode, string> = { timeline: "События", free: "На часы" };
const NEARBY_MODES = ["timeline", "free"] as const satisfies readonly NearbyMode[];

function shownTimeline(state: NearbyState, dayKey: string, todayKey: string, query: string, assistIds: ReadonlySet<string> | null): NearbyState {
  if (state.status !== "ready") return state;
  const keep = (card: NearbyCard) => cardOnDay(card, dayKey, todayKey) && cardMatchesQuery(card, query, assistIds);
  return {
    status: "ready",
    timeline: {
      now: state.timeline.now.filter(keep),
      inAnHour: state.timeline.inAnHour.filter(keep),
      evening: state.timeline.evening.filter(keep),
      tomorrow: state.timeline.tomorrow.filter(keep),
    },
  };
}

export function NearbyView({ mode, onMode, state, leisure, hours, mood, now = new Date(), planning, onHours, onMood, onRefresh, onRetryTimeline, onOpenPlan, onOpenEvent, onOpenLocation, onOpenPlace, radiusKm = NEARBY_RADIUS_KM, onRadius, inCity = true, query = "", onQuery = () => {}, searchOpen = false, assistIds = null, dayKey, onDay = () => {} }: NearbyViewProps) {
  const todayKey = moscowDayKey(now);
  const selectedDay = dayKey ?? todayKey;
  const searching = query.trim() !== "";
  const shown = shownTimeline(state, selectedDay, todayKey, query, assistIds);

  return (
    <section className="app-nb">
      <div className="app-nb-bar">
        <div className="app-nb-modes" role="group" aria-label="Режим">
          {NEARBY_MODES.map((value) => (
            <button key={value} type="button" aria-pressed={mode === value} className={mode === value ? "app-nb-mode app-nb-mode--on" : "app-nb-mode"} onClick={() => onMode(value)}>
              {MODE_LABELS[value]}
            </button>
          ))}
        </div>
        {mode === "timeline" && <SearchDayButton chip day={selectedDay} now={now} onDay={onDay} emphasized={selectedDay !== todayKey} />}
      </div>
      {searchOpen && <input className="app-nb-search" aria-label="Поиск рядом" value={query} placeholder="Событие или место" onChange={(event) => onQuery(event.target.value)} />}
      {mode === "timeline" ? <Timeline state={shown} onRetryTimeline={onRetryTimeline} onOpenEvent={onOpenEvent} onOpenLocation={onOpenLocation} radiusKm={radiusKm} inCity={inCity} searching={searching} /> : <FreeWindow leisure={leisure} hours={hours} mood={mood} now={now} planning={planning} onHours={onHours} onMood={onMood} onRefresh={onRefresh} onOpenPlan={onOpenPlan} onOpenEvent={onOpenEvent} onOpenPlace={onOpenPlace} />}
      <div className="app-nb-dock">
        <p className="app-nb-dock-label">Расстояние</p>
        <div className="app-nb-radius" role="radiogroup" aria-label="Радиус поиска">
          {SEARCH_RADIUS_OPTIONS.map((km) => (
            <button key={km} type="button" role="radio" aria-checked={radiusKm === km} className={radiusKm === km ? "app-nb-radius-opt app-nb-radius-opt--on" : "app-nb-radius-opt"} onClick={() => onRadius?.(km)}>
              {radiusLabel(km)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function NearbyPage() {
  const { navigate } = useRoute();
  const auth = useAuth();
  const point = useProfileCityPoint();
  const inCity = point.settled && point.fromViewer;
  useHeaderTitle(nearbyScreenTitle(inCity));
  const [mode, setMode] = useState<NearbyMode>("timeline");
  const [state, setState] = useState<NearbyState>({ status: "loading" });
  const [hours, setHours] = useState<number>(3);
  const [mood, setMood] = useState<LeisureMood>("relax");
  const [leisure, setLeisure] = useState<LeisureState>({ status: "loading" });
  const [timelineAttempt, setTimelineAttempt] = useState(0);
  const [leisureAttempt, setLeisureAttempt] = useState(0);
  const [planning, setPlanning] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_APP_SETTINGS.searchRadiusKm);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dayKey, setDayKey] = useState<string | null>(null);
  const assistIds = useMapAssistIds(searchOpen ? query : "");
  const userId = auth.status === "authenticated" ? auth.user.id : null;

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    apiClient.getAppSettings(userId).then(
      (settings) => {
        if (alive) setRadiusKm(settings.searchRadiusKm);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!point.settled) return;
    let alive = true;
    setState({ status: "loading" });
    apiClient.getNearbyTimeline(point.latitude, point.longitude, radiusKm).then(
      (timeline) => {
        if (alive) setState({ status: "ready", timeline });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [point.settled, point.latitude, point.longitude, timelineAttempt, radiusKm]);

  // Кнопки «подобрать» в макете нет: цепочка пересобирается сама на смену часов или настроения.
  useEffect(() => {
    if (mode !== "free" || !point.settled) return;
    let alive = true;
    setLeisure({ status: "loading" });
    apiClient.getLeisureOptions({ hours, mood, latitude: point.latitude, longitude: point.longitude, radiusKm }).then(
      (chains) => {
        if (alive) setLeisure({ status: "ready", chains });
      },
      () => {
        if (alive) setLeisure({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [mode, hours, mood, point.settled, point.latitude, point.longitude, leisureAttempt, radiusKm]);

  return (
    <>
      <HeaderSlot>
        <button
          type="button"
          className="app-header-action app-nb-ask"
          aria-label="Поиск"
          aria-pressed={searchOpen}
          onClick={() => {
            setSearchOpen((open) => {
              if (open) setQuery("");
              return !open;
            });
          }}
        >
          <ActionIcon name="search" size={22} />
        </button>
      </HeaderSlot>
      <NearbyView
        mode={mode}
        onMode={setMode}
        state={state}
        leisure={leisure}
        hours={hours}
        mood={mood}
        planning={planning}
        onHours={setHours}
        onMood={setMood}
        onRefresh={() => setLeisureAttempt((value) => value + 1)}
        onRetryTimeline={() => setTimelineAttempt((value) => value + 1)}
        onOpenPlan={(chain) => {
          const draft = chainPlanDraft(chain);
          if (draft === null || planning) return;
          setPlanning(true);
          apiClient.createPlan(draft).then(
            (card) => {
              setPlanning(false);
              navigate({ name: "plan", id: card.plan.id });
            },
            () => setPlanning(false),
          );
        }}
        radiusKm={radiusKm}
        onRadius={(km) => {
          setRadiusKm(km);
          if (userId === null) return;
          apiClient.updateAppSettings(userId, { searchRadiusKm: km }).then(
            () => {},
            () => {},
          );
        }}
        originSource={point.source}
        inCity={inCity}
        query={query}
        onQuery={setQuery}
        searchOpen={searchOpen}
        assistIds={assistIds}
        dayKey={dayKey ?? undefined}
        onDay={setDayKey}
        onOpenEvent={(id) => navigate({ name: "event", id })}
        onOpenLocation={(card) => navigate(nearbyLocationRoute(card.place))}
        onOpenPlace={(id) => navigate({ name: "place", id })}
      />
    </>
  );
}
