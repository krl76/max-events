import { describe, expect, it } from "vitest";
import { BASEMAP_STORAGE_KEY, DEFAULT_BASEMAP, MAP_BASEMAPS, OWN_BASEMAP, basemapById, basemapCredit, isVectorBasemap, readBasemapPreference, writeBasemapPreference } from "./basemaps";

describe("basemap catalogue", () => {
  it("opens on the standard OSM tiles the map always had, and every id is unique", () => {
    expect(DEFAULT_BASEMAP.id).toBe("osm");
    expect(MAP_BASEMAPS[0]).toBe(DEFAULT_BASEMAP);
    expect(new Set(MAP_BASEMAPS.map((item) => item.id)).size).toBe(MAP_BASEMAPS.length);
  });

  it("carries a complete Leaflet template per raster entry: xyz always, subdomains only where the template asks for them", () => {
    const rasters = MAP_BASEMAPS.filter((item) => !isVectorBasemap(item));
    expect(rasters.length).toBe(MAP_BASEMAPS.length - 1);
    for (const item of rasters) {
      expect(item.url).toMatch(/^https:\/\//);
      for (const token of ["{z}", "{x}", "{y}"]) expect(item.url).toContain(token);
      expect(item.url.includes("{s}")).toBe(item.subdomains !== undefined);
      expect(item.maxZoom).toBeGreaterThanOrEqual(17);
      expect(item.maxZoom).toBeLessThanOrEqual(20);
    }
  });

  it("puts the own vector basemap right after the standard one, served from the app's own origin", () => {
    expect(MAP_BASEMAPS[1]).toBe(OWN_BASEMAP);
    expect(isVectorBasemap(OWN_BASEMAP)).toBe(true);
    expect(isVectorBasemap(DEFAULT_BASEMAP)).toBe(false);
    // Relative paths: the archive and the glyphs live next to the app, whatever host it is opened from
    expect(OWN_BASEMAP.tiles).toMatch(/^\/tiles\/.+\.pmtiles$/);
    expect(OWN_BASEMAP.glyphs).toMatch(/^\/tiles\//);
    expect(OWN_BASEMAP.glyphs).toContain("{fontstack}");
    expect(OWN_BASEMAP.glyphs).toContain("{range}");
    // MapLibre overzooms the z14 archive itself, so the chip may promise street-level zoom
    expect(OWN_BASEMAP.maxZoom).toBe(20);
    expect(OWN_BASEMAP.tone).toBe("scheme");
    expect(OWN_BASEMAP.label).toBe("Своя");
  });

  it("credits OpenStreetMap on every basemap and the styling provider after it", () => {
    for (const item of MAP_BASEMAPS) expect(basemapCredit(item)).toMatch(/^© OpenStreetMap/);
    expect(basemapCredit(basemapById("opentopo"))).toBe("© OpenStreetMap · SRTM · © OpenTopoMap");
    expect(basemapCredit(OWN_BASEMAP)).toBe("© OpenStreetMap · © OpenMapTiles");
    expect(basemapCredit(DEFAULT_BASEMAP)).toBe("© OpenStreetMap");
  });

  it("keeps every entry keyless: the default is light, and the tone stays inside its union", () => {
    for (const item of MAP_BASEMAPS) {
      const urls = isVectorBasemap(item) ? [item.tiles, item.glyphs] : [item.url];
      for (const url of urls) expect(url).not.toMatch(/key|token/i);
      expect(["light", "dark", "scheme"]).toContain(item.tone);
      expect(["raster", "vector"]).toContain(item.kind);
    }
    expect(DEFAULT_BASEMAP.tone).toBe("light");
  });
});

describe("basemap choice", () => {
  it("resolves a known id and falls back to the default for an unknown, empty or missing one", () => {
    expect(basemapById("osm-de").id).toBe("osm-de");
    expect(basemapById("own")).toBe(OWN_BASEMAP);
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
