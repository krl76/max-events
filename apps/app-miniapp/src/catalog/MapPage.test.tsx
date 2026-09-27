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
    expect(html).toContain("Искать на карте");
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
    expect(html).toContain("Спросить");
    expect(html).not.toContain(">Поиск<");
  });
});
