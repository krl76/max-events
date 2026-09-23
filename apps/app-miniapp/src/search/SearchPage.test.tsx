import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { catalogCards } from "../api/mock";
import { addRecentSearch, RECENT_SEARCHES_LIMIT, railMeta, searchCities, SearchEntryTiles, SearchNearby, SearchQueryForm, SearchTopBar, SearchWayTiles, type SearchState } from "./SearchPage";

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
    expect(railMeta({ ...card, distanceKm: null, placeTitle: "Парк Горького" })).toContain("Парк Горького · ");
    expect(railMeta({ ...card, distanceKm: null, placeTitle: null })).toContain(card.event.city);
  });
});

describe("SearchTopBar", () => {
  const bar = (over: { city?: string; cities?: string[]; initial?: string } = {}) => renderToStaticMarkup(createElement(SearchTopBar, { city: over.city ?? "Москва", cities: over.cities ?? ["Москва"], onCity: noop, initial: over.initial ?? "К", searchOpen: false, onToggleSearch: noop }));

  it("shows the city, the viewer initial and the search toggle", () => {
    const html = bar();

    expect(html).toContain("Москва");
    expect(html).toContain(">К<");
    expect(html).toContain('aria-label="Поиск"');
    // Меню города закрыто, пока по пилюле не нажали.
    expect(html).not.toContain("app-search-city-menu");
  });
});

describe("SearchQueryForm", () => {
  it("shows the recents on a blank query and hides them once something is typed", () => {
    const form = (query: string) => renderToStaticMarkup(createElement(SearchQueryForm, { query, onQuery: noop, onSubmit: noop, recents: ["йога", "Рахманинов"] }));

    expect(form("")).toContain("Рахманинов");
    expect(form("")).toContain("app-search-recents");
    expect(form("джаз")).not.toContain("app-search-recents");
  });
});

describe("search entries", () => {
  it("offers the swipe deck and the map as the two tiles of the design", () => {
    const html = renderToStaticMarkup(createElement(SearchEntryTiles, { onSwipe: noop, onMap: noop }));

    expect(html).toContain("Подбор свайпами");
    expect(html).toContain("Места под твой вкус");
    expect(html).toContain("На карте");
    expect(html).toContain("Друзья и маршруты");
  });

  it("offers the wizard and the nearby screen, and keeps one dark tile between them", () => {
    const html = renderToStaticMarkup(createElement(SearchWayTiles, { onWhereto: noop, onNearby: noop }));

    expect(html).toContain("Куда пойдём?");
    expect(html).toContain("Три вопроса — пять вариантов");
    expect(html).toContain("Рядом со мной");
    expect(html).toContain("Сейчас, через час, вечером");
    expect((html.match(/app-search-way--dark/g) ?? []).length).toBe(1);
  });
});

describe("SearchNearby", () => {
  const rail = (over: { state?: SearchState; query?: string; expanded?: boolean } = {}) => renderToStaticMarkup(createElement(SearchNearby, { state: over.state ?? READY, query: over.query ?? "", expanded: over.expanded ?? false, onExpand: noop, onOpenEvent: noop, onRetry: noop }));

  it("shows the horizontal rail with «Смотреть все» while nothing is being searched", () => {
    const html = rail();

    expect(html).toContain("Сегодня рядом");
    expect(html).toContain("Смотреть все");
    expect(html).toContain("app-rail-strip");
    expect(html).toContain(CARDS[0].event.title);
  });

  it("drops «Смотреть все» once the catalog is already unfolded", () => {
    expect(rail({ expanded: true })).not.toContain("Смотреть все");
  });

  it("turns into a result list under a query, because found things are read down, not sideways", () => {
    const html = rail({ query: "джаз" });

    expect(html).toContain("Результаты поиска");
    expect(html).toContain("app-rail-list");
    expect(html).not.toContain("app-rail-strip");
    expect(html).not.toContain("Смотреть все");
  });

  it("says nothing was found under a query and stays neutral without one", () => {
    const empty: SearchState = { status: "ready", cards: [] };

    expect(rail({ state: empty, query: "несуществующий-запрос" })).toContain("Ничего не найдено");
    expect(rail({ state: empty })).toContain("Рядом сегодня пусто");
  });

  it("renders the loading and error states of the rail", () => {
    expect(rail({ state: { status: "loading" } })).toContain("app-skeleton-block");
    const failed = rail({ state: { status: "error" } });
    expect(failed).toContain("app-state--error");
    expect(failed).toContain("Не удалось загрузить события");
  });
});
