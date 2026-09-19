import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DayRoute, OptimizeRoute, RouteStopWrite } from "@max-events/api-contracts";
import { DayRoutePage, DayRouteView, formatLeg, MAX_ROUTE_STOPS, routeTotalsLabel, savingsLabel, type DayRouteBuildState, type OptimizeState, type RouteStopOption } from "./DayRoutePage";
import { buildMockDayRoute, mockEvents, mockPlaces, optimizeMockDayRoute } from "../api/mock";

const MOSCOW: [number, number] = [55.7522, 37.6156];
const noop = () => {};

const OPTIONS: RouteStopOption[] = [...mockEvents.filter((event) => event.placeId !== null).map((event) => ({ key: `event:${event.id}`, title: event.title, hint: null, stop: { eventId: event.id } as RouteStopWrite })), ...mockPlaces.map((place) => ({ key: `place:${place.id}`, title: place.title, hint: null, stop: { placeId: place.id } as RouteStopWrite }))];

const STOPS: RouteStopWrite[] = [{ placeId: mockPlaces[2].id }, { placeId: mockPlaces[1].id }];

const ROUTE = buildMockDayRoute({ stops: STOPS, latitude: MOSCOW[0], longitude: MOSCOW[1] });
if (typeof ROUTE === "string") throw new Error("fixture route failed to build");
const OPTIMIZED = optimizeMockDayRoute({ stops: STOPS, latitude: MOSCOW[0], longitude: MOSCOW[1] });
if (typeof OPTIMIZED === "string") throw new Error("fixture optimize failed to build");

function viewHtml(over: { options?: RouteStopOption[] | "loading" | "error"; selected?: string[]; built?: DayRouteBuildState; optimize?: OptimizeState } = {}): string {
  const options = over.options === "loading" ? { status: "loading" as const } : over.options === "error" ? { status: "error" as const } : { status: "ready" as const, options: over.options ?? OPTIONS };
  return renderToStaticMarkup(createElement(DayRouteView, { options, selected: over.selected ?? [], onToggle: noop, onBuild: noop, built: over.built ?? { status: "idle" }, optimize: over.optimize ?? { status: "idle" }, onOptimize: noop }));
}

describe("route labels", () => {
  it("formats a leg as minutes over kilometers", () => {
    expect(formatLeg({ fromTitle: "А", toTitle: "Б", travelMinutes: 15, distanceKm: 2.1 })).toBe("15 мин / 2.1 км");
  });

  it("formats the totals line", () => {
    const route: DayRoute = { points: [], legs: [], totalMinutes: 47, totalKm: 6.8 };
    expect(routeTotalsLabel(route)).toBe("Итого: 47 мин · 6.8 км");
  });

  it("formats the README-style savings line", () => {
    const original: DayRoute = { points: [], legs: [], totalMinutes: 143, totalKm: 11.4 };
    const optimized: DayRoute = { points: [], legs: [], totalMinutes: 96, totalKm: 6.8 };
    const result: OptimizeRoute = { original, optimized, savedMinutes: 47, savedKm: 4.6 };
    expect(savingsLabel(result)).toBe("11.4 км → 6.8 км, экономия 47 минут");
  });
});

describe("DayRouteView stop picker", () => {
  it("blocks the build below two selected stops", () => {
    const html = viewHtml({ selected: [OPTIONS[0].key] });

    expect(html).toContain("Выбрано: 1 из 8");
    expect(html).toContain("Выберите минимум 2 точки");
    expect(html).toContain("Построить");
    expect(html.match(/<button[^>]*disabled/g)).toHaveLength(1);
  });

  it("enables the build from two selected stops", () => {
    const html = viewHtml({ selected: [OPTIONS[0].key, OPTIONS[1].key] });

    expect(html).not.toContain("Выберите минимум");
    expect(html).toContain("Построить");
    expect(html.match(/<button[^>]*disabled/g) ?? []).toHaveLength(0);
  });

  it("disables unchecked options once the 8-stop limit is reached", () => {
    const selected = OPTIONS.slice(0, MAX_ROUTE_STOPS).map((option) => option.key);
    const html = viewHtml({ selected });

    expect(html).toContain(`Выбрано: ${MAX_ROUTE_STOPS} из ${MAX_ROUTE_STOPS}`);
    expect(html.match(/<input[^>]*disabled/g)).toHaveLength(OPTIONS.length - MAX_ROUTE_STOPS);
  });

  it("renders the options loading and error states", () => {
    expect(viewHtml({ options: "loading" })).toContain("Загружаем точки");
    const error = viewHtml({ options: "error" });
    expect(error).toContain("app-state--error");
    expect(error).toContain("Не удалось загрузить точки");
  });
});

describe("DayRouteView route", () => {
  it("renders the timeline points with legs and the totals", () => {
    const html = viewHtml({ built: { status: "ready", route: ROUTE } });

    for (const point of ROUTE.points) expect(html).toContain(point.title);
    for (const leg of ROUTE.legs) expect(html).toContain(formatLeg(leg));
    expect(html).toContain(routeTotalsLabel(ROUTE));
    expect(html).toContain("Оптимизировать");
  });

  it("redraws the optimized timeline and shows the savings after optimizing", () => {
    const html = viewHtml({ built: { status: "ready", route: ROUTE }, optimize: { status: "ready", result: OPTIMIZED } });

    expect(html).toContain(savingsLabel(OPTIMIZED));
    expect(html).toContain("экономия");
    expect(html).toContain(routeTotalsLabel(OPTIMIZED.optimized));
    expect(html).not.toContain(routeTotalsLabel(ROUTE));
  });

  it("renders the build and optimize error states", () => {
    const buildError = viewHtml({ built: { status: "error" } });
    expect(buildError).toContain("app-state--error");
    expect(buildError).toContain("Не удалось построить маршрут");

    const optimizeError = viewHtml({ built: { status: "ready", route: ROUTE }, optimize: { status: "error" } });
    expect(optimizeError).toContain("Не удалось оптимизировать маршрут");
  });

  it("drops the timeline once the built route is reset to idle (selection changed)", () => {
    // toggle after build resets `built` to idle in the container; then no stale timeline may surface
    const html = viewHtml({ built: { status: "idle" }, optimize: { status: "idle" } });

    expect(html).not.toContain(routeTotalsLabel(ROUTE));
    expect(html).not.toContain("Оптимизировать");
    for (const leg of ROUTE.legs) expect(html).not.toContain(formatLeg(leg));
  });
});

describe("DayRoutePage", () => {
  it("starts in the options loading state", () => {
    const html = renderToStaticMarkup(createElement(DayRoutePage));

    expect(html).toContain("Загружаем точки");
  });
});
