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

function routedHtml(route: Route): string {
  mockRoute = route;
  return renderToStaticMarkup(<RoutedPages />);
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
  it("falls through to the home page on the home route", () => {
    const html = routedHtml({ name: "home" });

    expect(html).toContain("Куда пойдём?");
  });

  it("maps the friends route to the feed with the discovery/people nav tiles", () => {
    const html = routedHtml({ name: "friends" });

    expect(html).toContain("Твои люди открыли места");
    expect(html).toContain("Люди с похожими интересами");
    expect(html).not.toContain("Куда пойдём?");
  });

  it("maps the profile route to the profile screen with its nav tiles", () => {
    const html = routedHtml({ name: "profile" });

    for (const label of ["Достижения", "Мой город", "Сохранённое", "Панель организатора"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain("Твои люди открыли места");
  });

  it("renders the event page skeleton for an event deep link", () => {
    const html = routedHtml({ name: "event", id: "c0000001-0000-4000-8000-000000000001" });

    expect(html).toContain("Загрузка…");
    expect(html).not.toContain("Куда пойдём?");
    expect(html).not.toContain("Твои люди открыли места");
  });
});
