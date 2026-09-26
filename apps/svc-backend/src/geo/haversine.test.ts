import { describe, expect, it } from "vitest";
import { haversineKm, haversineMeters } from "./haversine";

describe("haversine", () => {
  it("returns zero for the same point and a positive span for two cities", () => {
    expect(haversineKm(55.75, 37.62, 55.75, 37.62)).toBeCloseTo(0, 5);
    expect(haversineKm(55.75, 37.62, 59.93, 30.31)).toBeGreaterThan(600);
    expect(haversineMeters({ latitude: 55.747, longitude: 37.584 }, 55.747, 37.584)).toBe(0);
    expect(haversineMeters({ latitude: 55.75, longitude: 37.62 }, 55.747, 37.584)).toBeGreaterThan(0);
  });
});
