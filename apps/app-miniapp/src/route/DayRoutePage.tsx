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
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppState } from "../ui/primitives";

export const MIN_ROUTE_STOPS = 2;
export const MAX_ROUTE_STOPS = 8;

export interface RouteStopOption {
  key: string;
  title: string;
  hint: string | null;
  stop: RouteStopWrite;
}

export function formatLeg(leg: RouteLeg): string {
  return `${leg.travelMinutes} мин / ${leg.distanceKm.toFixed(1)} км`;
}

export function routeTotalsLabel(route: DayRoute): string {
  return `Итого: ${route.totalMinutes} мин · ${route.totalKm.toFixed(1)} км`;
}

export function savingsLabel(result: OptimizeRoute): string {
  return `${result.original.totalKm.toFixed(1)} км → ${result.optimized.totalKm.toFixed(1)} км, экономия ${result.savedMinutes} минут`;
}

export type RouteOptionsState = { status: "loading" } | { status: "error" } | { status: "ready"; options: RouteStopOption[] };

export type DayRouteBuildState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; route: DayRoute };

export type OptimizeState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; result: OptimizeRoute };

export function RouteTimeline({ route }: { route: DayRoute }) {
  return (
    <ol className="app-plan-participants">
      {route.points.map((point, index) => (
        <li key={index} className="app-plan-participant">
          <span>
            {point.title}
            {point.at !== null ? ` · ${formatStartsAt(point.at)}` : ""}
          </span>
          {index < route.legs.length && <span>↓ {formatLeg(route.legs[index])}</span>}
        </li>
      ))}
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
  onClose: () => void;
  onReset: () => void;
}

export function DayRouteView({ options, selected, query, onQuery, onToggle, onBuild, built, optimize, onOptimize, onClose, onReset }: DayRouteViewProps) {
  const selectedSet = new Set(selected);
  const limitReached = selected.length >= MAX_ROUTE_STOPS;
  const displayRoute = built.status === "ready" ? (optimize.status === "ready" ? optimize.result.optimized : built.route) : null;
  const ready = options.status === "ready" ? options.options : [];
  const picked = ready.filter((option) => selectedSet.has(option.key));
  const needle = query.trim().toLowerCase();
  const visible = ready.filter((option) => needle === "" || option.title.toLowerCase().includes(needle) || (option.hint !== null && option.hint.toLowerCase().includes(needle)));
  const events = visible.filter((option) => option.stop.eventId != null);
  const places = visible.filter((option) => option.stop.placeId != null);
  const canBuild = selected.length >= MIN_ROUTE_STOPS && built.status !== "loading";
  return (
    <section className="app-dayroute" aria-label="Маршрут на день">
      <header className="app-dayroute-top">
        <button type="button" className="app-dayroute-close" aria-label="Закрыть" onClick={onClose}>
          <ActionIcon name="close" size={20} strokeWidth={2.2} />
        </button>
        <div className="app-dayroute-heading">
          <h1 className="app-dayroute-title">Маршрут на день</h1>
          <p className="app-dayroute-sub">
            {selected.length} из {MAX_ROUTE_STOPS} · минимум {MIN_ROUTE_STOPS}
          </p>
        </div>
      </header>

      {picked.length > 0 && (
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
          <p className="app-dayroute-totals">{routeTotalsLabel(displayRoute)}</p>
          {optimize.status === "ready" && <p className="app-dayroute-save">{savingsLabel(optimize.result)}</p>}
          <AppButton onClick={onOptimize} tone="secondary" stretched disabled={optimize.status === "loading"}>
            Оптимизировать порядок
          </AppButton>
          {optimize.status === "loading" && <AppState>Оптимизируем…</AppState>}
          {optimize.status === "error" && <AppState error>Не удалось оптимизировать маршрут.</AppState>}
        </div>
      ) : (
        <>
          {options.status === "loading" && <AppState>Загружаем точки…</AppState>}
          {options.status === "error" && <AppState error>Не удалось загрузить точки маршрута.</AppState>}
          {options.status === "ready" && (
            <>
              <input className="app-filters-input" type="search" value={query} placeholder="Найти событие или место" aria-label="Поиск точек" onChange={(event) => onQuery(event.target.value)} />
              {visible.length === 0 && <AppState>Ничего не нашлось по запросу.</AppState>}
              {events.length > 0 && (
                <div className="app-dayroute-group">
                  <h2 className="app-dayroute-label">События</h2>
                  <ul className="app-dayroute-list" aria-label="События">
                    {events.map((option) => (
                      <li key={option.key}>
                        <button type="button" className={selectedSet.has(option.key) ? "app-dayroute-row app-dayroute-row--on" : "app-dayroute-row"} disabled={!selectedSet.has(option.key) && limitReached} onClick={() => onToggle(option.key)}>
                          <span className="app-dayroute-check" aria-hidden="true">
                            {selectedSet.has(option.key) ? "✓" : ""}
                          </span>
                          <span className="app-dayroute-row-body">
                            <span className="app-dayroute-row-title">{option.title}</span>
                            {option.hint !== null && <span className="app-dayroute-row-hint">{option.hint}</span>}
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
                          <span className="app-dayroute-check" aria-hidden="true">
                            {selectedSet.has(option.key) ? "✓" : ""}
                          </span>
                          <span className="app-dayroute-row-body">
                            <span className="app-dayroute-row-title">{option.title}</span>
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
          <AppButton tone="secondary" stretched onClick={onReset}>
            Изменить точки
          </AppButton>
        ) : (
          <AppButton onClick={onBuild} disabled={!canBuild} stretched>
            Готово
          </AppButton>
        )}
        {selected.length < MIN_ROUTE_STOPS && displayRoute === null && <p className="app-dayroute-hint">Выберите минимум {MIN_ROUTE_STOPS} точки — и нажмите «Готово».</p>}
      </div>
    </section>
  );
}

export function DayRoutePage() {
  const point = useProfileCityPoint();
  const { back } = useRoute();
  const [options, setOptions] = useState<RouteOptionsState>({ status: "loading" });
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [built, setBuilt] = useState<DayRouteBuildState>({ status: "idle" });
  const [optimize, setOptimize] = useState<OptimizeState>({ status: "idle" });

  useEffect(() => {
    let alive = true;
    Promise.all([apiClient.listEvents(), apiClient.listPlaces()]).then(
      ([events, places]) => {
        if (!alive) return;
        setOptions({
          status: "ready",
          options: [...events.filter((event) => event.placeId !== null).map((event) => ({ key: `event:${event.id}`, title: event.title, hint: formatStartsAt(event.startsAt), stop: { eventId: event.id } })), ...places.map((place) => ({ key: `place:${place.id}`, title: place.title, hint: null, stop: { placeId: place.id } }))],
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
      onClose={back}
      onReset={() => {
        setBuilt({ status: "idle" });
        setOptimize({ status: "idle" });
      }}
    />
  );
}
