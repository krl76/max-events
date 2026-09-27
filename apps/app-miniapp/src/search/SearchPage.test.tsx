import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { catalogCards } from "../api/mock";
import { addRecentSearch, nearbyEntryTitle, RECENT_SEARCHES_LIMIT, railMeta, searchCities, SearchFilterSheet, SearchFold, SearchNearby, SearchQueryForm, SearchTools, SearchTopBar, type SearchState } from "./SearchPage";

const noop = () => {};
const CARDS = catalogCards({ sort: "near" }, { latitude: 55.7522, longitude: 37.6156 });
const READY: SearchState = { status: "ready", cards: CARDS };

describe("addRecentSearch", () => {
  it("prepends the trimmed query and dedupes case-insensitively", () => {
    expect(addRecentSearch(["йога"], "  кино ")).toEqual(["кино", "йога"]);
    expect(addRecentSearch(["Кино", "йога"], "кино")).toEqual(["кино", "йога"]);
  });

  it("caps the list at the limit and ignores a blank query", () => {
    const full = Array.from({ length: RECENT_SEARCHES_LIMIT }, (_, index) => `q${index}`);
    const next = addRecentSearch(full, "new");

    expect(next).toHaveLength(RECENT_SEARCHES_LIMIT);
    expect(next[0]).toBe("new");
    expect(next).not.toContain(`q${RECENT_SEARCHES_LIMIT - 1}`);
    expect(addRecentSearch(["йога"], "   ")).toEqual(["йога"]);
  });
});

describe("search helpers", () => {
  it("offers the cities the loaded catalog names, without repeats", () => {
    const cities = searchCities(CARDS);

    expect(cities).toContain("Москва");
    expect(new Set(cities).size).toBe(cities.length);
    expect(searchCities([])).toEqual([]);
  });

  it("puts the distance first on a rail card and falls back to the venue without one", () => {
    const card = CARDS.find((item) => item.distanceKm !== null)!;
    expect(railMeta(card)).toMatch(/ км · /);
    expect(railMeta(card, "center")).toContain("от центра");
    expect(railMeta({ ...card, distanceKm: 120 }, "center")).toContain("далеко от центра");
    expect(railMeta({ ...card, distanceKm: null, placeTitle: "Парк Горького" })).toContain("Парк Горького · ");
    expect(railMeta({ ...card, distanceKm: null, placeTitle: null })).toContain(card.event.city);
  });
});

describe("SearchTopBar", () => {
  const bar = (over: { city?: string; cities?: string[] } = {}) => renderToStaticMarkup(createElement(SearchTopBar, { city: over.city ?? "Москва", cities: over.cities ?? ["Москва"], onCity: noop }));

  it("shows the city and keeps the profile shortcut off this screen", () => {
    const html = bar();

    expect(html).toContain("Москва");
    expect(html).not.toContain('aria-label="Профиль"');
    expect(html).not.toContain("app-search-city-menu");
  });
});

describe("SearchQueryForm", () => {
  it("shows the recents on a blank query and hides them once something is typed", () => {
    const form = (query: string) => renderToStaticMarkup(createElement(SearchQueryForm, { query, onQuery: noop, onSubmit: noop, recents: ["йога", "Рахманинов"] }));

    expect(form("")).toContain("Недавние");
    expect(form("")).toContain("Рахманинов");
    expect(form("")).toContain("app-search-recent");
    expect(form("")).toContain('aria-label="Найти"');
    expect(form("")).toContain("disabled");
    expect(form("джаз")).not.toContain("app-search-recents");
    expect(form("джаз")).not.toContain("disabled");
  });
});

describe("search entries", () => {
  it("keeps every search door as an icon, with the full name on the button", () => {
    const html = renderToStaticMarkup(createElement(SearchTools, { onAsk: noop, onSwipe: noop, onMap: noop, onWhereto: noop, onNearby: noop, onMicro: noop }));

    expect(html).toContain('aria-label="Спросить MAX"');
    expect(html).toContain('aria-label="Подбор свайпами"');
    expect(html).toContain('aria-label="На карте"');
    expect(html).toContain('aria-label="Куда пойдём?"');
    expect(html).toContain('aria-label="Рядом со мной"');
    expect(html).toContain('aria-label="Микро-события"');
    expect(nearbyEntryTitle(false)).toBe("В городе");
    expect(renderToStaticMarkup(createElement(SearchTools, { onAsk: noop, onSwipe: noop, onMap: noop, onWhereto: noop, onNearby: noop, onMicro: noop, nearbyLabel: "Город", nearbyAria: "В городе" }))).toContain('aria-label="В городе"');
  });
});

describe("SearchFilterSheet", () => {
  it("offers the categories and a reset once one is chosen", () => {
    const open = renderToStaticMarkup(createElement(SearchFilterSheet, { category: "sport", onCategory: noop, onClose: noop }));

    expect(open).toContain("Фильтры");
    expect(open).toContain("Афиша");
    expect(open).toContain("Волонтёрство");
    expect(open).toContain("Сбросить");
    expect(renderToStaticMarkup(createElement(SearchFilterSheet, { category: undefined, onCategory: noop, onClose: noop }))).not.toContain("Сбросить");
  });
});

describe("SearchFold", () => {
  it("hides the section events until the button is opened", () => {
    const closed = renderToStaticMarkup(createElement(SearchFold, { title: "Для вас", open: false, onToggle: noop, children: "Вечер Рахманинова" }));
    const open = renderToStaticMarkup(createElement(SearchFold, { title: "Для вас", open: true, onToggle: noop, children: "Вечер Рахманинова" }));

    expect(closed).toContain("Для вас");
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain("Вечер Рахманинова");
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain("Вечер Рахманинова");
  });
});

describe("SearchNearby", () => {
  const rail = (over: { state?: SearchState; inCity?: boolean } = {}) => renderToStaticMarkup(createElement(SearchNearby, { state: over.state ?? READY, inCity: over.inCity, onExpand: noop, onOpenEvent: noop, onRetry: noop }));

  it("shows the horizontal rail with «Смотреть все»", () => {
    const html = rail();

    expect(html).toContain("Сегодня рядом");
    expect(html).toContain("Смотреть все");
    expect(html).toContain("app-rail-strip");
    expect(html).toContain(CARDS[0].event.title);
    expect(html).not.toContain("app-pick-likes");
  });

  it("says the rail is empty without turning that into a search miss", () => {
    const empty: SearchState = { status: "ready", cards: [] };

    expect(rail({ state: empty })).toContain("Рядом сегодня пусто");
    expect(rail({ state: empty })).toContain("Смотреть все");
    expect(rail({ state: empty, inCity: false })).toContain("Сегодня в городе");
    expect(rail({ state: empty, inCity: false })).toContain("В городе сегодня пусто");
  });

  it("renders the loading and error states of the rail", () => {
    expect(rail({ state: { status: "loading" } })).toContain("app-skeleton-block");
    const failed = rail({ state: { status: "error" } });
    expect(failed).toContain("app-state--error");
    expect(failed).toContain("Не удалось загрузить события");
  });
});
