import { describe, expect, it } from "vitest";
import { haversineMeters } from "../geo/haversine";
import { pickMode, travelMinutes } from "../routes/routes.service";
import { fitWalk, type FitStop } from "./fit-walk";

function sight(id: string, latitude: number, longitude: number, kind: FitStop["kind"] = "sight"): FitStop {
  return { id, title: id, latitude, longitude, kind };
}

describe("fitWalk", () => {
  it("fits three close parks into 60 minutes", () => {
    const result = fitWalk({
      stops: [sight("a", 54.2, 37.6), sight("b", 54.20005, 37.6), sight("c", 54.2001, 37.6)],
      durationMinutes: 60,
      budgetMode: "any",
      budgetRub: null,
    });
    expect(result.fitted).toBe(true);
    expect(result.stops).toHaveLength(3);
  });

  it("keeps an over-long pair and reports the real minutes", () => {
    const from = sight("a", 54.2, 37.6);
    const to = sight("b", 54.38, 37.6);
    const result = fitWalk({ stops: [from, to], durationMinutes: 30, budgetMode: "any", budgetRub: null });
    const meters = haversineMeters(from, to.latitude, to.longitude);
    expect(result.fitted).toBe(false);
    expect(result.stops).toHaveLength(2);
    expect(result.legs[0]?.travelMinutes).toBe(travelMinutes(meters, pickMode(meters, "no_taxi")));
  });

  it("never emits metro when the budget is free", () => {
    const result = fitWalk({
      stops: [sight("a", 54.2, 37.6), sight("b", 54.22, 37.6)],
      durationMinutes: 240,
      budgetMode: "free",
      budgetRub: null,
    });
    expect(result.legs.every((leg) => leg.mode === "walk" && leg.priceRub === null)).toBe(true);
  });

  it("drops a priced metro leg that breaks a custom budget", () => {
    const result = fitWalk({
      stops: [sight("a", 54.2, 37.6), sight("b", 54.20005, 37.6), sight("c", 54.22, 37.6)],
      durationMinutes: 180,
      budgetMode: "custom",
      budgetRub: 0,
    });
    expect(result.fitted).toBe(true);
    expect(result.stops).toHaveLength(2);
    expect(result.legs.every((leg) => leg.mode !== "metro")).toBe(true);
  });
});
