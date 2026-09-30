// START_MODULE_CONTRACT
// PURPOSE: «Маршрут на день» screen (#176): pick 2..8 event/place stops, build the walking day route (timeline of points with travel legs and totals), then optimize the order and show the savings README-style («11.4 км → 6.8 км, экономия 47 минут») with the optimized timeline redrawn.
// SCOPE: Stop options via apiClient.listEvents/listPlaces (events without a venue excluded — the backend rejects them), build/optimize via apiClient.createDayRoute/optimizeDayRoute from the fixed Moscow center; checkbox selection order is the route order; loading/error states for options, build and optimize.
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (DayRoute, OptimizeRoute, RouteLeg, RouteStopWrite), ../catalog/CatalogPage.js (formatStartsAt), ../catalog/MapScreen.js (MOSCOW_CENTER), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MIN_ROUTE_STOPS - contract lower stop bound (2)
// - MAX_ROUTE_STOPS - contract upper stop bound (8)
// - RouteStopOption - selectable stop (event or place) with a stable key
// - formatLeg - "15 мин / 2.1 км" leg line
// - routeTotalsLabel - "Итого: N мин · X.X км" totals line
// - savingsLabel - README-style optimize savings line
// - RouteOptionsState - options fetch state union (loading / error / ready)
// - DayRouteBuildState - build state union (idle / loading / error / ready)
// - OptimizeState - optimize state union (idle / loading / error / ready)
// - RouteTimeline - presentational: ordered points with the leg after each point
// - DayRouteView - presentational: stop checkboxes with the counter, build CTA, timeline, optimize CTA and savings
// - DayRoutePage - route container: loads options, wires selection, build and optimize
// END_MODULE_MAP

import { useEffect, useState } from "react";
import type { DayRoute, OptimizeRoute, RouteLeg, RouteStopWrite } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { formatStartsAt } from "../catalog/CatalogPage";
import { useProfileCityPoint } from "../geo/profile-city";
import { BackToTop } from "../ui/BackToTop";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppButton, AppState } from "../ui/primitives";
import { ScrollRail } from "../ui/ScrollRail";
import { dayRouteKey, readSavedDayRoutes, rememberDayRoute, type SavedDayRoute } from "./savedDayRoutes";

export const MIN_ROUTE_STOPS = 2;
export const MAX_ROUTE_STOPS = 8;

/** Upcoming events with a venue, soonest first — the picker of «Маршрут на день». */
export function upcomingEventsForRoute<T extends { startsAt: string; placeId: string | null }>(events: T[], now: Date = new Date()): T[] {
  const ts = now.getTime();
  return events.filter((event) => event.placeId !== null && Date.parse(event.startsAt) >= ts).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export interface RouteStopOption {
  key: string;
  title: string;
  hint: string | null;
  placeTitle?: string | null;
  imageUrl?: string | null;
  stop: RouteStopWrite;
}

export function routeDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}

export function routeBuildLabel(count: number): string {
  const missing = MIN_ROUTE_STOPS - count;
  if (missing >= 2) return "Выбери ещё 2 места";
  if (missing === 1) return "Выбери ещё 1 место";
  return "Готово";
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
}

function StopPhoto({ option }: { option: RouteStopOption }) {
  if (option.imageUrl) return <img className="app-dayroute-photo" alt="" src={option.imageUrl} />;
  return (
    <span className="app-dayroute-photo app-dayroute-photo--empty" aria-hidden="true">
      <ActionIcon name="pin" size={18} />
    </span>
  );
}

export function DayRouteView({ options, selected, query, onQuery, onToggle, onBuild, built, optimize, onOptimize, onReset, saved = [], onSave, onOpenSaved, preview = null }: DayRouteViewProps) {
  const selectedSet = new Set(selected);
  const limitReached = selected.length >= MAX_ROUTE_STOPS;
  const liveRoute = built.status === "ready" ? (optimize.status === "ready" ? optimize.result.optimized : built.route) : null;
  const displayRoute = preview ?? liveRoute;
  const ready = options.status === "ready" ? options.options : [];
  const picked = ready.filter((option) => selectedSet.has(option.key));
  const needle = query.trim().toLowerCase();
  const visible = ready.filter((option) => needle === "" || option.title.toLowerCase().includes(needle) || (option.hint !== null && option.hint.toLowerCase().includes(needle)));
  const events = visible.filter((option) => option.stop.eventId != null);
  const places = visible.filter((option) => option.stop.placeId != null);
  const canBuild = selected.length >= MIN_ROUTE_STOPS && built.status !== "loading";
  const savedAlready = displayRoute !== null && saved.some((item) => dayRouteKey(item.route) === dayRouteKey(displayRoute));
  return (
    <section className="app-dayroute" aria-label="Маршрут на день">
      <header className="app-dayroute-top">
        <div className="app-dayroute-heading">
          <h1 className="app-dayroute-title">Маршрут на день</h1>
          <p className="app-dayroute-sub">
            {selected.length} из {MAX_ROUTE_STOPS}
          </p>
        </div>
      </header>

      {picked.length > 0 && preview === null && (
        <div className="app-dayroute-picked" aria-label="Выбранные точки">
          {picked.map((option, index) => (
            <button key={option.key} type="button" className="app-dayroute-chip" onClick={() => onToggle(option.key)}>
              <span className="app-dayroute-chip-n">{index + 1}</span>
              {option.title}
              <ActionIcon name="close" size={12} strokeWidth={2.4} />
            </button>
          ))}
        </div>
      )}

      {displayRoute !== null ? (
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
      ) : (
        <>
          {options.status === "loading" && <AppState>Загружаем точки…</AppState>}
          {options.status === "error" && <AppState error>Не удалось загрузить точки маршрута.</AppState>}
          {options.status === "ready" && (
            <>
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
              <input className="app-filters-input" type="search" value={query} placeholder="Найти событие или место" aria-label="Поиск точек" onChange={(event) => onQuery(event.target.value)} />
              {visible.length === 0 && <AppState>Ничего не нашлось по запросу.</AppState>}
              {events.length > 0 && (
                <div className="app-dayroute-group">
                  <h2 className="app-dayroute-label">События</h2>
                  <ul className="app-dayroute-list" aria-label="События">
                    {events.map((option) => (
                      <li key={option.key}>
                        <button type="button" className={selectedSet.has(option.key) ? "app-dayroute-row app-dayroute-row--on" : "app-dayroute-row"} disabled={!selectedSet.has(option.key) && limitReached} onClick={() => onToggle(option.key)}>
                          <StopPhoto option={option} />
                          <span className="app-dayroute-row-body">
                            <span className="app-dayroute-row-title">{option.title}</span>
                            {option.hint !== null && <span className="app-dayroute-row-hint">{option.hint}</span>}
                            {option.placeTitle ? <span className="app-dayroute-row-hint">{option.placeTitle}</span> : null}
                          </span>
                          <span className={selectedSet.has(option.key) ? "app-dayroute-check app-dayroute-check--on" : "app-dayroute-check"} aria-hidden="true">
                            {selectedSet.has(option.key) ? "✓" : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {places.length > 0 && (
                <div className="app-dayroute-group">
                  <h2 className="app-dayroute-label">Места</h2>
                  <ul className="app-dayroute-list" aria-label="Места">
                    {places.map((option) => (
                      <li key={option.key}>
                        <button type="button" className={selectedSet.has(option.key) ? "app-dayroute-row app-dayroute-row--on" : "app-dayroute-row"} disabled={!selectedSet.has(option.key) && limitReached} onClick={() => onToggle(option.key)}>
                          <StopPhoto option={option} />
                          <span className="app-dayroute-row-body">
                            <span className="app-dayroute-row-title">{option.title}</span>
                            {option.hint !== null && <span className="app-dayroute-row-hint">{option.hint}</span>}
                          </span>
                          <span className={selectedSet.has(option.key) ? "app-dayroute-check app-dayroute-check--on" : "app-dayroute-check"} aria-hidden="true">
                            {selectedSet.has(option.key) ? "✓" : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {built.status === "loading" && <AppState>Строим маршрут…</AppState>}
          {built.status === "error" && <AppState error>Не удалось построить маршрут. Нужны минимум две точки с адресом.</AppState>}
        </>
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
          <AppButton className="app-key-cta" onClick={onBuild} disabled={!canBuild} stretched>
            {routeBuildLabel(selected.length)}
          </AppButton>
        )}
      </div>
      <BackToTop place={displayRoute === null ? "dock" : "result"} />
      <ScrollRail />
    </section>
  );
}

export function DayRoutePage() {
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
        setOptions({
          status: "ready",
          options: [
            ...upcomingEventsForRoute(events).map((event) => {
              const place = event.placeId === null ? undefined : placeById.get(event.placeId);
              return { key: `event:${event.id}`, title: event.title, hint: formatStartsAt(event.startsAt), placeTitle: place?.title ?? null, imageUrl: pictured(event.id, event.coverUrl), stop: { eventId: event.id } };
            }),
            ...places.map((place) => ({ key: `place:${place.id}`, title: place.title, hint: place.address, imageUrl: null, stop: { placeId: place.id } })),
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
  }, []);

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
    />
  );
}
