// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { mockEvents } from "../api/mock";
import { walkStopMarkers } from "./mapMarkers";
import { MapPage, MapPageView } from "./MapPage";

const noop = () => {};

const render = (state: Parameters<typeof MapPageView>[0]["state"]) => renderToStaticMarkup(createElement(MapPageView, { state, onOpenEvent: noop, onOpenPlace: noop }));

describe("MapPageView", () => {
  // Экран 16 прежде отвечал на неудачный запрос событий во весь экран, и карта не открывалась вовсе.
  // Полотно, поиск и «Вы здесь» от этого запроса не зависят, поэтому они есть в любом состоянии.
  it("рисует полотно карты, пока события ещё грузятся", () => {
    const html = render({ status: "loading" });

    expect(html).toContain('aria-label="Карта событий и мест"');
    expect(html).toContain('aria-label="Поиск"');
  });

  it("рисует полотно карты и когда события не загрузились — вместо экрана ошибки", () => {
    const html = render({ status: "error" });

    expect(html).toContain('aria-label="Карта событий и мест"');
    expect(html).not.toContain("app-state--error");
    expect(html).not.toContain("Не удалось загрузить события для карты");
  });

  it("hands the events to the map screen", () => {
    const html = render({ status: "ready", events: mockEvents });

    expect(html).toContain('aria-label="Карта событий и мест"');
    expect(html).toContain("Карта");
    expect(html).toContain("Поиск");
    expect(html).not.toContain("Спросить");
    expect(html).not.toContain(">Поиск<");
  });
});

describe("custom pin from a post", () => {
  it("offers to build a route when the map opens on a dropped pin", () => {
    const html = renderToStaticMarkup(
      createElement(MapPageView, {
        state: { status: "ready", events: [] },
        onOpenEvent: noop,
        onOpenPlace: noop,
        pin: { lat: 55.7522, lng: 37.6156 },
      }),
    );

    expect(html).toContain("Точка на карте");
    expect(html).toContain("Построить маршрут");
  });

  it("does not treat a catalog place focus as a custom pin", () => {
    const html = renderToStaticMarkup(
      createElement(MapPageView, {
        state: { status: "ready", events: [] },
        onOpenEvent: noop,
        onOpenPlace: noop,
        pin: { lat: 55.7522, lng: 37.6156 },
        focusPlaceId: "b0000000-0000-4000-8000-000000000001",
      }),
    );

    expect(html).not.toContain("Построить маршрут");
  });
});

const STOP = {
  order: 1,
  title: "Кремль",
  address: "Кремль, Тула",
  latitude: 54.2,
  longitude: 37.6,
  placeId: "11111111-1111-4111-8111-111111111111",
};

async function mount(node: ReactElement): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { host, root };
}

describe("walk stops on the existing map", () => {
  it("turns two stops into two numbered markers and drops a point without coordinates", () => {
    const markers = walkStopMarkers([
      STOP,
      { ...STOP, order: 2, title: "Набережная", latitude: 54.21, longitude: 37.61, placeId: null },
      { ...STOP, order: 3, title: "Пусто", latitude: Number.NaN, longitude: 37.6 },
    ]);

    expect(markers.map((marker) => marker.badge)).toEqual([1, 2]);
    expect(markers.map((marker) => marker.title)).toEqual(["Кремль", "Набережная"]);
    expect(markers.some((marker) => marker.lat === 0 || marker.lng === 0)).toBe(false);
  });

  it("keeps the map open when the walk fails and does not invent a point", () => {
    const html = renderToStaticMarkup(createElement(MapPageView, { state: { status: "ready", events: [] }, onOpenEvent: noop, onOpenPlace: noop, walkFailed: true }));

    expect(html).toContain('aria-label="Карта событий и мест"');
    expect(html).toContain("Объекты не загрузились");
    expect(html).not.toContain("app-state--error");
    expect(html).not.toContain("54.2");
  });

  it("asks for the saved walk by id", async () => {
    const calls: string[] = [];
    const { host, root } = await mount(
      createElement(MapPage, {
        walkId: "w1",
        loadEvents: () => Promise.resolve([]),
        loadWalk: (id: string) => {
          calls.push(id);
          return Promise.reject(new Error("missing"));
        },
      }),
    );

    expect(calls).toEqual(["w1"]);
    expect(host.querySelector('[aria-label="Карта событий и мест"]')).not.toBeNull();
    expect(host.textContent).toContain("Объекты не загрузились");
    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
