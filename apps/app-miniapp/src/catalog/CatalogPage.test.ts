import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogView, type CatalogState } from "./CatalogPage";
import { mockEvents } from "../api/mock";

const free = mockEvents.find((item) => item.priceRub === null)!;
const paid = mockEvents.find((item) => item.priceRub !== null)!;

describe("CatalogView", () => {
  it("renders event cards from fixtures with title, city, price and category", () => {
    const state: CatalogState = { status: "ready", events: [free, paid] };
    const html = renderToStaticMarkup(createElement(CatalogView, { state, filters: {}, onFilters: () => {} }));

    expect(html).toContain(free.title);
    expect(html).toContain(paid.title);
    expect(html).toContain(free.city);
    expect(html).toContain("Бесплатно");
    expect(html).toContain(`${paid.priceRub} ₽`);
    expect(html.match(/app-card-title/g)).toHaveLength(2);
  });

  it("renders event cards as clickable buttons navigating to the event route", () => {
    const state: CatalogState = { status: "ready", events: [free, paid] };
    const html = renderToStaticMarkup(createElement(CatalogView, { state, filters: {}, onFilters: () => {}, onOpenEvent: () => {} }));

    expect(html.match(/app-card--link/g)).toHaveLength(2);
    expect(html.match(/<button[^>]*class="app-card app-card--link"/g)).toHaveLength(2);
    expect(html).not.toContain("<article");
  });

  it("renders skeleton cards while loading", () => {
    const html = renderToStaticMarkup(createElement(CatalogView, { state: { status: "loading" }, filters: {}, onFilters: () => {} }));

    expect(html).toContain("app-skeleton-line");
    expect(html).not.toContain("app-card-title");
  });

  it("renders an empty state when nothing matches the filters", () => {
    const html = renderToStaticMarkup(createElement(CatalogView, { state: { status: "ready", events: [] }, filters: {}, onFilters: () => {} }));

    expect(html).toContain("Ничего не найдено");
    expect(html).not.toContain("app-card-title");
  });

  it("renders an error state when the request fails", () => {
    const html = renderToStaticMarkup(createElement(CatalogView, { state: { status: "error" }, filters: {}, onFilters: () => {} }));

    expect(html).toContain("app-state--error");
    expect(html).toContain("Не удалось загрузить события");
  });

  it("marks exactly the active category chip", () => {
    const html = renderToStaticMarkup(createElement(CatalogView, { state: { status: "loading" }, filters: { category: "sport" }, onFilters: () => {} }));

    expect(html).toContain("Спорт");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("renders the list/map toggle and marks the active view", () => {
    const listHtml = renderToStaticMarkup(createElement(CatalogView, { state: { status: "loading" }, filters: {}, onFilters: () => {}, view: "list", onView: () => {} }));
    const mapHtml = renderToStaticMarkup(createElement(CatalogView, { state: { status: "loading" }, filters: {}, onFilters: () => {}, view: "map", onView: () => {} }));

    expect(listHtml).toContain("app-view-toggle");
    expect(listHtml).toContain('aria-pressed="true">Список');
    expect(mapHtml).toContain('aria-pressed="true">Карта');
  });

  it("renders the map screen instead of cards in map view", () => {
    const html = renderToStaticMarkup(createElement(CatalogView, { state: { status: "ready", events: mockEvents }, filters: {}, onFilters: () => {}, view: "map", onOpenEvent: () => {} }));

    expect(html).toContain("Загружаем карту");
    expect(html).not.toContain("app-card-title");
  });
});
