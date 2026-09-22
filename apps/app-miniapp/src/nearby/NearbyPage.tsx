// START_MODULE_CONTRACT
// PURPOSE: «Рядом со мной» screen (#170/#171): four-segment timeline (Сейчас → Через час → Вечером → Завтра) of nearby event cards with distance, plus the «Свободно N часов» leisure-chain mode.
// SCOPE: Data via apiClient.getNearbyTimeline/getLeisureOptions at useViewerOrigin; segment/hours/mood local UI state; expandable leisure chains via native <details>; navigation to the event/place routes; loading/error/empty states for both blocks.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (NearbyBucket, NearbyCard, NearbyTimeline, LeisureMood, LeisureOption), ../catalog/CatalogPage.js (formatStartsAt), ../geo/viewer-origin.js, ../routing/router.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NEARBY_BUCKETS - ordered bucket keys of the segment scale
// - BUCKET_LABELS - ru segment labels (Сейчас / Через час / Вечером / Завтра)
// - LEISURE_MOOD_LABELS - ru labels per LeisureMood
// - LEISURE_HOURS - selectable free-window lengths (1..8, backend contract)
// - formatDistanceKm - "1.2 км" formatting
// - NearbyState - timeline fetch state union (loading / error / ready)
// - LeisureState - leisure fetch state union (idle / loading / error / ready)
// - NearbyView - presentational: segment chips, bucket cards with «Промо» badge, leisure form and expandable chains
// - NearbyPage - route container: loads the timeline, wires leisure queries and navigation
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { LeisureMood, LeisureOption, NearbyBucket, NearbyCard, NearbyTimeline } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { formatStartsAt } from "../catalog/CatalogPage";
import { useViewerOrigin } from "../geo/viewer-origin";
import { useRoute } from "../routing/router";
import { AppButton, AppChip, AppTitle, AppState } from "../ui/primitives";

export const NEARBY_BUCKETS = ["now", "inAnHour", "evening", "tomorrow"] as const satisfies readonly NearbyBucket[];

export const BUCKET_LABELS: Record<NearbyBucket, string> = { now: "Сейчас", inAnHour: "Через час", evening: "Вечером", tomorrow: "Завтра" };

export const LEISURE_MOOD_LABELS: Record<LeisureMood, string> = { relax: "Расслабиться", active: "Активно", friends: "С друзьями" };

export const LEISURE_HOURS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function formatDistanceKm(distanceKm: number): string {
  return `${distanceKm.toFixed(1)} км`;
}

export type NearbyState = { status: "loading" } | { status: "error" } | { status: "ready"; timeline: NearbyTimeline };

export type LeisureState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; options: LeisureOption[] };

interface CardHandlers {
  onOpenEvent: (id: string) => void;
  onOpenPlace: (id: string) => void;
}

function NearbyCardView({ card, onOpenEvent, onOpenPlace }: { card: NearbyCard } & CardHandlers) {
  return (
    <div className="app-card">
      <div className="app-card-body">
        <span className="app-card-title">{card.event.title}</span>
        <span className="app-card-subtitle">
          {formatStartsAt(card.event.startsAt)} · {card.place.title} · {formatDistanceKm(card.distanceKm)}
        </span>
        {card.promoted && <span className="app-today-chip">Промо</span>}
        <span className="app-nearby-actions">
          <AppButton onClick={() => onOpenEvent(card.event.id)}>Открыть событие</AppButton>
          <AppButton tone="ghost" onClick={() => onOpenPlace(card.place.id)}>
            Место
          </AppButton>
        </span>
      </div>
    </div>
  );
}

function LeisureOptionCard({ option, onOpenEvent, onOpenPlace }: { option: LeisureOption } & CardHandlers) {
  return (
    <details className="app-card app-nearby-option">
      <summary className="app-card-body">
        <span className="app-card-title">{option.title}</span>
        <span className="app-card-subtitle">
          {LEISURE_MOOD_LABELS[option.mood]} · Остановок: {option.stops.length}
        </span>
      </summary>
      <ol className="app-nearby-stops">
        {option.stops.map((stop, index) => (
          <li key={index} className="app-nearby-stop">
            <span aria-hidden>{stop.kind === "place" ? "📍" : "🎫"}</span>
            <span className="app-nearby-stop-title">
              {stop.title}
              {stop.startsAt !== null ? ` · ${formatStartsAt(stop.startsAt)}` : ""}
              {stop.distanceKm !== null ? ` · ${formatDistanceKm(stop.distanceKm)}` : ""}
              {stop.priceRub !== null ? ` · ${stop.priceRub} ₽` : ""}
            </span>
            <button type="button" className="app-nearby-stop-open" onClick={() => (stop.kind === "event" && stop.eventId !== null ? onOpenEvent(stop.eventId) : stop.placeId !== null ? onOpenPlace(stop.placeId) : undefined)}>
              Открыть
            </button>
          </li>
        ))}
      </ol>
    </details>
  );
}

interface NearbyViewProps extends CardHandlers {
  state: NearbyState;
  bucket: NearbyBucket;
  onBucket: (bucket: NearbyBucket) => void;
  leisure: LeisureState;
  hours: number;
  mood: LeisureMood;
  onHours: (hours: number) => void;
  onMood: (mood: LeisureMood) => void;
  onShowLeisure: () => void;
}

export function NearbyView({ state, bucket, onBucket, leisure, hours, mood, onHours, onMood, onShowLeisure, onOpenEvent, onOpenPlace }: NearbyViewProps) {
  return (
    <>
      <div className="app-whereto-chips" role="group" aria-label="Время">
        {NEARBY_BUCKETS.map((item) => (
          <AppChip key={item} pressed={bucket === item} onClick={() => onBucket(item)}>
            {BUCKET_LABELS[item]}
          </AppChip>
        ))}
      </div>
      {state.status === "loading" && <AppState>Загружаем события рядом…</AppState>}
      {state.status === "error" && <AppState error>Не удалось загрузить события рядом.</AppState>}
      {state.status === "ready" && state.timeline[bucket].length === 0 && <AppState>На «{BUCKET_LABELS[bucket]}» рядом ничего нет.</AppState>}
      {state.status === "ready" && state.timeline[bucket].map((card) => <NearbyCardView key={card.event.id} card={card} onOpenEvent={onOpenEvent} onOpenPlace={onOpenPlace} />)}

      <AppTitle asChild>
        <h2 className="app-section-title">Свободно время?</h2>
      </AppTitle>
      <div className="app-whereto-chips" role="group" aria-label="Сколько часов свободно">
        <span className="app-whereto-chips-label">Часов</span>
        {LEISURE_HOURS.map((value) => (
          <AppChip key={value} pressed={hours === value} onClick={() => onHours(value)}>
            {value}
          </AppChip>
        ))}
      </div>
      <div className="app-whereto-chips" role="group" aria-label="Настроение">
        <span className="app-whereto-chips-label">Настроение</span>
        {(Object.keys(LEISURE_MOOD_LABELS) as LeisureMood[]).map((value) => (
          <AppChip key={value} pressed={mood === value} onClick={() => onMood(value)}>
            {LEISURE_MOOD_LABELS[value]}
          </AppChip>
        ))}
      </div>
      <AppButton onClick={onShowLeisure} stretched>
        Подобрать досуг
      </AppButton>
      {leisure.status === "loading" && <AppState>Подбираем цепочку…</AppState>}
      {leisure.status === "error" && <AppState error>Не удалось подобрать досуг.</AppState>}
      {leisure.status === "ready" && leisure.options.length === 0 && <AppState>Не нашлось цепочки — попробуйте другое настроение.</AppState>}
      {leisure.status === "ready" && leisure.options.map((option) => <LeisureOptionCard key={option.title} option={option} onOpenEvent={onOpenEvent} onOpenPlace={onOpenPlace} />)}
    </>
  );
}

export function NearbyPage() {
  const { navigate } = useRoute();
  const origin = useViewerOrigin();
  const [state, setState] = useState<NearbyState>({ status: "loading" });
  const [bucket, setBucket] = useState<NearbyBucket>("now");
  const [hours, setHours] = useState<number>(2);
  const [mood, setMood] = useState<LeisureMood>("relax");
  const [leisure, setLeisure] = useState<LeisureState>({ status: "idle" });

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
  }, [origin.latitude, origin.longitude]);

  const showLeisure = () => {
    setLeisure({ status: "loading" });
    apiClient.getLeisureOptions({ hours, mood, latitude: origin.latitude, longitude: origin.longitude }).then(
      (options) => setLeisure({ status: "ready", options }),
      () => setLeisure({ status: "error" }),
    );
  };

  return <NearbyView state={state} bucket={bucket} onBucket={setBucket} leisure={leisure} hours={hours} mood={mood} onHours={setHours} onMood={setMood} onShowLeisure={showLeisure} onOpenEvent={(id) => navigate({ name: "event", id })} onOpenPlace={(id) => navigate({ name: "place", id })} />;
}
