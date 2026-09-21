import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockEvents } from "../api/mock";
import { MapPageView } from "./MapPage";

const noop = () => {};

describe("MapPageView", () => {
  it("renders the loading state", () => {
    const html = renderToStaticMarkup(createElement(MapPageView, { state: { status: "loading" }, onOpenEvent: noop, onOpenPlace: noop }));

    expect(html).toContain("Загружаем события для карты");
  });

  it("renders the error state", () => {
    const html = renderToStaticMarkup(createElement(MapPageView, { state: { status: "error" }, onOpenEvent: noop, onOpenPlace: noop }));

    expect(html).toContain("app-state--error");
    expect(html).toContain("Не удалось загрузить события для карты");
  });

  it("hands the events to the map screen", () => {
    const html = renderToStaticMarkup(createElement(MapPageView, { state: { status: "ready", events: mockEvents }, onOpenEvent: noop, onOpenPlace: noop }));

    expect(html).toContain("Загружаем карту");
  });
});
