import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import { BASEMAP_FONTS, OMT_SOURCE, OMT_SOURCE_LAYERS, basemapPalette, buildOwnBasemapStyle } from "./basemapStyle";
import { OWN_BASEMAP } from "./basemaps";

const ORIGIN = "https://app.example";

const light = buildOwnBasemapStyle(OWN_BASEMAP, "light", ORIGIN);
const dark = buildOwnBasemapStyle(OWN_BASEMAP, "dark", ORIGIN);

type AnyLayer = (typeof light.layers)[number] & { "source-layer"?: string; layout?: Record<string, unknown>; paint?: Record<string, unknown>; filter?: unknown; minzoom?: number; maxzoom?: number };

const layersOf = (style: typeof light) => style.layers as AnyLayer[];

describe("own basemap style", () => {
  it("passes the MapLibre style-spec validation in both schemes: one invalid expression rejects the whole style at runtime", () => {
    // MapLibre refuses a style with any validation error and loads no source at all; the symptom on screen
    // is only the «подложка не отвечает» line, so the check has to live here, not in the browser.
    expect(validateStyleMin(light).map((error) => error.message)).toEqual([]);
    expect(validateStyleMin(dark).map((error) => error.message)).toEqual([]);
  });

  it("points the one vector source at the PMTiles archive on the app origin and the glyphs next to it", () => {
    expect(light.version).toBe(8);
    expect(Object.keys(light.sources)).toEqual([OMT_SOURCE]);
    const source = light.sources[OMT_SOURCE] as { type: string; url: string; attribution: string };
    expect(source.type).toBe("vector");
    expect(source.url).toBe(`pmtiles://${ORIGIN}/tiles/moscow.pmtiles`);
    expect(source.attribution).toContain("© OpenStreetMap");
    expect(light.glyphs).toBe(`${ORIGIN}/tiles/fonts/{fontstack}/{range}.pbf`);
  });

  it("draws every layer from that source and only from OpenMapTiles source-layers the archive carries", () => {
    for (const layer of layersOf(light)) {
      if (layer.type === "background") continue;
      expect(layer.source).toBe(OMT_SOURCE);
      expect(OMT_SOURCE_LAYERS).toContain(layer["source-layer"]);
    }
    expect(light.layers[0].type).toBe("background");
  });

  it("keeps layer ids unique and orders the stack from ground to labels", () => {
    const ids = light.layers.map((layer) => layer.id);
    expect(new Set(ids).size).toBe(ids.length);
    const firstSymbol = light.layers.findIndex((layer) => layer.type === "symbol");
    const lastFill = light.layers.map((layer) => layer.type).lastIndexOf("fill");
    const lastLine = light.layers.map((layer) => layer.type).lastIndexOf("line");
    expect(firstSymbol).toBeGreaterThan(lastFill);
    expect(firstSymbol).toBeGreaterThan(lastLine);
    // Cities sit on top of everything else so their names never lose to a street
    expect(ids[ids.length - 1]).toBe("place-city");
  });

  it("changes only the paint between schemes: same layers, void paper in the dark one", () => {
    expect(dark.layers.map((layer) => layer.id)).toEqual(light.layers.map((layer) => layer.id));
    expect(dark.layers.map((layer) => layer.type)).toEqual(light.layers.map((layer) => layer.type));
    expect(basemapPalette("dark").background).toBe("#0d001a");
    expect(basemapPalette("light").background).not.toBe("#0d001a");
    expect(light.layers[0]).toMatchObject({ paint: { "background-color": basemapPalette("light").background } });
    expect(dark.layers[0]).toMatchObject({ paint: { "background-color": basemapPalette("dark").background } });
    // Accent as text follows theme.css: brand-blue on both papers, it holds 5:1 on brand-void
    expect(basemapPalette("light").accent).toBe("#007aff");
    expect(basemapPalette("dark").accent).toBe("#007aff");
  });

  it("labels read the Russian name first and use only the two fonts hosted under /tiles/fonts", () => {
    const symbols = layersOf(light).filter((layer) => layer.type === "symbol");
    expect(symbols.length).toBeGreaterThan(5);
    const hosted = Object.values(BASEMAP_FONTS) as string[];
    for (const layer of symbols) {
      const field = JSON.stringify(layer.layout?.["text-field"]);
      if (layer.id !== "housenumber") expect(field).toContain('"name:ru"');
      if (layer.id !== "housenumber") expect(field).toContain('["get","name"]');
      for (const font of layer.layout?.["text-font"] as string[]) expect(hosted).toContain(font);
      expect(layer.paint?.["text-halo-width"]).toBeGreaterThan(0);
    }
  });

  it("marks metro stations with an accent circle from z12 and names them from z13", () => {
    const dot = layersOf(light).find((layer) => layer.id === "poi-metro");
    const label = layersOf(light).find((layer) => layer.id === "poi-metro-label");
    expect(dot?.type).toBe("circle");
    expect(dot?.minzoom).toBe(12);
    expect(JSON.stringify(dot?.filter)).toContain('"railway"');
    expect(JSON.stringify(dot?.filter)).toContain('"subway"');
    expect(dot?.paint?.["circle-color"]).toBe(basemapPalette("light").accent);
    expect(label?.minzoom).toBe(13);
    expect(label?.paint?.["text-color"]).toBe(basemapPalette("light").accent);
  });

  it("hides buildings and house numbers until the street zooms, and city names once inside the city", () => {
    const byId = (id: string) => layersOf(light).find((layer) => layer.id === id);
    expect(byId("building")?.minzoom).toBe(13);
    expect(byId("housenumber")?.minzoom).toBe(17);
    expect(byId("place-city")?.maxzoom).toBe(14);
    expect(byId("road-tunnel")?.paint?.["line-dasharray"]).toBeDefined();
  });

  it("names the style after the scheme so a restyle is visible in the MapLibre map", () => {
    expect(light.name).toBe("max-events-light");
    expect(dark.name).toBe("max-events-dark");
  });
});
