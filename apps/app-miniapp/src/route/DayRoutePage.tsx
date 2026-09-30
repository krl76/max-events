// START_MODULE_CONTRACT
// PURPOSE: «Маршрут на день» screen (#176): pick 2..8 event/place stops, build the walking day route (timeline of points with travel legs and totals), then optimize the order and show the savings README-style («11.4 км → 6.8 км, экономия 47 минут») with the optimized timeline redrawn.
// SCOPE: Stop options via apiClient.listEvents/listPlaces (events without a venue excluded — the backend rejects them), build/optimize via apiClient.createDayRoute/optimizeDayRoute from the profile city; checkbox selection order is the route order; loading/error states for options, build and optimize.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (DayRoute, OptimizeRoute, RouteLeg, RouteStopWrite), ../catalog/format.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MIN_ROUTE_STOPS - contract lower stop bound (2)
// - MAX_ROUTE_STOPS - contract upper stop bound (8)
// - DAY_ROUTE_PICK - recommended picker length (3)
// - RouteStopOption - selectable stop (event or place) with a stable key
// - formatLeg - "15 мин / 2.1 км" leg line
// - routeTotalsLabel - "Итого: N мин · X.X км" totals line
// - savingsLabel - README-style optimize savings line
// - RouteOptionsState - options fetch state union (loading / error / ready)
// - DayRouteBuildState - build state union (idle / loading / error / ready)
// - OptimizeState - optimize state union (idle / loading / error / ready)
// - RouteTimeline - presentational: ordered points with the leg after each point
// - DayRouteView - presentational: recommended stops, interests, footer «Далее», then the built timeline
// - DayRoutePage - route container: loads options, wires selection, build and optimize
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { DayRoute, EventCategory, OptimizeRoute, PlaceCategory, RouteLeg, RouteStopWrite } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { CATEGORY_LABELS, PLACE_CATEGORY_LABELS, formatStartsAt, pluralRu } from "../catalog/format";
import { prepositionalCity } from "../geo/city-case";
import { useProfileCityPoint } from "../geo/profile-city";
import { useRoute } from "../routing/router";
import { BackToTop } from "../ui/BackToTop";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppButton, AppState } from "../ui/primitives";
import { ScrollRail } from "../ui/ScrollRail";
import { dayRouteKey, readSavedDayRoutes, rememberDayRoute, type SavedDayRoute } from "./savedDayRoutes";

export const MIN_ROUTE_STOPS = 2;
export const MAX_ROUTE_STOPS = 8;
export const DAY_ROUTE_PICK = 3;

export type DayRouteInterest = "nearby" | "food" | "art" | "fun" | "walks";

export const DAY_ROUTE_INTERESTS: ReadonlyArray<{ id: DayRouteInterest; label: string; icon: ActionIconName }> = [
  { id: "nearby", label: "Рядом", icon: "locate" },
  { id: "food", label: "Еда", icon: "seat" },
  { id: "art", label: "Искусство", icon: "spark" },
  { id: "fun", label: "Развлечения", icon: "ticket" },
  { id: "walks", label: "Прогулки", icon: "walk" },
];

/** Upcoming events with a venue, soonest first — the picker of «Маршрут на день». */
export function upcomingEventsForRoute<T extends { startsAt: string; placeId: string | null }>(events: T[], now: Date = new Date()): T[] {
  const ts = now.getTime();
  return events.filter((event) => event.placeId !== null && Date.parse(event.startsAt) >= ts).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export interface RouteStopOption {
  key: string;
  title: string;
  hint: string | null;
  tags?: string[];
  walkMinutes?: number | null;
  interests?: DayRouteInterest[];
  placeTitle?: string | null;
  imageUrl?: string | null;
  stop: RouteStopWrite;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function walkMinutesBetween(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  return Math.max(1, Math.round(haversineKm(from.latitude, from.longitude, to.latitude, to.longitude) * 12));
}

export function placeInterests(category: PlaceCategory, walkMinutes: number | null): DayRouteInterest[] {
  const interests: DayRouteInterest[] = [];
  if (walkMinutes !== null && walkMinutes <= 20) interests.push("nearby");
  if (category === "food") interests.push("food");
  if (category === "museum") interests.push("art");
  if (category === "other" || category === "sport") interests.push("fun");
  if (category === "park") interests.push("walks");
  return interests;
}

export function eventInterests(category: EventCategory, placeCategory: PlaceCategory | undefined, walkMinutes: number | null): DayRouteInterest[] {
  const fromPlace = placeCategory === undefined ? [] : placeInterests(placeCategory, walkMinutes);
  const extra: DayRouteInterest[] = [];
  if (category === "afisha") extra.push("fun", "art");
  if (category === "tourism") extra.push("walks");
  if (category === "sport") extra.push("fun");
  return [...new Set([...fromPlace, ...extra])];
}

export function routeDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}

export function routePickHint(count: number): string {
  const missing = DAY_ROUTE_PICK - count;
  if (missing > 1) return `Выберите ещё ${missing} ${pluralRu(missing, "место", "места", "мест")}`;
  if (missing === 1) return "Выберите ещё 1 место";
  return "Маршрут можно строить";
}

export function routeBuildLabel(count: number): string {
  return routePickHint(count);
}

function legModeLabel(mode: RouteLeg["mode"]): string {
  if (mode === "taxi") return "на такси";
  if (mode === "metro") return "на метро";
  return "пешком";
}

function legIcon(mode: RouteLeg["mode"]): ActionIconName {
  if (mode === "taxi") return "car";
  if (mode === "metro") return "metro";
  return "walk";
}

export function formatLeg(leg: RouteLeg): string {
  return `${routeDurationLabel(leg.travelMinutes)} ${legModeLabel(leg.mode)} · ${leg.distanceKm.toFixed(1)} км`;
}

export function routeTotalsLabel(route: DayRoute): string {
  return `Итого: ${routeDurationLabel(route.totalMinutes)} · ${route.totalKm.toFixed(1)} км`;
}

export function savingsLabel(result: OptimizeRoute): string {
  return `${result.original.totalKm.toFixed(1)} км → ${result.optimized.totalKm.toFixed(1)} км, экономия ${result.savedMinutes} минут`;
}

export type RouteOptionsState = { status: "loading" } | { status: "error" } | { status: "ready"; options: RouteStopOption[] };

export type DayRouteBuildState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; route: DayRoute };

export type OptimizeState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; result: OptimizeRoute };

export function RouteTimeline({ route }: { route: DayRoute }) {
  return (
    <ol className="app-dayroute-line">
      {route.points.map((point, index) => {
        const leg = route.legs[index];
        return (
          <li key={`${point.title}-${index}`}>
            <div className="app-dayroute-stop">
              <span className="app-dayroute-stop-n">{index + 1}</span>
              <span className="app-dayroute-stop-copy">
                <strong>{point.title}</strong>
                {point.at !== null ? <span>{formatStartsAt(point.at)}</span> : null}
              </span>
            </div>
            {leg !== undefined ? (
              <p className="app-dayroute-leg">
                <ActionIcon name={legIcon(leg.mode)} size={16} />
                <span>{formatLeg(leg)}</span>
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

interface DayRouteViewProps {
  options: RouteOptionsState;
  selected: string[];
  query: string;
  onQuery: (value: string) => void;
  onToggle: (key: string) => void;
  onBuild: () => void;
  built: DayRouteBuildState;
  optimize: OptimizeState;
  onOptimize: () => void;
  onReset: () => void;
  saved?: readonly SavedDayRoute[];
  onSave?: () => void;
  onOpenSaved?: (id: string) => void;
  preview?: DayRoute | null;
  city?: string;
  onClose?: () => void;
}

function StopPhoto({ option }: { option: RouteStopOption }) {
  if (option.imageUrl) return <img className="app-dayroute-photo" alt="" src={option.imageUrl} />;
  return (
    <span className="app-dayroute-photo app-dayroute-photo--empty" aria-hidden="true">
      <ActionIcon name="pin" size={18} />
    </span>
  );
}

function StopRow({ option, selected, disabled, onToggle }: { option: RouteStopOption; selected: boolean; disabled: boolean; onToggle: () => void }) {
  const tags = option.tags ?? [];
  return (
    <button type="button" className={selected ? "app-dayroute-row app-dayroute-row--on" : "app-dayroute-row"} disabled={disabled} onClick={onToggle}>
      <StopPhoto option={option} />
      <span className="app-dayroute-row-body">
        <span className="app-dayroute-row-title">{option.title}</span>
        {tags.length > 0 ? <span className="app-dayroute-row-tags">{tags.join(" · ")}</span> : option.hint !== null ? <span className="app-dayroute-row-tags">{option.hint}</span> : null}
        {option.walkMinutes != null ? (
          <span className="app-dayroute-row-walk">
            <ActionIcon name="walk" size={14} />
            {option.walkMinutes} мин пешком
          </span>
        ) : option.placeTitle ? (
          <span className="app-dayroute-row-walk">{option.placeTitle}</span>
        ) : null}
      </span>
      <span className={selected ? "app-dayroute-check app-dayroute-check--on" : "app-dayroute-check"} aria-hidden="true">
        {selected ? <ActionIcon name="check" size={14} strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

export function DayRouteView({ options, selected, query, onQuery, onToggle, onBuild, built, optimize, onOptimize, onReset, saved = [], onSave, onOpenSaved, preview = null, city = "Москва", onClose }: DayRouteViewProps) {
  const selectedSet = new Set(selected);
  const limitReached = selected.length >= MAX_ROUTE_STOPS;
  const liveRoute = built.status === "ready" ? (optimize.status === "ready" ? optimize.result.optimized : built.route) : null;
  const displayRoute = preview ?? liveRoute;
  const ready = options.status === "ready" ? options.options : [];
  const needle = query.trim().toLowerCase();
  const [interest, setInterest] = useState<DayRouteInterest | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const searched = ready.filter((option) => needle === "" || option.title.toLowerCase().includes(needle) || (option.hint !== null && option.hint.toLowerCase().includes(needle)) || (option.tags ?? []).some((tag) => tag.toLowerCase().includes(needle)));
  const filtered = interest === null ? searched : searched.filter((option) => (option.interests ?? []).includes(interest) || (interest === "nearby" && option.walkMinutes != null && option.walkMinutes <= 20));
  const ranked = [...filtered].sort((a, b) => (a.walkMinutes ?? 999) - (b.walkMinutes ?? 999));
  const recommended = ranked.slice(0, 4);
  const rest = ranked.slice(4);
  const canBuild = selected.length >= MIN_ROUTE_STOPS && built.status !== "loading";
  const savedAlready = displayRoute !== null && saved.some((item) => dayRouteKey(item.route) === dayRouteKey(displayRoute));
  const picking = displayRoute === null;
  return (
    <section className="app-dayroute" aria-label="Маршрут на день">
      <header className="app-dayroute-top">
        {onClose !== undefined ? (
          <button type="button" className="app-dayroute-close" aria-label="Закрыть" onClick={onClose}>
            <ActionIcon name="close" size={18} strokeWidth={2.2} />
          </button>
        ) : null}
        <div className="app-dayroute-heading">
          <h1 className="app-dayroute-title">Маршрут на день</h1>
          <p className="app-dayroute-sub">
            {city} · 3 часа · ₽₽
          </p>
        </div>
      </header>

      {picking ? (
        <>
          {options.status === "loading" && <AppState>Загружаем точки…</AppState>}
          {options.status === "error" && <AppState error>Не удалось загрузить точки маршрута.</AppState>}
          {options.status === "ready" && (
            <>
              <label className="app-dayroute-search">
                <ActionIcon name="search" size={18} />
                <input type="search" value={query} placeholder="Найти событие или место" aria-label="Найти событие или место" onChange={(event) => onQuery(event.target.value)} />
              </label>
              {needle === "" && (
                <div className="app-dayroute-group">
                  <div className="app-dayroute-kicker">
                    <h2 className="app-dayroute-label">Рекомендуем вам</h2>
                    <button type="button" className="app-dayroute-why" onClick={() => setWhyOpen((open) => !open)}>
                      Почему это?
                    </button>
                  </div>
                  <p className="app-dayroute-picked-note">Подобрали для вас</p>
                  {whyOpen ? <p className="app-dayroute-why-copy">Ближе к вам и с коротким переходом пешком.</p> : null}
                </div>
              )}
              {ranked.length === 0 && <AppState>Ничего не нашлось по запросу.</AppState>}
              {(needle !== "" ? ranked : recommended).length > 0 && (
                <ul className="app-dayroute-list" aria-label={needle === "" ? "Рекомендуем вам" : "Результаты поиска"}>
                  {(needle !== "" ? ranked : recommended).map((option) => (
                    <li key={option.key}>
                      <StopRow option={option} selected={selectedSet.has(option.key)} disabled={!selectedSet.has(option.key) && limitReached} onToggle={() => onToggle(option.key)} />
                    </li>
                  ))}
                </ul>
              )}
              {needle === "" && (
                <>
                  <div className="app-dayroute-group">
                    <h2 className="app-dayroute-label">По интересам</h2>
                    <div className="app-dayroute-interests" role="list">
                      {DAY_ROUTE_INTERESTS.map((item) => (
                        <button key={item.id} type="button" className={interest === item.id ? "app-dayroute-interest app-dayroute-interest--on" : "app-dayroute-interest"} aria-pressed={interest === item.id} onClick={() => setInterest((current) => (current === item.id ? null : item.id))}>
                          <span className="app-dayroute-interest-icon" aria-hidden="true">
                            <ActionIcon name={item.icon} size={22} />
                          </span>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" className="app-dayroute-all" onClick={() => setShowAll((open) => !open)}>
                    <span>
                      <strong>Все места в {prepositionalCity(city)}</strong>
                      <span>Показать полный список</span>
                    </span>
                    <ActionIcon name="chevron" size={18} />
                  </button>
                  {rest.length > 0 && (
                    <ul className="app-dayroute-list" hidden={!showAll} aria-label={`Все места в ${prepositionalCity(city)}`}>
                      {rest.map((option) => (
                        <li key={option.key}>
                          <StopRow option={option} selected={selectedSet.has(option.key)} disabled={!selectedSet.has(option.key) && limitReached} onToggle={() => onToggle(option.key)} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {saved.length > 0 && (
                    <div className="app-dayroute-group">
                      <h2 className="app-dayroute-label">Мои маршруты</h2>
                      <ul className="app-dayroute-list" aria-label="Мои маршруты">
                        {saved.map((item) => {
                          const first = item.route.points[0]?.title ?? "Маршрут";
                          const last = item.route.points[item.route.points.length - 1]?.title ?? first;
                          return (
                            <li key={item.id}>
                              <button type="button" className="app-dayroute-row" onClick={() => onOpenSaved?.(item.id)}>
                                <span className="app-dayroute-photo app-dayroute-photo--empty" aria-hidden="true">
                                  <ActionIcon name="navigation" size={18} />
                                </span>
                                <span className="app-dayroute-row-body">
                                  <span className="app-dayroute-row-title">
                                    {first} → {last}
                                  </span>
                                  <span className="app-dayroute-row-hint">
                                    {routeDurationLabel(item.route.totalMinutes)} · {item.route.totalKm.toFixed(1)} км
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {built.status === "loading" && <AppState>Строим маршрут…</AppState>}
          {built.status === "error" && <AppState error>Не удалось построить маршрут. Нужны минимум две точки с адресом.</AppState>}
        </>
      ) : (
        <div className="app-dayroute-result">
          <RouteTimeline route={displayRoute} />
          <p className="app-dayroute-totals">
            <ActionIcon name="clock" size={16} />
            {routeTotalsLabel(displayRoute)}
          </p>
          {optimize.status === "ready" && preview === null && <p className="app-dayroute-save">{savingsLabel(optimize.result)}</p>}
          {optimize.status === "loading" && <AppState>Оптимизируем…</AppState>}
          {optimize.status === "error" && <AppState error>Не удалось оптимизировать маршрут.</AppState>}
        </div>
      )}

      <div className="app-dayroute-cta">
        {displayRoute !== null ? (
          <>
            {onSave !== undefined && preview === null ? (
              <AppButton className="app-key-cta" stretched disabled={savedAlready} onClick={onSave}>
                {savedAlready ? "Сохранено в мои маршруты" : "Сохранить в мои маршруты"}
              </AppButton>
            ) : null}
            {preview === null ? (
              <AppButton className="app-key-cta" tone="secondary" stretched disabled={optimize.status === "loading"} onClick={onOptimize}>
                Оптимизировать порядок
              </AppButton>
            ) : null}
            <AppButton className="app-key-cta" tone="secondary" stretched onClick={onReset}>
              {preview === null ? "Изменить точки" : "К выбору точек"}
            </AppButton>
          </>
        ) : (
          <div className="app-dayroute-cta-bar">
            <p className="app-dayroute-cta-copy">
              <strong>
                Выбрано {selected.length} из {DAY_ROUTE_PICK}
              </strong>
              <span>{routePickHint(selected.length)}</span>
            </p>
            <AppButton className="app-key-cta" onClick={onBuild} disabled={!canBuild}>
              Далее
            </AppButton>
          </div>
        )}
      </div>
      <BackToTop place={displayRoute === null ? "dock" : "result"} />
      <ScrollRail />
    </section>
  );
}

export function DayRoutePage() {
  const { back } = useRoute();
  const point = useProfileCityPoint();
  const [options, setOptions] = useState<RouteOptionsState>({ status: "loading" });
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [built, setBuilt] = useState<DayRouteBuildState>({ status: "idle" });
  const [optimize, setOptimize] = useState<OptimizeState>({ status: "idle" });
  const [saved, setSaved] = useState<SavedDayRoute[]>([]);
  const [preview, setPreview] = useState<DayRoute | null>(null);

  useEffect(() => {
    setSaved(readSavedDayRoutes());
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([apiClient.listEvents(), apiClient.listPlaces()]).then(
      ([events, places]) => {
        if (!alive) return;
        const placeById = new Map(places.map((place) => [place.id, place]));
        const origin = { latitude: point.latitude, longitude: point.longitude };
        setOptions({
          status: "ready",
          options: [
            ...upcomingEventsForRoute(events).map((event) => {
              const place = event.placeId === null ? undefined : placeById.get(event.placeId);
              const walkMinutes = place === undefined ? null : walkMinutesBetween(origin, place);
              const tags = [CATEGORY_LABELS[event.category], place?.title].filter((tag): tag is string => Boolean(tag));
              return { key: `event:${event.id}`, title: event.title, hint: formatStartsAt(event.startsAt), tags, walkMinutes, interests: eventInterests(event.category, place?.category, walkMinutes), placeTitle: place?.title ?? null, imageUrl: pictured(event.id, event.coverUrl), stop: { eventId: event.id } };
            }),
            ...places.map((place) => {
              const walkMinutes = walkMinutesBetween(origin, place);
              return { key: `place:${place.id}`, title: place.title, hint: place.address, tags: [PLACE_CATEGORY_LABELS[place.category]], walkMinutes, interests: placeInterests(place.category, walkMinutes), imageUrl: pictured(place.id, place.logoUrl), stop: { placeId: place.id } };
            }),
          ],
        });
      },
      () => {
        if (alive) setOptions({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [point.latitude, point.longitude]);

  const toggle = (key: string) => {
    setPreview(null);
    setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : current.length >= MAX_ROUTE_STOPS ? current : [...current, key]));
    setBuilt({ status: "idle" });
    setOptimize({ status: "idle" });
  };

  const selectedStops = (): RouteStopWrite[] => {
    if (options.status !== "ready") return [];
    const byKey = new Map(options.options.map((option) => [option.key, option.stop]));
    return selected.flatMap((key) => {
      const stop = byKey.get(key);
      return stop === undefined ? [] : [stop];
    });
  };

  const build = () => {
    if (selected.length < MIN_ROUTE_STOPS) return;
    setPreview(null);
    setBuilt({ status: "loading" });
    setOptimize({ status: "idle" });
    apiClient.createDayRoute(selectedStops(), point.latitude, point.longitude).then(
      (route) => setBuilt({ status: "ready", route }),
      () => setBuilt({ status: "error" }),
    );
  };

  const runOptimize = () => {
    setOptimize({ status: "loading" });
    apiClient.optimizeDayRoute(selectedStops(), point.latitude, point.longitude).then(
      (result) => setOptimize({ status: "ready", result }),
      () => setOptimize({ status: "error" }),
    );
  };

  return (
    <DayRouteView
      options={options}
      selected={selected}
      query={query}
      onQuery={setQuery}
      onToggle={toggle}
      onBuild={build}
      built={built}
      optimize={optimize}
      onOptimize={runOptimize}
      onReset={() => {
        setPreview(null);
        setBuilt({ status: "idle" });
        setOptimize({ status: "idle" });
      }}
      saved={saved}
      preview={preview}
      onSave={() => {
        if (built.status !== "ready") return;
        const route = optimize.status === "ready" ? optimize.result.optimized : built.route;
        setSaved(rememberDayRoute(route));
      }}
      onOpenSaved={(id) => {
        const item = saved.find((row) => row.id === id);
        if (item === undefined) return;
        setBuilt({ status: "idle" });
        setOptimize({ status: "idle" });
        setPreview(item.route);
      }}
      city={point.city ?? "Москва"}
      onClose={back}
    />
  );
}
