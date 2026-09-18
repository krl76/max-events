import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiError } from "../api/client";
import { discoverySummary, friendRoute, mockFriendIds, resetMockCheckIns } from "../api/mock";
import { DiscoveryView, placesLabel, routeErrorMessage, type DiscoveryState, type RouteState } from "./DiscoveryPage";

const noop = () => {};

function viewHtml(state: DiscoveryState, route: RouteState = { status: "idle" }): string {
  return renderToStaticMarkup(createElement(DiscoveryView, { state, route, onShowRoute: noop, onOpenPlace: noop }));
}

function readyState(): DiscoveryState {
  resetMockCheckIns();
  return { status: "ready", data: discoverySummary() };
}

describe("placesLabel", () => {
  it("picks the right russian plural form", () => {
    expect(placesLabel(1)).toBe("1 новое место");
    expect(placesLabel(2)).toBe("2 новых места");
    expect(placesLabel(5)).toBe("5 новых мест");
    expect(placesLabel(11)).toBe("11 новых мест");
    expect(placesLabel(21)).toBe("21 новое место");
  });
});

describe("routeErrorMessage", () => {
  it("explains a hidden route on 403 and falls back otherwise", () => {
    expect(routeErrorMessage(new ApiError(403, "forbidden"))).toBe("Друг скрыл свой маршрут.");
    expect(routeErrorMessage(new ApiError(500, "boom"))).toBe("Не удалось загрузить маршрут.");
    expect(routeErrorMessage(new Error("boom"))).toBe("Не удалось загрузить маршрут.");
  });
});

describe("DiscoveryView", () => {
  it("renders the summary line and per-friend cards with expandable places", () => {
    const html = viewHtml(readyState());

    expect(html).toContain("Твои люди открыли 5 новых мест");
    expect(html).toContain("Анна: 3 новых места");
    expect(html).toContain("ГМИИ им. А. С. Пушкина");
    expect(html).toContain("<details");
  });

  it("renders a route CTA only for friends with a visible place list", () => {
    const html = viewHtml(readyState());

    expect(html.match(/Посмотреть маршрут/g)).toHaveLength(4);
    expect(html).toContain("Лена: 1 новое место");
  });

  it("renders the friend route timeline when loaded", () => {
    const route = friendRoute(mockFriendIds[0]);
    if (typeof route === "string") throw new Error("expected a route payload");
    const html = viewHtml(readyState(), { status: "ready", friendId: mockFriendIds[0], route });

    expect(html).toContain("Маршрут: Анна Соколова");
    expect(html).toContain("ГМИИ им. А. С. Пушкина");
    expect(html).toContain("Депо. Москва");
  });

  it("renders the route error message", () => {
    const html = viewHtml(readyState(), { status: "error", friendId: mockFriendIds[0], message: routeErrorMessage(new ApiError(403, "hidden")) });

    expect(html).toContain("app-state--error");
    expect(html).toContain("Друг скрыл свой маршрут.");
  });

  it("renders loading, error and empty states", () => {
    expect(viewHtml({ status: "loading" })).toContain("Загружаем открытия");

    const error = viewHtml({ status: "error" });
    expect(error).toContain("app-state--error");
    expect(error).toContain("Не удалось загрузить открытия друзей");

    const empty = viewHtml({ status: "ready", data: { newPlacesCount: 0, byFriend: [] } });
    expect(empty).toContain("Пока ничего нового");
    expect(empty).not.toContain("Посмотреть маршрут");
  });
});
