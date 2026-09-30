import { describe, expect, it } from "vitest";
import type { Route } from "../routing/router";
import { ROUTE_TITLES, routeHasBack, routeHasHeader, routeIsFlush, routeIsFullscreen, routeTitle, TABS } from "./Layout";

describe("Layout tabbar active predicates", () => {
  it("highlights only the Profile tab on the day-route screen", () => {
    const active = TABS.filter((tab) => tab.active("day-route"));

    expect(active).toHaveLength(1);
    expect(active[0].route).toBe("profile");
  });

  it("highlights the Profile tab on the plans, plan and saved-list screens", () => {
    expect(TABS.find((tab) => tab.route === "profile")?.active("plans")).toBe(true);
    expect(TABS.find((tab) => tab.route === "profile")?.active("plan")).toBe(true);
    expect(TABS.find((tab) => tab.route === "profile")?.active("list")).toBe(true);
  });

  it("highlights the Profile tab on the calendar screen", () => {
    const active = TABS.filter((tab) => tab.active("calendar"));

    expect(active).toHaveLength(1);
    expect(active[0].route).toBe("profile");
  });

  it("highlights the Profile tab on saved walks", () => {
    expect(TABS.filter((tab) => tab.active("walks")).map((tab) => tab.route)).toEqual(["profile"]);
    expect(TABS.filter((tab) => tab.active("walk")).map((tab) => tab.route)).toEqual(["profile"]);
    expect(TABS.filter((tab) => tab.active("walk-saved")).map((tab) => tab.route)).toEqual(["profile"]);
  });

  it("highlights the Profile tab on the friends screen", () => {
    const active = TABS.filter((tab) => tab.active("friends"));

    expect(active).toHaveLength(1);
    expect(active[0].route).toBe("profile");
  });

  it("highlights the Profile tab on the subscriptions screen", () => {
    const active = TABS.filter((tab) => tab.active("subscriptions"));

    expect(active).toHaveLength(1);
    expect(active[0].route).toBe("profile");
  });

  it("keeps the swipe deck on Search and gives the map its own tab", () => {
    expect(TABS.filter((tab) => tab.active("swipe")).map((tab) => tab.route)).toEqual(["search"]);
    const active = TABS.filter((tab) => tab.active("map"));

    expect(active).toHaveLength(1);
    expect(active[0].route).toBe("map");
  });

  it("highlights the Create tab on every publication screen", () => {
    for (const name of ["create", "story-new", "feed-new", "micro-new", "plan-new"]) {
      const active = TABS.filter((tab) => tab.active(name));

      expect(active).toHaveLength(1);
      expect(active[0].route).toBe("create");
    }
  });

  it("highlights exactly one tab on the micro-event screens", () => {
    expect(TABS.filter((tab) => tab.active("micro")).map((tab) => tab.route)).toEqual(["home"]);
    expect(TABS.filter((tab) => tab.active("micro-event")).map((tab) => tab.route)).toEqual(["home"]);
  });

  it("keeps other screens off the Map tab", () => {
    expect(TABS.find((tab) => tab.route === "map")?.active("home")).toBe(false);
    expect(TABS.find((tab) => tab.route === "map")?.active("search")).toBe(false);
  });

  it("defines exactly the five tabbar tabs in order", () => {
    expect(TABS.map((tab) => tab.route)).toEqual(["home", "search", "map", "create", "profile"]);
  });

  it("labels the tabs as the design does", () => {
    expect(TABS.map((tab) => tab.label)).toEqual(["Лента", "Поиск", "Карта", "Создать", "Профиль"]);
  });
});

describe("routeTitle", () => {
  it("has a non-empty title for every route name", () => {
    const names = Object.keys(ROUTE_TITLES) as Array<Route["name"]>;

    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(routeTitle({ name } as Route).trim()).not.toBe("");
    }
  });

  it("titles tab routes with their tab labels", () => {
    for (const tab of TABS) {
      expect(routeTitle({ name: tab.route })).toBe(tab.label);
    }
  });
});

describe("routeHasBack", () => {
  it("hides the back button on tab routes", () => {
    for (const tab of TABS) {
      expect(routeHasBack({ name: tab.route })).toBe(false);
    }
  });

  it("shows the back button on detail routes", () => {
    expect(routeHasBack({ name: "event", id: "e1" })).toBe(true);
    expect(routeHasBack({ name: "whereto" })).toBe(true);
    expect(routeHasBack({ name: "plan", id: "p1" })).toBe(true);
  });

  it("hides the back button on the map, which is a tab", () => {
    expect(routeHasBack({ name: "map" })).toBe(false);
  });

  it("shows the native back button on a city walk, which does not draw its own", () => {
    expect(routeHasBack({ name: "walk", city: "Москва" })).toBe(true);
    expect(routeHasBack({ name: "walks" })).toBe(true);
    expect(routeHasBack({ name: "walk-saved", id: "w1" })).toBe(true);
    expect(routeHasBack({ name: "upcoming", city: "Москва" })).toBe(true);
    expect(routeHasBack({ name: "day-route" })).toBe(true);
    expect(routeHasBack({ name: "assist", ask: null })).toBe(true);
    expect(routeHasBack({ name: "story-new" })).toBe(true);
  });

  it("keeps the native back on fullscreen screens: their declared header props are never rendered, the native button is the only way out", () => {
    expect(routeHasBack({ name: "place", id: "p1" })).toBe(true);
    expect(routeHasBack({ name: "notifications" })).toBe(true);
    expect(routeHasBack({ name: "calendar" })).toBe(true);
    expect(routeHasBack({ name: "slot-ticket", id: "b1" })).toBe(true);
  });
});

describe("routeHasHeader", () => {
  it("hides the header on the screens that draw their own chrome", () => {
    expect(routeHasHeader({ name: "profile" })).toBe(false);
    // Карта показывает пилюлю «Поиск» поверх полотна, подбор свайпами — свою строку с кнопкой назад.
    expect(routeHasHeader({ name: "map" })).toBe(false);
    expect(routeHasHeader({ name: "swipe" })).toBe(false);
    // Экран 17 несёт кнопку назад и «поделиться» в градиентном hero, экран 23 — название события в своей шапке.
    expect(routeHasHeader({ name: "event", id: "e1" })).toBe(false);
    expect(routeHasHeader({ name: "companions", eventId: "e1" })).toBe(false);
    // Календарь рисует свой заголовок, общая шапка была бы второй. Таббара у него нет.
    expect(routeHasHeader({ name: "calendar" })).toBe(false);
  });

  it("keeps the header on the home tab and the detail routes", () => {
    expect(routeHasHeader({ name: "home" })).toBe(true);
    expect(routeHasHeader({ name: "search" })).toBe(true);
    expect(routeHasHeader({ name: "create" })).toBe(true);
    expect(routeHasHeader({ name: "plans" })).toBe(false);
    expect(routeHasHeader({ name: "settings" })).toBe(true);
    // Карточка площадки (макет, экран 34) шапку потеряла: она несёт собственную кнопку назад поверх
    // полотна и собственную нижнюю панель, поэтому маршрут переехал в полноэкранные.
    expect(routeHasHeader({ name: "place", id: "p1" })).toBe(false);
  });

  it("hides the header on the composers, which draw their own top bar", () => {
    expect(routeHasHeader({ name: "story-new" })).toBe(false);
    expect(routeHasHeader({ name: "feed-new", eventId: null })).toBe(false);
  });
});

describe("routeIsFullscreen", () => {
  it("gives the whole viewport to the story and post composers, whose own bottom rail the tabbar would cover", () => {
    expect(routeIsFullscreen({ name: "story-new" })).toBe(true);
    expect(routeIsFullscreen({ name: "feed-new", eventId: null })).toBe(true);
    expect(routeIsFullscreen({ name: "assist", ask: null })).toBe(true);
    expect(routeIsFullscreen({ name: "day-route" })).toBe(true);
    expect(routeIsFullscreen({ name: "calendar" })).toBe(true);
  });

  it("leaves the shell in place everywhere else, the «Создать» hub included", () => {
    expect(routeIsFullscreen({ name: "create" })).toBe(false);
    expect(routeIsFullscreen({ name: "micro-new" })).toBe(false);
    expect(routeIsFullscreen({ name: "home" })).toBe(false);
    expect(routeIsFullscreen({ name: "event", id: "e1" })).toBe(false);
    expect(routeIsFullscreen({ name: "event", id: "e1" })).toBe(false);
  });
});

describe("routeIsFlush", () => {
  it("drops shell gutters on the map canvas and on screens that already pad themselves", () => {
    expect(routeIsFlush({ name: "map" })).toBe(true);
    expect(routeIsFlush({ name: "story-new" })).toBe(true);
    expect(routeIsFlush({ name: "feed-new", eventId: null })).toBe(true);
    expect(routeIsFlush({ name: "place", id: "p1" })).toBe(true);
    expect(routeIsFlush({ name: "notifications" })).toBe(true);
    expect(routeIsFlush({ name: "onboarding" })).toBe(true);
  });

  it("keeps the 20px phone gutter on calendar, MAX AI and the day route", () => {
    expect(routeIsFlush({ name: "calendar" })).toBe(false);
    expect(routeIsFlush({ name: "assist", ask: null })).toBe(false);
    expect(routeIsFlush({ name: "day-route" })).toBe(false);
  });
});
