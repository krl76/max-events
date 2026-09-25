import { describe, expect, it } from "vitest";
import { BASEMAP_STORAGE_KEY, DEFAULT_BASEMAP, MAP_BASEMAPS, basemapById, basemapCredit, readBasemapPreference, writeBasemapPreference } from "./basemaps";

describe("basemap catalogue", () => {
  it("opens on the standard OSM tiles the map always had, and every id is unique", () => {
    expect(DEFAULT_BASEMAP.id).toBe("osm");
    expect(MAP_BASEMAPS[0]).toBe(DEFAULT_BASEMAP);
    expect(new Set(MAP_BASEMAPS.map((item) => item.id)).size).toBe(MAP_BASEMAPS.length);
  });

  it("carries a complete Leaflet template per entry: xyz always, subdomains only where the template asks for them", () => {
    for (const item of MAP_BASEMAPS) {
      expect(item.url).toMatch(/^https:\/\//);
      for (const token of ["{z}", "{x}", "{y}"]) expect(item.url).toContain(token);
      expect(item.url.includes("{s}")).toBe(item.subdomains !== undefined);
      expect(item.maxZoom).toBeGreaterThanOrEqual(17);
      expect(item.maxZoom).toBeLessThanOrEqual(20);
    }
  });

  it("credits OpenStreetMap on every basemap and the styling provider after it", () => {
    for (const item of MAP_BASEMAPS) expect(basemapCredit(item)).toMatch(/^© OpenStreetMap/);
    expect(basemapCredit(basemapById("opentopo"))).toBe("© OpenStreetMap · SRTM · © OpenTopoMap");
    expect(basemapCredit(DEFAULT_BASEMAP)).toBe("© OpenStreetMap");
  });

  it("keeps every entry keyless and light: the default is light, and the tone stays inside its union", () => {
    for (const item of MAP_BASEMAPS) {
      expect(item.url).not.toMatch(/key|token/i);
      expect(["light", "dark"]).toContain(item.tone);
    }
    expect(DEFAULT_BASEMAP.tone).toBe("light");
  });
});

describe("basemap choice", () => {
  it("resolves a known id and falls back to the default for an unknown, empty or missing one", () => {
    expect(basemapById("osm-de").id).toBe("osm-de");
    // A provider that left the catalogue (CARTO went key-only) must not break a stored choice
    expect(basemapById("carto-positron")).toBe(DEFAULT_BASEMAP);
    expect(basemapById("stamen-toner")).toBe(DEFAULT_BASEMAP);
    expect(basemapById("")).toBe(DEFAULT_BASEMAP);
    expect(basemapById(null)).toBe(DEFAULT_BASEMAP);
    expect(basemapById(undefined)).toBe(DEFAULT_BASEMAP);
  });

  it("namespaces the key next to the theme preference and stays inert without a DOM", () => {
    expect(BASEMAP_STORAGE_KEY).toBe("max-events:basemap");
    expect(readBasemapPreference()).toBe(DEFAULT_BASEMAP);
    expect(() => writeBasemapPreference("osm-de")).not.toThrow();
  });
});
