// START_MODULE_CONTRACT
// PURPOSE: «Рядом со мной» (макет, экраны 13 и 14): two modes behind the app-wide row of filter pills — the four-segment timeline inside 15 km, and the free-window builder that turns hours plus a mood into a chain of stops.
// SCOPE: Data via apiClient.getNearbyTimeline/getLeisureOptions at useViewerOrigin; mode/hours/mood local state; «Открыть как план» creates a plan via apiClient.createPlan and pushes экран 15; loading/error/empty states for both modes.
// DEPENDS: ../api/client.js (apiClient, LeisureChain, LeisureChainStop), @max-events/api-contracts (LeisureMood, NearbyBucket, NearbyCard, NearbyTimeline), ../catalog/format.js (pluralRu), ../geo/viewer-origin.js, ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
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
// - NearbyView - presentational: the row of mode pills plus whichever mode is open
// - NearbyPage - route container: loads the timeline and the chain, creates the plan, wires navigation
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { LeisureMood, NearbyBucket, NearbyCard, NearbyTimeline } from "@max-events/api-contracts";
import { apiClient, type LeisureChain, type LeisureChainStop } from "../api/client";
import { pluralRu } from "../catalog/format";
import { useViewerOrigin } from "../geo/viewer-origin";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppChip, AppMedia, AppSkeletonList, AppState } from "../ui/primitives";

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
  onOpenPlace: (id: string) => void;
}

function TimelineCard({ card, onOpenEvent }: { card: NearbyCard; onOpenEvent: (id: string) => void }) {
  return (
    <button type="button" className="app-nb-card" onClick={() => onOpenEvent(card.event.id)}>
      <span className="app-nb-card-media">
        <AppMedia category={card.event.category} />
        {card.promoted && <span className="app-nb-card-promo">Промо</span>}
      </span>
      <span className="app-nb-card-body">
        <span className="app-nb-card-title">{card.event.title}</span>
        <span className="app-nb-card-sub">
          {card.place.title} · {nearbyCardWhen(card)}
        </span>
        <span className="app-nb-card-km">{formatDistanceKm(card.distanceKm)}</span>
      </span>
    </button>
  );
}

function Timeline({ state, onRetryTimeline, onOpenEvent }: Pick<NearbyViewProps, "state" | "onRetryTimeline" | "onOpenEvent">) {
  const segments = state.status === "ready" ? NEARBY_BUCKETS.map((bucket) => ({ bucket, cards: state.timeline[bucket] })).filter((segment) => segment.cards.length > 0) : [];

  return (
    <>
      <p className="app-nb-meta">
        <ActionIcon name="pin" size={14} strokeWidth={2.2} />
        Радиус {NEARBY_RADIUS_KM} км · время московское
      </p>
      {state.status === "loading" && <AppSkeletonList rows={3} />}
      {state.status === "error" && (
        <AppState error action={{ label: "Повторить", onClick: onRetryTimeline }}>
          Не удалось загрузить события рядом.
        </AppState>
      )}
      {state.status === "ready" && segments.length === 0 && <AppState hint={`Мы смотрим только на ${NEARBY_RADIUS_KM} км вокруг`}>Рядом пока ничего не начинается</AppState>}
      {segments.map((segment) => (
        <section key={segment.bucket} className="app-nb-seg" aria-label={BUCKET_LABELS[segment.bucket]}>
          <div className="app-nb-seg-head">
            <h2 className="app-nb-seg-title">{BUCKET_LABELS[segment.bucket]}</h2>
            <span className="app-nb-seg-count">{bucketCountLabel(segment.cards.length)}</span>
          </div>
          <div className="app-nb-rail">
            {segment.cards.map((card) => (
              <TimelineCard key={card.event.id} card={card} onOpenEvent={onOpenEvent} />
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

const MODE_LABELS: Record<NearbyMode, string> = { timeline: "Таймлайн", free: "Свободное время" };

export function NearbyView({ mode, onMode, state, leisure, hours, mood, now = new Date(), planning, onHours, onMood, onRefresh, onRetryTimeline, onOpenPlan, onOpenEvent, onOpenPlace }: NearbyViewProps) {
  return (
    <section className="app-nb">
      {/* Тот же ряд пилюль, что и на вкладке «Планы»: переключение раздела списка в приложении выглядит одинаково */}
      <div className="app-tab-row" role="group" aria-label="Режим">
        {(Object.keys(MODE_LABELS) as NearbyMode[]).map((value) => (
          <AppChip key={value} pressed={mode === value} onClick={() => onMode(value)}>
            {MODE_LABELS[value]}
          </AppChip>
        ))}
      </div>
      {mode === "timeline" ? <Timeline state={state} onRetryTimeline={onRetryTimeline} onOpenEvent={onOpenEvent} /> : <FreeWindow leisure={leisure} hours={hours} mood={mood} now={now} planning={planning} onHours={onHours} onMood={onMood} onRefresh={onRefresh} onOpenPlan={onOpenPlan} onOpenEvent={onOpenEvent} onOpenPlace={onOpenPlace} />}
    </section>
  );
}

export function NearbyPage() {
  const { navigate } = useRoute();
  const origin = useViewerOrigin();
  const [mode, setMode] = useState<NearbyMode>("timeline");
  const [state, setState] = useState<NearbyState>({ status: "loading" });
  const [hours, setHours] = useState<number>(3);
  const [mood, setMood] = useState<LeisureMood>("relax");
  const [leisure, setLeisure] = useState<LeisureState>({ status: "loading" });
  const [timelineAttempt, setTimelineAttempt] = useState(0);
  const [leisureAttempt, setLeisureAttempt] = useState(0);
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getNearbyTimeline(origin.latitude, origin.longitude).then(
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
  }, [origin.latitude, origin.longitude, timelineAttempt]);

  // Кнопки «подобрать» в макете нет: цепочка пересобирается сама на смену часов или настроения.
  useEffect(() => {
    if (mode !== "free") return;
    let alive = true;
    setLeisure({ status: "loading" });
    apiClient.getLeisureOptions({ hours, mood, latitude: origin.latitude, longitude: origin.longitude }).then(
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
  }, [mode, hours, mood, origin.latitude, origin.longitude, leisureAttempt]);

  return (
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
      onOpenEvent={(id) => navigate({ name: "event", id })}
      onOpenPlace={(id) => navigate({ name: "place", id })}
    />
  );
}
