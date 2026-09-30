import { describe, expect, it } from "vitest";
import { droppedPinCardVisible, droppedPinKey, droppedPinStop, placeRouteStop, routeBarLabel } from "./droppedPinRoute";

const PIN = { lat: 55.7522, lng: 37.6156 };

describe("droppedPinCardVisible", () => {
  it("opens a route card for a custom pin that is not a catalog place", () => {
    expect(droppedPinCardVisible({ pin: PIN, placeId: null, dismissedKey: null })).toBe(true);
  });

  it("stays closed for a catalog place even when the same coordinates arrived as a pin", () => {
    expect(droppedPinCardVisible({ pin: PIN, placeId: "b0000000-0000-4000-8000-000000000001", dismissedKey: null })).toBe(false);
  });

  it("stays closed after the card was dismissed for this pin", () => {
    expect(droppedPinCardVisible({ pin: PIN, placeId: null, dismissedKey: droppedPinKey(PIN) })).toBe(false);
  });

  it("reopens when a different custom pin arrives", () => {
    expect(droppedPinCardVisible({ pin: { lat: 55.76, lng: 37.62 }, placeId: null, dismissedKey: droppedPinKey(PIN) })).toBe(true);
  });
});

describe("droppedPinStop", () => {
  it("routes to the dropped coordinates, not to a catalog title", () => {
    expect(droppedPinStop(PIN)).toEqual({ kind: "pin", title: "Точка на карте", latitude: 55.7522, longitude: 37.6156 });
  });

  it("names a catalog destination by its place title", () => {
    const stop = placeRouteStop({ id: "b0000000-0000-4000-8000-000000000001", title: "Парк Горького", latitude: 55.73, longitude: 37.6 });
    expect(stop).toEqual({ kind: "place", title: "Парк Горького", latitude: 55.73, longitude: 37.6, placeId: "b0000000-0000-4000-8000-000000000001" });
    expect(routeBarLabel(stop)).toBe("Маршрут до Парк Горького");
    expect(routeBarLabel(droppedPinStop(PIN))).toBe("Маршрут до точки");
  });
});
