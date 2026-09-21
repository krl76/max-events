import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogView, filterEventsByQuery, type CatalogState } from "./CatalogPage";
import { mockEvents } from "../api/mock";

describe("filterEventsByQuery", () => {
  it("returns the list untouched on a blank query", () => {
    expect(filterEventsByQuery(mockEvents, "")).toBe(mockEvents);
    expect(filterEventsByQuery(mockEvents, "   ")).toBe(mockEvents);
  });

  it("matches by title and city case-insensitively", () => {
    const byTitle = filterEventsByQuery(mockEvents, mockEvents[0].title.slice(0, 6).toUpperCase());
    expect(byTitle.map((event) => event.id)).toContain(mockEvents[0].id);

    const byCity = filterEventsByQuery(mockEvents, mockEvents[0].city.toLowerCase());
    expect(byCity.every((event) => event.city.toLowerCase().includes(mockEvents[0].city.toLowerCase()))).toBe(true);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterEventsByQuery(mockEvents, "несуществующий запрос 42")).toEqual([]);
  });
});

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

  it("renders the «Промо» badge on promoted cards only", () => {
    const promotedEvent = { ...free, id: "c00000ff-0000-4000-8000-0000000000ff", promoted: true };
    const state: CatalogState = { status: "ready", events: [free, promotedEvent] };
    const html = renderToStaticMarkup(createElement(CatalogView, { state, filters: {}, onFilters: () => {} }));

    expect(html.match(/Промо/g)).toHaveLength(1);
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
    expect(listHtml).toContain('aria-pressed="true"');
    expect(listHtml).toContain(">Список</button>");
    expect(mapHtml).toContain('aria-pressed="true"');
    expect(mapHtml).toContain(">Карта</button>");
  });

  it("renders the map screen instead of cards in map view", () => {
    const html = renderToStaticMarkup(createElement(CatalogView, { state: { status: "ready", events: mockEvents }, filters: {}, onFilters: () => {}, view: "map", onOpenEvent: () => {} }));

    expect(html).toContain("Загружаем карту");
    expect(html).not.toContain("app-card-title");
  });
});
