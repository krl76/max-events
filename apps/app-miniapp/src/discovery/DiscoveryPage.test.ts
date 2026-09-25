import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { discoveryHeadline, friendPlacesLine, DiscoveryView, type DiscoveryState } from "./DiscoveryPage";
import { discoverySummary, mockFriends, mockPlaces } from "../api/mock";

const noop = () => {};
const summary = discoverySummary();

const view = (state: DiscoveryState) => renderToStaticMarkup(createElement(DiscoveryView, { state, onShowRoute: noop, onOpenPlace: noop, onRetry: noop }));

describe("discoveryHeadline", () => {
  it("agrees the noun with the number standing above it", () => {
    expect(discoveryHeadline(18)).toBe("мест, где были твои друзья, а ты ещё нет");
    expect(discoveryHeadline(1)).toBe("место, где были твои друзья, а ты ещё нет");
    expect(discoveryHeadline(3)).toBe("места, где были твои друзья, а ты ещё нет");
  });
});

describe("friendPlacesLine", () => {
  it("keeps the wording of the design through the plural forms", () => {
    expect(friendPlacesLine(7)).toBe("7 новых для тебя мест");
    expect(friendPlacesLine(1)).toBe("1 новое для тебя место");
    expect(friendPlacesLine(2)).toBe("2 новых для тебя места");
  });
});

describe("DiscoveryView", () => {
  it("leads with the counter and the headline of the design", () => {
    const html = view({ status: "ready", data: summary });

    expect(html).toContain(`>${summary.newPlacesCount}<`);
    expect(html).toContain(discoveryHeadline(summary.newPlacesCount));
    expect(html).toContain("app-disco-hero");
  });

  it("gives every open friend a count, a route action and up to four place chips", () => {
    const html = view({ status: "ready", data: summary });
    const open = summary.byFriend.find((entry) => entry.places.length > 0)!;

    expect(html).toContain(open.friend.name);
    expect(html).toContain(friendPlacesLine(open.newPlacesCount));
    expect(html).toContain("Маршрут");
    expect(html).toContain(open.places[0].title);
  });

  it("draws the hidden history as a state, without a counter and without a route", () => {
    const hidden = summary.byFriend.find((entry) => entry.visitHistoryHidden)!;
    const html = view({ status: "ready", data: { newPlacesCount: 0, byFriend: [hidden] } });

    expect(html).toContain("История посещений скрыта");
    expect(html).toContain("app-disco-lock");
    expect(html).not.toContain("Маршрут");
    expect(html).not.toContain("новых для тебя");
  });

  it("keeps the count but drops the chips and the route for a friend who hid her routes", () => {
    const routesHidden = summary.byFriend.find((entry) => !entry.visitHistoryHidden && entry.places.length === 0)!;
    const html = view({ status: "ready", data: { newPlacesCount: routesHidden.newPlacesCount, byFriend: [routesHidden] } });

    expect(html).toContain(friendPlacesLine(routesHidden.newPlacesCount));
    expect(html).not.toContain("app-disco-chip");
  });

  it("caps the chip preview at four even for a longer trail", () => {
    const many = { friend: mockFriends[0], newPlacesCount: 7, places: [...mockPlaces, ...mockPlaces].slice(0, 7), visitHistoryHidden: false };
    const html = view({ status: "ready", data: { newPlacesCount: 7, byFriend: [many] } });

    expect([...html.matchAll(/class="app-disco-chip"/g)]).toHaveLength(4);
  });

  it("always says whose choice a hidden history is", () => {
    expect(view({ status: "ready", data: summary })).toContain("Каждый решает сам, показывать ли свои места.");
  });

  it("renders loading, error and empty states", () => {
    expect(view({ status: "loading" })).toContain("app-skeleton");
    expect(view({ status: "error" })).toContain("Не удалось загрузить открытия друзей.");
    expect(view({ status: "ready", data: { newPlacesCount: 0, byFriend: [] } })).toContain("Пока ничего нового");
  });

  it("explains a hidden visit history instead of counting zero new places", () => {
    const hidden = view({
      status: "ready",
      data: {
        newPlacesCount: 0,
        byFriend: [{ friend: { id: mockFriends[0].id, name: "Анна Соколова", avatarUrl: null }, newPlacesCount: 0, places: [], visitHistoryHidden: true }],
      },
    });
    expect(hidden).toContain("История посещений скрыта");
    expect(hidden).not.toContain(friendPlacesLine(0));
  });
});
