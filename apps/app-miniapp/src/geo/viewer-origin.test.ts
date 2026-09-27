import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MOSCOW_CENTER } from "../catalog/MapScreen";
import { browsedCityOrigin, useViewerOrigin, viewerOriginFrom } from "./viewer-origin";

function Probe() {
  const origin = useViewerOrigin();
  return createElement("span", null, `${origin.source}:${origin.latitude}:${origin.longitude}`);
}

describe("useViewerOrigin", () => {
  it("falls back to Moscow when geolocation is unavailable", () => {
    vi.stubGlobal("navigator", {});
    const html = renderToStaticMarkup(createElement(Probe));
    expect(html).toContain(`fallback:${MOSCOW_CENTER[0]}:${MOSCOW_CENTER[1]}`);
    vi.unstubAllGlobals();
  });
});

describe("viewerOriginFrom", () => {
  it("принимает координаты браузера как есть", () => {
    expect(viewerOriginFrom({ latitude: 59.94, longitude: 30.31 })).toEqual({ latitude: 59.94, longitude: 30.31, source: "geo", state: "granted" });
  });

  // Экран 16 по этому состоянию объясняет, почему «Показать, где я» приводит в центр города.
  it("считает отказ и молчание одним ответом: центр Москвы с пометкой «отказано»", () => {
    expect(viewerOriginFrom(null)).toEqual({ latitude: MOSCOW_CENTER[0], longitude: MOSCOW_CENTER[1], source: "fallback", state: "denied" });
  });

  it("внутри города оставляет точку зрителя, а снаружи берёт центр выбранного города", () => {
    const inside = browsedCityOrigin({ latitude: 55.76, longitude: 37.62 }, "Москва");
    expect(inside.fromViewer).toBe(true);
    expect(inside.latitude).toBe(55.76);

    const outside = browsedCityOrigin({ latitude: 43.1, longitude: 131.9 }, "Москва");
    expect(outside.fromViewer).toBe(false);
    expect(outside.latitude).toBeCloseTo(55.7558, 3);
    expect(outside.longitude).toBeCloseTo(37.6173, 3);
  });

  it("не подменяет точку, если у города нет известного центра", () => {
    expect(browsedCityOrigin({ latitude: 43.1, longitude: 131.9 }, "Владивосток").fromViewer).toBe(true);
  });

  it("не верит нечисловым координатам: NaN на карте — это отказ, а не точка в Атлантике", () => {
    expect(viewerOriginFrom({ latitude: Number.NaN, longitude: 30.31 }).state).toBe("denied");
    expect(viewerOriginFrom({ latitude: 59.94, longitude: Number.POSITIVE_INFINITY }).source).toBe("fallback");
  });
});
