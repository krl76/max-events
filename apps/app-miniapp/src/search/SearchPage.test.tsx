import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockEvents } from "../api/mock";
import { addRecentSearch, RECENT_SEARCHES_LIMIT, SearchView, type SearchState } from "./SearchPage";

const noop = () => {};
const READY: SearchState = { status: "ready", events: mockEvents };

function viewHtml(over: { query?: string; recents?: string[]; state?: SearchState; minRating?: number } = {}): string {
  return renderToStaticMarkup(createElement(SearchView, { query: over.query ?? "", onQuery: noop, onSubmit: noop, recents: over.recents ?? [], state: over.state ?? READY, onOpenEvent: noop, minRating: over.minRating }));
}

describe("addRecentSearch", () => {
  it("prepends the trimmed query", () => {
    expect(addRecentSearch(["йога"], "  кино ")).toEqual(["кино", "йога"]);
  });

  it("dedupes case-insensitively and moves the fresh query up", () => {
    expect(addRecentSearch(["Кино", "йога"], "кино")).toEqual(["кино", "йога"]);
  });

  it("caps the list at the limit", () => {
    const full = Array.from({ length: RECENT_SEARCHES_LIMIT }, (_, index) => `q${index}`);
    const next = addRecentSearch(full, "new");

    expect(next).toHaveLength(RECENT_SEARCHES_LIMIT);
    expect(next[0]).toBe("new");
    expect(next).not.toContain(`q${RECENT_SEARCHES_LIMIT - 1}`);
  });

  it("keeps the list untouched on a blank query", () => {
    expect(addRecentSearch(["йога"], "   ")).toEqual(["йога"]);
  });
});

describe("SearchView", () => {
  it("shows the hint and recent chips on a blank query", () => {
    const html = viewHtml({ recents: ["йога", "Рахманинов"] });

    expect(html).toContain("Начните вводить");
    expect(html).toContain("йога");
    expect(html).toContain("Рахманинов");
    expect(html).not.toContain("app-card--link");
  });

  it("hides recents once a query is entered", () => {
    const html = viewHtml({ query: "Рахманинов", recents: ["йога"] });

    expect(html).not.toContain("Начните вводить");
    expect(html).not.toContain(">йога<");
  });

  it("renders only the matching event cards", () => {
    const html = viewHtml({ query: "Рахманинов" });

    expect(html).toContain("Вечер Рахманинова: симфонический оркестр");
    expect(html).not.toContain("Выставка импрессионистов из частных собраний");
  });

  it("matches the city case-insensitively", () => {
    const kazan = mockEvents.find((event) => event.city !== "Москва");
    if (kazan === undefined) return;
    const html = viewHtml({ query: kazan.city.toLowerCase() });

    expect(html).toContain(kazan.title);
  });

  it("offers the rating filter next to the search field, and marks the chosen threshold", () => {
    const any = viewHtml();
    expect(any).toContain("Любой рейтинг");
    expect(any).toContain("от 4★");

    // The rating is a server filter, so the chosen chip has to survive into the request the page makes.
    const rated = viewHtml({ minRating: 4 });
    expect(rated).toMatch(/<button[^>]*aria-pressed="true"[^>]*class="[^"]*app-chip[^"]*"[^>]*>от 4★</);
    expect(rated).not.toMatch(/<button[^>]*aria-pressed="true"[^>]*class="[^"]*app-chip[^"]*"[^>]*>Любой рейтинг</);
  });

  it("renders the empty state when nothing matches", () => {
    const html = viewHtml({ query: "несуществующий-запрос" });

    expect(html).toContain("Ничего не найдено");
  });

  it("renders loading and error states for an entered query", () => {
    expect(viewHtml({ query: "йога", state: { status: "loading" } })).toContain("Ищем события");
    expect(viewHtml({ query: "йога", state: { status: "error" } })).toContain("app-state--error");
  });
});
