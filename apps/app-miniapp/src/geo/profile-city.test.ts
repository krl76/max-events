import { describe, expect, it } from "vitest";
import { MOSCOW_CENTER } from "../catalog/MapScreen";
import { profileCityPoint } from "./profile-city";
import { viewerOriginFrom } from "./viewer-origin";

const vladivostok = viewerOriginFrom({ latitude: 43.1, longitude: 131.9 });
const insideMoscow = viewerOriginFrom({ latitude: 55.76, longitude: 37.62 });

describe("profileCityPoint", () => {
  it("keeps the raw fix until the profile request finishes", () => {
    const point = profileCityPoint(vladivostok, null, false);

    expect(point.settled).toBe(false);
    expect(point.fromViewer).toBe(true);
    expect(point.latitude).toBe(43.1);
    expect(point.viewerLongitude).toBe(131.9);
  });

  it("uses the city center when the fix is outside the profile city", () => {
    const point = profileCityPoint(vladivostok, "Москва", true);

    expect(point.settled).toBe(true);
    expect(point.fromViewer).toBe(false);
    expect(point.city).toBe("Москва");
    expect(point.latitude).toBeCloseTo(55.7558, 3);
    expect(point.longitude).toBeCloseTo(37.6173, 3);
    expect(point.viewerLatitude).toBe(43.1);
  });

  it("keeps a fix that is already inside the profile city", () => {
    const point = profileCityPoint(insideMoscow, "Москва", true);

    expect(point.fromViewer).toBe(true);
    expect(point.latitude).toBe(55.76);
  });

  it("keeps the fix when the profile request failed and no city arrived", () => {
    const denied = viewerOriginFrom(null);
    const point = profileCityPoint(denied, null, true);

    expect(point.settled).toBe(true);
    expect(point.fromViewer).toBe(true);
    expect(point.latitude).toBe(MOSCOW_CENTER[0]);
    expect(point.source).toBe("fallback");
  });
});
