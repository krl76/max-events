import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Route } from "../routing/router";
import { HomePage, RoutedPages } from "./pages";

let mockRoute: Route = { name: "home" };

vi.mock("../routing/router", () => ({
  useRoute: () => ({ route: mockRoute, navigate: () => {}, back: () => {}, canGoBack: false, transition: "none", navSeq: 0 }),
}));

beforeEach(() => {
  vi.stubGlobal("window", { location: { search: "" } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockRoute = { name: "home" };
});

async function routedHtml(route: Route, ready: string): Promise<string> {
  mockRoute = route;
  let html = renderToStaticMarkup(<RoutedPages />);
  // Lazy route chunks resolve asynchronously; re-render until the route content replaces the Suspense fallback.
  await vi.waitFor(() => {
    html = renderToStaticMarkup(<RoutedPages />);
    if (!html.includes(ready)) throw new Error(`route content not ready: ${ready}`);
  });
  return html;
}

describe("HomePage", () => {
  it("opens on the feed screen, without the CTA pair it replaced and without friends tiles", () => {
    const html = renderToStaticMarkup(<HomePage />);

    // The cards come from an effect, which never runs in static markup, so the first paint is экран 04.
    expect(html).toContain("app-feed-skeleton");
    expect(html).toContain("Загружаем ленту");
    expect(html).not.toContain("app-whereto-cta--secondary");
    expect(html).not.toContain("Твои люди открыли места");
  });

  it("no longer carries the catalog or the today digest: both moved to экран 08", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).not.toContain("app-view-toggle");
    expect(html).not.toContain("Сегодня для тебя");
    expect(html).not.toContain("Любой рейтинг");
  });
});

describe("RoutedPages", () => {
  it("falls through to the home page on the home route", async () => {
    const html = await routedHtml({ name: "home" }, "app-feed-skeleton");

    expect(html).toContain("app-feed-skeleton");
  });

  it("maps the friends route to the feed with the discovery/people nav tiles", async () => {
    const html = await routedHtml({ name: "friends" }, "Твои люди открыли места");

    expect(html).toContain("Твои люди открыли места");
    expect(html).toContain("Люди с похожими интересами");
    expect(html).not.toContain("app-feed-skeleton");
  });

  it("maps the profile route to the profile screen with the achievements/my-city nav tiles", async () => {
    const html = await routedHtml({ name: "profile" }, "Достижения");

    expect(html).toContain("Достижения");
    expect(html).toContain("Мой город");
    expect(html).not.toContain("Друзья");
    expect(html).not.toContain("Сохранённое");
    expect(html).not.toContain("Панель организатора");
    expect(html).not.toContain("Твои люди открыли места");
  });

  it("maps the plans route to the «Моё» screen with the plans/calendar/saved tabs", async () => {
    const html = await routedHtml({ name: "plans" }, "Сохранённое");

    expect(html).toContain("Планы");
    expect(html).toContain("Календарь");
    expect(html).toContain("Сохранённое");
  });

  it("maps the calendar route to the «Моё» screen opened on the calendar tab", async () => {
    const html = await routedHtml({ name: "calendar" }, "Сохранённое");

    expect(html).toMatch(/<button[^>]*app-chip--on[^>]*>Календарь</);
  });

  it("maps the search route to экран 08 with its tiles and blocks", async () => {
    const html = await routedHtml({ name: "search" }, "Сегодня для тебя");

    expect(html).toContain("Подбор свайпами");
    expect(html).toContain("На карте");
    expect(html).toContain("Куда пойдём?");
    expect(html).not.toContain("app-feed-skeleton");
  });

  it("maps the swipe route to экран 09", async () => {
    const html = await routedHtml({ name: "swipe" }, "Подбор мест");

    expect(html).toContain("Свайпай: вправо — в избранное, влево — мимо");
    expect(html).not.toContain("app-feed-skeleton");
  });

  it("maps the map route to the map screen", async () => {
    const html = await routedHtml({ name: "map" }, "Загружаем");

    expect(html).toContain("Загружаем");
    expect(html).not.toContain("app-feed-skeleton");
  });

  it("renders the event page skeleton for an event deep link", async () => {
    const html = await routedHtml({ name: "event", id: "c0000001-0000-4000-8000-000000000001" }, "Загрузка…");

    expect(html).toContain("Загрузка…");
    expect(html).not.toContain("app-feed-skeleton");
    expect(html).not.toContain("Твои люди открыли места");
  });
});
