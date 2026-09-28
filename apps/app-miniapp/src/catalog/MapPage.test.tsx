import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockEvents } from "../api/mock";
import { MapPageView } from "./MapPage";

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
