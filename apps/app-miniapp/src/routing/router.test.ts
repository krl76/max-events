import { describe, expect, it } from "vitest";
import { isTabRoute, nextHistory, routeFromHistoryState, routeFromStartParam, transitionFromIdx } from "./router";

describe("routeFromStartParam", () => {
  it("opens the event route from an event-* deep link", () => {
    expect(routeFromStartParam("event-42")).toEqual({ name: "event", id: "42" });
  });

  it("opens the place route from a place-* deep link", () => {
    expect(routeFromStartParam("place-b0000001-0000-4000-8000-000000000001")).toEqual({ name: "place", id: "b0000001-0000-4000-8000-000000000001" });
  });

  it("falls back to home when the place id is empty", () => {
    expect(routeFromStartParam("place-")).toEqual({ name: "home" });
  });

  it("falls back to home without a start_param", () => {
    expect(routeFromStartParam(null)).toEqual({ name: "home" });
  });

  it("falls back to home for non-event start params", () => {
    expect(routeFromStartParam("promo_summer2025")).toEqual({ name: "home" });
  });

  it("opens the plan route from a plan-* deep link", () => {
    expect(routeFromStartParam("plan-p1")).toEqual({ name: "plan", id: "p1" });
  });

  it("opens the list route from a list-* deep link", () => {
    expect(routeFromStartParam("list-l1")).toEqual({ name: "list", id: "l1" });
  });

  it("opens the gathering route from a gathering-* deep link", () => {
    expect(routeFromStartParam("gathering-g1")).toEqual({ name: "gathering", id: "g1" });
  });

  it("maps the push that follows an event to экран 35, which carries an eventId rather than an id", () => {
    expect(routeFromStartParam("after-c0000001-0000-4000-8000-000000000001")).toEqual({ name: "after-event", eventId: "c0000001-0000-4000-8000-000000000001" });
    expect(routeFromStartParam("after-")).toEqual({ name: "home" });
  });

  it("opens the vote route from a vote-* deep link", () => {
    expect(routeFromStartParam("vote-d7000000-0000-4000-8000-000000000001")).toEqual({ name: "vote", id: "d7000000-0000-4000-8000-000000000001" });
  });

  it("falls back to home when the vote id is empty", () => {
    expect(routeFromStartParam("vote-")).toEqual({ name: "home" });
  });

  it("falls back to home when the plan id is empty", () => {
    expect(routeFromStartParam("plan-")).toEqual({ name: "home" });
  });

  it("falls back to home for an unknown deep-link prefix", () => {
    expect(routeFromStartParam("foo-1")).toEqual({ name: "home" });
  });

  it("keeps the nearby screen out of start_param deep links", () => {
    expect(routeFromStartParam("nearby")).toEqual({ name: "home" });
  });

  it("keeps the day-route screen out of start_param deep links", () => {
    expect(routeFromStartParam("day-route")).toEqual({ name: "home" });
  });

  it("keeps the discovery screen out of start_param deep links", () => {
    expect(routeFromStartParam("discovery")).toEqual({ name: "home" });
  });

  it("keeps the people screen out of start_param deep links", () => {
    expect(routeFromStartParam("people")).toEqual({ name: "home" });
  });

  it("keeps the organizer panel out of start_param deep links", () => {
    expect(routeFromStartParam("organizer")).toEqual({ name: "home" });
  });

  it("keeps the we-groups screens out of start_param deep links", () => {
    expect(routeFromStartParam("we-groups")).toEqual({ name: "home" });
  });

  it("keeps the new shell screens out of start_param deep links", () => {
    expect(routeFromStartParam("create")).toEqual({ name: "home" });
    expect(routeFromStartParam("story-new")).toEqual({ name: "home" });
    expect(routeFromStartParam("subscriptions")).toEqual({ name: "home" });
  });
});

describe("nextHistory", () => {
  it("replaces the entry when switching between tab routes", () => {
    const result = nextHistory({ route: { name: "home" }, idx: 0 }, { name: "plans" });

    expect(result.method).toBe("replace");
    expect(result.state).toEqual({ route: { name: "plans" }, idx: 0 });
  });

  it("pushes from search to the map, which stopped being a tab and became a view inside search", () => {
    const result = nextHistory({ route: { name: "search" }, idx: 0 }, { name: "map" });

    expect(result.method).toBe("push");
    expect(result.state).toEqual({ route: { name: "map" }, idx: 1 });
  });

  it("replaces between the search and create tabs", () => {
    const result = nextHistory({ route: { name: "search" }, idx: 0 }, { name: "create" });

    expect(result.method).toBe("replace");
    expect(result.state).toEqual({ route: { name: "create" }, idx: 0 });
  });

  it("pushes when leaving a tab for the former friends tab", () => {
    const result = nextHistory({ route: { name: "profile" }, idx: 0 }, { name: "friends" });

    expect(result.method).toBe("push");
    expect(result.state).toEqual({ route: { name: "friends" }, idx: 1 });
  });

  it("pushes a new entry when leaving a tab for a detail route", () => {
    const result = nextHistory({ route: { name: "home" }, idx: 0 }, { name: "event", id: "e1" });

    expect(result.method).toBe("push");
    expect(result.state).toEqual({ route: { name: "event", id: "e1" }, idx: 1 });
  });

  it("pushes when navigating from a detail route back to a tab so back returns to the detail", () => {
    const result = nextHistory({ route: { name: "event", id: "e1" }, idx: 1 }, { name: "profile" });

    expect(result.method).toBe("push");
    expect(result.state.idx).toBe(2);
  });

  it("pushes between two detail routes", () => {
    const result = nextHistory({ route: { name: "event", id: "e1" }, idx: 3 }, { name: "plan", id: "p1" });

    expect(result.method).toBe("push");
    expect(result.state.idx).toBe(4);
  });
});

describe("isTabRoute", () => {
  it("marks only the five tabbar routes as tab routes", () => {
    const tabNames = ["home", "search", "create", "plans", "profile"] as const;
    for (const name of tabNames) expect(isTabRoute(name)).toBe(true);

    expect(isTabRoute("friends")).toBe(false);
    expect(isTabRoute("calendar")).toBe(false);
    expect(isTabRoute("event")).toBe(false);
    expect(isTabRoute("whereto")).toBe(false);
  });

  it("no longer counts the map as a tab route", () => {
    expect(isTabRoute("map")).toBe(false);
  });
});

describe("transitionFromIdx", () => {
  it("maps forward movement to push, backward to pop, same level to tab", () => {
    expect(transitionFromIdx(0, 1)).toBe("push");
    expect(transitionFromIdx(2, 1)).toBe("pop");
    expect(transitionFromIdx(1, 1)).toBe("tab");
  });
});

describe("routeFromHistoryState", () => {
  it("restores a detail route from a valid popstate payload", () => {
    expect(routeFromHistoryState({ route: { name: "event", id: "e1" }, idx: 2 })).toEqual({ route: { name: "event", id: "e1" }, idx: 2 });
  });

  it("restores the feed-new route keeping a nullable eventId", () => {
    expect(routeFromHistoryState({ route: { name: "feed-new", eventId: null }, idx: 1 })).toEqual({ route: { name: "feed-new", eventId: null }, idx: 1 });
  });

  it("restores a post detail route", () => {
    expect(routeFromHistoryState({ route: { name: "post", id: "30000000-0000-4000-8000-000000000001" }, idx: 2 })).toEqual({ route: { name: "post", id: "30000000-0000-4000-8000-000000000001" }, idx: 2 });
  });

  it("rejects a payload without a numeric idx", () => {
    expect(routeFromHistoryState({ route: { name: "home" } })).toBeNull();
  });

  it("rejects an unknown route name", () => {
    expect(routeFromHistoryState({ route: { name: "nope" }, idx: 0 })).toBeNull();
  });

  it("restores the routes the new shell added", () => {
    for (const name of ["create", "story-new", "subscriptions"]) {
      expect(routeFromHistoryState({ route: { name }, idx: 1 })).toEqual({ route: { name }, idx: 1 });
    }
  });

  it("rejects an id route without a string id", () => {
    expect(routeFromHistoryState({ route: { name: "event" }, idx: 0 })).toBeNull();
    expect(routeFromHistoryState({ route: { name: "event", id: 42 }, idx: 0 })).toBeNull();
  });

  it("rejects non-object payloads", () => {
    expect(routeFromHistoryState(null)).toBeNull();
    expect(routeFromHistoryState("home")).toBeNull();
  });
});
