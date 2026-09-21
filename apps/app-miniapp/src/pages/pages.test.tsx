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
  it("renders the home composition with the CTA pair and without friends tiles", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("Куда пойдём?");
    expect(html).toContain("Рядом со мной");
    expect(html).toContain("app-whereto-cta--secondary");
    expect(html).not.toContain("Твои люди открыли места");
  });
});

describe("RoutedPages", () => {
  it("falls through to the home page on the home route", async () => {
    const html = await routedHtml({ name: "home" }, "Куда пойдём?");

    expect(html).toContain("Куда пойдём?");
  });

  it("maps the friends route to the feed with the discovery/people nav tiles", async () => {
    const html = await routedHtml({ name: "friends" }, "Твои люди открыли места");

    expect(html).toContain("Твои люди открыли места");
    expect(html).toContain("Люди с похожими интересами");
    expect(html).not.toContain("Куда пойдём?");
  });

  it("maps the profile route to the profile screen with its nav tiles", async () => {
    const html = await routedHtml({ name: "profile" }, "Достижения");

    for (const label of ["Друзья", "Достижения", "Мой город", "Сохранённое"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain("Панель организатора");
    expect(html).not.toContain("Твои люди открыли места");
  });

  it("maps the plans route to the plans screen with the calendar nav tile", async () => {
    const html = await routedHtml({ name: "plans" }, "Календарь");

    expect(html).toContain("Календарь");
  });

  it("maps the search route to the search screen", async () => {
    const html = await routedHtml({ name: "search" }, "Начните вводить");

    expect(html).toContain("Начните вводить");
    expect(html).not.toContain("Куда пойдём?");
  });

  it("maps the map route to the map screen", async () => {
    const html = await routedHtml({ name: "map" }, "Загружаем");

    expect(html).toContain("Загружаем");
    expect(html).not.toContain("Куда пойдём?");
  });

  it("renders the event page skeleton for an event deep link", async () => {
    const html = await routedHtml({ name: "event", id: "c0000001-0000-4000-8000-000000000001" }, "Загрузка…");

    expect(html).toContain("Загрузка…");
    expect(html).not.toContain("Куда пойдём?");
    expect(html).not.toContain("Твои люди открыли места");
  });
});
