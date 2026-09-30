import { describe, expect, it } from "vitest";
import { intentForStopKind, mapRouteProfileFor, searchFeatureRouteIntent } from "./mapRoutePolicy";

const WALK = { mode: "walk" as const, minutes: 28, distanceKm: 2.1, transfers: null };
const METRO = { mode: "metro" as const, minutes: 14, distanceKm: 2.1, transfers: 1 };
const CAR = { mode: "car" as const, minutes: 9, distanceKm: 2.1, transfers: null };

describe("mapRouteProfileFor", () => {
  it("keeps walks and dropped pins on the foot graph", () => {
    expect(mapRouteProfileFor("walk", [WALK, METRO, CAR])).toBe("foot");
    expect(mapRouteProfileFor("arrive-on-foot", [WALK, METRO, CAR])).toBe("foot");
    expect(intentForStopKind("pin")).toBe("arrive-on-foot");
    expect(intentForStopKind("place")).toBe("event");
  });

  it("sends an event along the fastest road or metro tile", () => {
    expect(mapRouteProfileFor("event", [WALK, METRO, CAR])).toBe("driving");
    expect(mapRouteProfileFor("event", [WALK, METRO])).toBe("metro");
    expect(mapRouteProfileFor("event", [WALK])).toBe("foot");
    expect(mapRouteProfileFor("event", [])).toBe("driving");
  });
});

describe("searchFeatureRouteIntent", () => {
  it("maps each of the nine search doors onto a map intent", () => {
    expect(searchFeatureRouteIntent("walk")).toBe("walk");
    expect(searchFeatureRouteIntent("nearby")).toBe("event");
    expect(searchFeatureRouteIntent("map")).toBe("event");
    expect(searchFeatureRouteIntent("ask")).toBe("event");
    expect(searchFeatureRouteIntent("swipe")).toBe("event");
    expect(searchFeatureRouteIntent("whereto")).toBe("event");
    expect(searchFeatureRouteIntent("micro")).toBe("event");
    expect(searchFeatureRouteIntent("route")).toBe("event");
    expect(searchFeatureRouteIntent("soon")).toBe("event");
  });
});
