import { describe, expect, it } from "vitest";
import type { Route } from "../routing/router";
import { ROUTE_TITLES, routeHasBack, routeTitle, TABS } from "./Layout";

describe("Layout tabbar active predicates", () => {
  it("highlights only the Plans tab on the day-route screen", () => {
    const active = TABS.filter((tab) => tab.active("day-route"));

    expect(active).toHaveLength(1);
    expect(active[0].route).toBe("plans");
  });

  it("highlights the Plans tab on the plans and plan screens", () => {
    expect(TABS.find((tab) => tab.route === "plans")?.active("plans")).toBe(true);
    expect(TABS.find((tab) => tab.route === "plans")?.active("plan")).toBe(true);
  });

  it("highlights the Plans tab on the calendar screen", () => {
    const active = TABS.filter((tab) => tab.active("calendar"));

    expect(active).toHaveLength(1);
    expect(active[0].route).toBe("plans");
  });

  it("highlights the Profile tab on the friends screen", () => {
    const active = TABS.filter((tab) => tab.active("friends"));

    expect(active).toHaveLength(1);
    expect(active[0].route).toBe("profile");
  });

  it("keeps other screens off the Plans tab", () => {
    expect(TABS.find((tab) => tab.route === "plans")?.active("home")).toBe(false);
    expect(TABS.find((tab) => tab.route === "plans")?.active("search")).toBe(false);
  });

  it("defines exactly the five tabbar tabs in order", () => {
    expect(TABS.map((tab) => tab.route)).toEqual(["home", "search", "map", "plans", "profile"]);
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
});
