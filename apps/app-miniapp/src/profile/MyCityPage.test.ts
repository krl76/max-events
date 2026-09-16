import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MyCityView, memoryMarkers, type MyCityState } from "./MyCityPage";
import type { MemoryPoint } from "@max-events/api-contracts";
import { mockEvents, mockPlaces } from "../api/mock";

const park = mockPlaces[0];
const subbotnik = mockEvents[2];

function point(overrides: Partial<MemoryPoint> = {}): MemoryPoint {
  return { latitude: park.latitude, longitude: park.longitude, eventId: subbotnik.id, placeId: null, visitedAt: "2026-09-20T10:30:00+03:00", ...overrides };
}

describe("memoryMarkers", () => {
  it("build a marker with the event title and the visited time", () => {
    const markers = memoryMarkers([point()], [subbotnik], [park]);

    expect(markers).toEqual([{ key: `${subbotnik.id}-2026-09-20T10:30:00+03:00`, title: subbotnik.title, subtitle: new Date("2026-09-20T10:30:00+03:00").toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }), lat: park.latitude, lng: park.longitude }]);
  });

  it("title a place point with the place name", () => {
    const placePoint = point({ eventId: null, placeId: park.id });
    const markers = memoryMarkers([placePoint], [subbotnik], [park]);

    expect(markers).toHaveLength(1);
    expect(markers[0].title).toBe(park.title);
    expect(markers[0].lat).toBe(placePoint.latitude);
  });

  it("skip points without a resolvable event or place", () => {
    const markers = memoryMarkers([point({ eventId: "00000000-0000-4000-8000-000000000000" })], [subbotnik], [park]);

    expect(markers).toEqual([]);
  });
});

describe("MyCityView", () => {
  const state: MyCityState = { status: "ready", summary: { userId: "u", placesCount: 3, eventsCount: 2, districtsCount: 3 }, markers: [] };

  it("renders the three summary counters and the memory map container", () => {
    const html = renderToStaticMarkup(createElement(MyCityView, { state }));

    expect(html).toContain(">3</span>");
    expect(html).toContain(">2</span>");
    expect(html).toContain("Места");
    expect(html).toContain("События");
    expect(html).toContain("Районы");
    expect(html).toContain("Карта личных впечатлений");
  });

  it("shows loading and error states", () => {
    expect(renderToStaticMarkup(createElement(MyCityView, { state: { status: "loading" } }))).toContain("Загрузка…");
    expect(renderToStaticMarkup(createElement(MyCityView, { state: { status: "error" } }))).toContain("Не удалось загрузить «Мой город».");
  });
});
