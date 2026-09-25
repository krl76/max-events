import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OWN_BASEMAP, STANDARD_BASEMAP, basemapById } from "./basemaps";
import type { ThemeScheme } from "../ui/theme";
import { initEventMap, mapWrapClass, type MapCallbacks, type MapView } from "./MapScreen";
import type { VectorBasemapLayer } from "./vectorBasemap";

const leaflet = vi.hoisted(() => ({
  map: vi.fn(),
  tileLayer: vi.fn(),
  marker: vi.fn(),
  divIcon: vi.fn(),
  layerGroup: vi.fn(),
  polyline: vi.fn(),
  latLngBounds: vi.fn(),
}));

vi.mock("leaflet", () => leaflet);

/** MapLibre is heavy and WebGL-bound: the map only asks this module to mount, restyle and remove a layer. */
const vectorBasemap = vi.hoisted(() => ({
  mountVectorBasemap: vi.fn(),
  webglAvailable: vi.fn(() => true),
}));

vi.mock("./vectorBasemap", () => vectorBasemap);

const container = {} as HTMLElement;

const view = (extra: Partial<MapView> = {}): MapView => ({ markers: [], origin: null, route: null, selectedKey: null, basemap: OWN_BASEMAP, scheme: "light", ...extra });

const callbacks = (extra: Partial<MapCallbacks> = {}): MapCallbacks => ({ onOpenEvent: vi.fn(), onOpenPlace: vi.fn(), onSelect: vi.fn(), onTileTrouble: vi.fn(), onBasemapFallback: vi.fn(), ...extra });

function fakeVectorLayer() {
  return { remove: vi.fn<() => void>(), setScheme: vi.fn<(scheme: ThemeScheme) => void>() };
}

/** The mount promise settles in a microtask; one turn lets the map's own then-handler run before the assertion. */
const settle = () => Promise.resolve();

beforeEach(() => {
  vi.stubGlobal("document", { createElement: () => ({ className: "", append: () => {}, addEventListener: () => {} }) });
  for (const spy of Object.values(leaflet)) spy.mockReset();
  vectorBasemap.mountVectorBasemap.mockReset();
  leaflet.map.mockImplementation(() => ({ remove: vi.fn(), on: vi.fn(), off: vi.fn(), getZoom: vi.fn(() => 12), setZoom: vi.fn(), flyTo: vi.fn(), flyToBounds: vi.fn() }));
  leaflet.tileLayer.mockImplementation(() => {
    const tiles = { addTo: vi.fn(() => tiles), remove: vi.fn(), on: vi.fn() };
    return tiles;
  });
  leaflet.layerGroup.mockImplementation(() => {
    const group = { addTo: vi.fn(() => group), clearLayers: vi.fn() };
    return group;
  });
  leaflet.marker.mockImplementation(() => {
    const api = { addTo: vi.fn(() => api), bindPopup: vi.fn(() => api), on: vi.fn(() => api) };
    return api;
  });
  leaflet.polyline.mockImplementation(() => ({ addTo: vi.fn() }));
  leaflet.divIcon.mockImplementation((options: unknown) => options);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initEventMap with the own vector basemap", () => {
  it("mounts it through MapLibre instead of a tile layer, hands over the rendered scheme, and restyles in place when the scheme flips", async () => {
    const layer = fakeVectorLayer();
    vectorBasemap.mountVectorBasemap.mockResolvedValue(layer);
    const handle = await initEventMap(container, view({ scheme: "dark" }), callbacks());
    const map = leaflet.map.mock.results[0].value;

    expect(leaflet.tileLayer).not.toHaveBeenCalled();
    expect(vectorBasemap.mountVectorBasemap).toHaveBeenCalledWith(map, OWN_BASEMAP, "dark", expect.objectContaining({ onTrouble: expect.any(Function) }));
    await settle();

    handle.update(view({ scheme: "light" }));
    expect(layer.setScheme).toHaveBeenCalledWith("light");
    // A restyle is not a remount
    expect(vectorBasemap.mountVectorBasemap).toHaveBeenCalledTimes(1);
    expect(layer.remove).not.toHaveBeenCalled();

    // Back to a raster basemap: the vector layer leaves, a tile layer lands, the map itself stays
    handle.update(view({ basemap: basemapById("osm-de") }));
    expect(layer.remove).toHaveBeenCalledTimes(1);
    expect(leaflet.tileLayer).toHaveBeenCalledTimes(1);
    expect(leaflet.map).toHaveBeenCalledTimes(1);
  });

  it("catches up with a scheme that changed while MapLibre was still loading", async () => {
    let resolveMount!: (layer: VectorBasemapLayer) => void;
    vectorBasemap.mountVectorBasemap.mockImplementation(() => new Promise<VectorBasemapLayer>((resolve) => (resolveMount = resolve)));
    const handle = await initEventMap(container, view({ scheme: "light" }), callbacks());

    handle.update(view({ scheme: "dark" }));
    const layer = fakeVectorLayer();
    resolveMount(layer);
    await settle();

    expect(layer.setScheme).toHaveBeenCalledWith("dark");
  });

  it("drops a vector layer that arrives after the user already switched to another basemap", async () => {
    let resolveMount!: (layer: VectorBasemapLayer) => void;
    vectorBasemap.mountVectorBasemap.mockImplementation(() => new Promise<VectorBasemapLayer>((resolve) => (resolveMount = resolve)));
    const handle = await initEventMap(container, view(), callbacks());

    handle.update(view({ basemap: basemapById("hot") }));
    expect(leaflet.tileLayer).toHaveBeenCalledTimes(1);
    const late = fakeVectorLayer();
    resolveMount(late);
    await settle();

    // The late layer never shows, and the raster that replaced it is untouched
    expect(late.remove).toHaveBeenCalledTimes(1);
    expect(leaflet.tileLayer.mock.results[0].value.remove).not.toHaveBeenCalled();
  });

  it("falls back to the standard tiles when MapLibre cannot mount, and only for the mount still on screen", async () => {
    const onBasemapFallback = vi.fn();
    vectorBasemap.mountVectorBasemap.mockRejectedValue(new Error("WebGL недоступен"));
    await initEventMap(container, view(), callbacks({ onBasemapFallback }));
    await settle();
    expect(onBasemapFallback).toHaveBeenCalledTimes(1);

    // A rejection that lands after the user moved on is nobody's business anymore
    let rejectMount!: (error: Error) => void;
    vectorBasemap.mountVectorBasemap.mockImplementation(() => new Promise<VectorBasemapLayer>((_, reject) => (rejectMount = reject)));
    const late = vi.fn();
    const handle = await initEventMap(container, view(), callbacks({ onBasemapFallback: late }));
    handle.update(view({ basemap: STANDARD_BASEMAP }));
    rejectMount(new Error("late"));
    await settle();
    expect(late).not.toHaveBeenCalled();
  });

  it("reports vector load trouble once through the same dead-tiles line as a raster basemap", async () => {
    vectorBasemap.mountVectorBasemap.mockResolvedValue(fakeVectorLayer());
    const onTileTrouble = vi.fn();
    await initEventMap(container, view(), callbacks({ onTileTrouble }));
    const options = vectorBasemap.mountVectorBasemap.mock.calls[0][3] as { onTrouble: () => void };

    options.onTrouble();
    options.onTrouble();
    expect(onTileTrouble).toHaveBeenCalledTimes(1);
  });

  it("stops listening to a mount's trouble once another basemap replaced it", async () => {
    vectorBasemap.mountVectorBasemap.mockResolvedValue(fakeVectorLayer());
    const onTileTrouble = vi.fn();
    const handle = await initEventMap(container, view(), callbacks({ onTileTrouble }));
    const options = vectorBasemap.mountVectorBasemap.mock.calls[0][3] as { onTrouble: () => void };

    handle.update(view({ basemap: STANDARD_BASEMAP }));
    options.onTrouble();
    expect(onTileTrouble).not.toHaveBeenCalled();
  });
});

describe("mapWrapClass", () => {
  it("lifts the dark-scheme inversion for a dark raster and for the own vector basemap, keeps it for light rasters", () => {
    expect(mapWrapClass(STANDARD_BASEMAP)).toBe("app-map-wrap app-map16");
    expect(mapWrapClass(OWN_BASEMAP)).toBe("app-map-wrap app-map16 app-map16--tiles-scheme");
    expect(mapWrapClass({ ...STANDARD_BASEMAP, tone: "dark" })).toBe("app-map-wrap app-map16 app-map16--tiles-dark");
  });
});
