import { describe, expect, it } from "vitest";
import type { DayRoute } from "@max-events/api-contracts";
import { dayRouteKey, readSavedDayRoutes, rememberDayRoute } from "./savedDayRoutes";

const route: DayRoute = {
  points: [
    { title: "Старт", at: null, latitude: 1, longitude: 2, eventId: null, placeId: null },
    { title: "Эрмитаж", at: null, latitude: 3, longitude: 4, eventId: null, placeId: null },
  ],
  legs: [],
  totalMinutes: 20,
  totalKm: 1.5,
};

function memory() {
  const bag = new Map<string, string>();
  return {
    getItem: (key: string) => bag.get(key) ?? null,
    setItem: (key: string, value: string) => {
      bag.set(key, value);
    },
  };
}

describe("saved day routes", () => {
  it("keeps the newest copy of the same stops and drops a broken store", () => {
    const storage = memory();
    expect(readSavedDayRoutes(storage)).toEqual([]);
    const first = rememberDayRoute(route, storage, new Date("2026-09-29T10:00:00Z"));
    const again = rememberDayRoute({ ...route, totalKm: 1.5 }, storage, new Date("2026-09-29T11:00:00Z"));
    expect(again).toHaveLength(1);
    expect(again[0]?.id).not.toBe(first[0]?.id);
    expect(dayRouteKey(again[0]!.route)).toBe(dayRouteKey(route));
    storage.setItem("max-events.day-routes", "not-json");
    expect(readSavedDayRoutes(storage)).toEqual([]);
  });
});
