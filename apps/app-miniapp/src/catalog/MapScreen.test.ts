import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockEvents, mockFriends, mockPlaces } from "../api/mock";
import { basemapById, STANDARD_BASEMAP } from "./basemaps";
import { buildMapMarkers, type MapMarker } from "./mapMarkers";
import { initEventMap, type MapCallbacks, type MapView } from "./MapScreen";

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

interface FakeNode {
  className: string;
  textContent: string;
  appended: FakeNode[];
  click: (() => void) | null;
  append: (...children: FakeNode[]) => void;
  addEventListener: (type: string, handler: () => void) => void;
}

function fakeNode(): FakeNode {
  const node: FakeNode = { className: "", textContent: "", appended: [], click: null, append: () => {}, addEventListener: () => {} };
  node.append = (...children: FakeNode[]) => node.appended.push(...children);
  node.addEventListener = (type: string, handler: () => void) => {
    if (type === "click") node.click = handler;
  };
  return node;
}

const container = {} as HTMLElement;

/** Зум, на котором сетка кластеризации уже ничего не склеивает: один объект — один пин. */
const STREET_ZOOM = 18;

let zoom = STREET_ZOOM;
let clusterSpanMeters = 400;
let tileHandlers: Record<string, () => void> = {};

function fakeLayerGroup() {
  const group = { addTo: vi.fn(() => group), clearLayers: vi.fn() };
  return group;
}

/** Ровно то, что экран спрашивает у leaflet, — остальное карта в тестах не трогает. */
function fakeMap() {
  const api = {
    remove: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getZoom: vi.fn(() => zoom),
    getMaxZoom: vi.fn(() => 20),
    setZoom: vi.fn(),
    flyTo: vi.fn(),
    flyToBounds: vi.fn(),
    distance: vi.fn(() => clusterSpanMeters),
  };
  return api;
}

/** Растровая база для этих тестов: векторная подложка по умолчанию живёт в ./MapScreen.vector.test.ts. */
const view = (markers: MapMarker[], extra: Partial<MapView> = {}): MapView => ({ markers, origin: null, route: null, selectedKey: null, basemap: STANDARD_BASEMAP, scheme: "light", ...extra });

const callbacks = (extra: Partial<MapCallbacks> = {}): MapCallbacks => ({ onOpenEvent: vi.fn(), onOpenPlace: vi.fn(), onSelect: vi.fn(), onTileTrouble: vi.fn(), onBasemapFallback: vi.fn(), ...extra });

beforeEach(() => {
  zoom = STREET_ZOOM;
  clusterSpanMeters = 400;
  tileHandlers = {};
  vi.stubGlobal("document", { createElement: () => fakeNode() });
  for (const spy of Object.values(leaflet)) spy.mockReset();
  leaflet.map.mockImplementation(fakeMap);
  leaflet.tileLayer.mockImplementation(() => {
    const tiles = {
      addTo: vi.fn(() => tiles),
      remove: vi.fn(),
      on: vi.fn((type: string, handler: () => void) => {
        tileHandlers[type] = handler;
      }),
    };
    return tiles;
  });
  leaflet.layerGroup.mockImplementation(fakeLayerGroup);
  leaflet.marker.mockImplementation(() => {
    const api: { addTo: ReturnType<typeof vi.fn>; bindPopup: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; click: (() => void) | null } = {
      addTo: vi.fn(() => api),
      bindPopup: vi.fn(() => api),
      on: vi.fn((type: string, handler: () => void) => {
        if (type === "click") api.click = handler;
        return api;
      }),
      click: null,
    };
    return api;
  });
  leaflet.polyline.mockImplementation(() => ({ addTo: vi.fn() }));
  leaflet.latLngBounds.mockImplementation((points: [number, number][]) => {
    const bounds = {
      getNorthEast: () => points[0],
      getSouthWest: () => points[points.length - 1] ?? points[0],
      pad: () => bounds,
    };
    return bounds;
  });
  leaflet.divIcon.mockImplementation((options: unknown) => options);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initEventMap", () => {
  it("opens on Moscow without the Leaflet attribution bar and without its zoom control", async () => {
    const handle = await initEventMap(container, view([]), callbacks());

    expect(leaflet.map).toHaveBeenCalledWith(container, expect.objectContaining({ center: [55.7522, 37.6156], zoom: 11, attributionControl: false, zoomControl: false }));
    expect(leaflet.tileLayer).toHaveBeenCalledWith("https://tile.openstreetmap.org/{z}/{x}/{y}.png", expect.objectContaining({ maxZoom: 19 }));
    expect(typeof handle.dispose).toBe("function");
  });

  it("mounts the basemap the view asks for and swaps the tile layer in place only when the view brings another", async () => {
    const handle = await initEventMap(container, view([], { basemap: basemapById("hot") }), callbacks());
    const first = leaflet.tileLayer.mock.results[0].value;

    expect(leaflet.tileLayer).toHaveBeenCalledWith("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", expect.objectContaining({ subdomains: "abc", maxZoom: 19 }));
    expect(first.remove).not.toHaveBeenCalled();

    handle.update(view([], { basemap: basemapById("osm-de") }));
    // The old layer leaves before the new one lands, and nothing else of the map is rebuilt
    expect(first.remove).toHaveBeenCalledTimes(1);
    expect(leaflet.tileLayer).toHaveBeenCalledTimes(2);
    expect(leaflet.tileLayer.mock.calls[1][0]).toBe("https://tile.openstreetmap.de/{z}/{x}/{y}.png");
    expect(leaflet.map).toHaveBeenCalledTimes(1);

    handle.update(view([], { basemap: basemapById("osm-de") }));
    expect(leaflet.tileLayer).toHaveBeenCalledTimes(2);
  });

  it("removes the map when disposed", async () => {
    const handle = await initEventMap(container, view([]), callbacks());
    const remove = leaflet.map.mock.results[0].value.remove;

    handle.dispose();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("creates one marker per mapped event/place at the mapped coordinates", async () => {
    const unique: MapMarker[] = [
      { key: "a", eventId: "e1", placeId: null, promoted: false, friends: false, glyph: "afisha", title: "A", subtitle: "", lat: 55.75, lng: 37.61 },
      { key: "b", eventId: null, placeId: "p1", promoted: false, friends: false, glyph: "place", title: "B", subtitle: "", lat: 55.76, lng: 37.64 },
    ];
    await initEventMap(container, view(unique), callbacks());

    expect(leaflet.marker).toHaveBeenCalledTimes(2);
    expect(leaflet.marker.mock.calls.map((call) => call[0])).toEqual([
      [55.75, 37.61],
      [55.76, 37.64],
    ]);
    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin" }));
  });

  it("renders a popup mini-card with a button that opens the event route", async () => {
    const onOpenEvent = vi.fn();
    const placed = mockEvents.find((item) => item.placeId !== null)!;
    const venue = mockPlaces.filter((place) => place.id === placed.placeId);
    await initEventMap(container, view(buildMapMarkers([placed], venue).filter((marker) => marker.eventId === placed.id)), callbacks({ onOpenEvent }));

    const eventPopup = leaflet.marker.mock.results[0].value.bindPopup.mock.calls[0][0] as FakeNode;
    expect(eventPopup.appended.some((node) => node.textContent === placed.title)).toBe(true);

    const button = eventPopup.appended.find((node) => node.textContent === "Открыть")!;
    expect(onOpenEvent).not.toHaveBeenCalled();
    button.click!();
    expect(onOpenEvent).toHaveBeenCalledWith(placed.id);
    expect(onOpenEvent).toHaveBeenCalledTimes(1);
  });

  it("gives place markers a popup button that opens the place route", async () => {
    const onOpenPlace = vi.fn();
    await initEventMap(container, view(buildMapMarkers([], mockPlaces)), callbacks({ onOpenPlace }));

    const placePopup = leaflet.marker.mock.results[0].value.bindPopup.mock.calls[0][0] as FakeNode;
    expect(placePopup.appended.some((node) => node.textContent === mockPlaces[0].title)).toBe(true);

    const button = placePopup.appended.find((node) => node.textContent === "Открыть место")!;
    expect(onOpenPlace).not.toHaveBeenCalled();
    button.click!();
    expect(onOpenPlace).toHaveBeenCalledWith(mockPlaces[0].id);
    expect(onOpenPlace).toHaveBeenCalledTimes(1);
  });

  it("highlights the pin and the popup of a promoted event", async () => {
    const placed = mockEvents.find((item) => item.placeId !== null)!;
    const promoted = { ...placed, promoted: true };
    const venue = mockPlaces.filter((place) => place.id === placed.placeId);
    await initEventMap(container, view(buildMapMarkers([promoted], venue).filter((marker) => marker.eventId === promoted.id)), callbacks());

    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin app-map-pin--promo" }));

    const popup = leaflet.marker.mock.results[0].value.bindPopup.mock.calls[0][0] as FakeNode;
    expect(popup.appended.some((node) => node.textContent === "Промо")).toBe(true);
  });

  it("keeps the plain pin for a regular event and lifts the selected one", async () => {
    const placed = mockEvents.find((item) => item.placeId !== null && !item.promoted)!;
    const venue = mockPlaces.filter((place) => place.id === placed.placeId);
    const markers = buildMapMarkers([placed], venue).filter((marker) => marker.eventId === placed.id);
    await initEventMap(container, view(markers, { selectedKey: markers[0].key }), callbacks());

    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin app-map-pin--active" }));

    const popup = leaflet.marker.mock.results[0].value.bindPopup.mock.calls[0][0] as FakeNode;
    expect(popup.appended.some((node) => node.textContent === "Промо")).toBe(false);
  });

  it("gives the «друзья были здесь» marker its own pin and opens the place from its popup", async () => {
    const onOpenPlace = vi.fn();
    const visit = { place: mockPlaces[0], friends: [mockFriends[0]], lastVisitAt: "2026-09-16T20:00:00+03:00" };
    await initEventMap(container, view(buildMapMarkers([], [mockPlaces[0]], [visit])), callbacks({ onOpenPlace }));

    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin app-map-pin--friends" }));

    const popup = leaflet.marker.mock.results[0].value.bindPopup.mock.calls[0][0] as FakeNode;
    expect(popup.appended.some((node) => node.textContent === `Были: ${mockFriends[0].name}`)).toBe(true);
    popup.appended.find((node) => node.textContent === "Открыть место")!.click!();
    expect(onOpenPlace).toHaveBeenCalledWith(mockPlaces[0].id);
  });

  it("draws one bubble instead of a crowd of pins at city zoom", async () => {
    zoom = 11;
    const crowd: MapMarker[] = [0, 1, 2].map((index) => ({ key: `place-${index}`, eventId: null, placeId: `p${index}`, promoted: false, friends: false, glyph: "place", title: `Место ${index}`, subtitle: "", lat: 55.75 + index * 0.0005, lng: 37.61 + index * 0.0005 }));
    await initEventMap(container, view(crowd), callbacks());

    expect(leaflet.marker).toHaveBeenCalledTimes(1);
    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin app-map-pin--cluster" }));
    expect((leaflet.divIcon.mock.calls[0][0] as { html: string }).html).toContain(">3<");
  });

  it("zooms into a spread cluster so the numbered bubble opens onto its events and places", async () => {
    zoom = 11;
    const crowd: MapMarker[] = [0, 1, 2].map((index) => ({ key: `place-${index}`, eventId: null, placeId: `p${index}`, promoted: false, friends: false, glyph: "place", title: `Место ${index}`, subtitle: "", lat: 55.75 + index * 0.0005, lng: 37.61 + index * 0.0005 }));
    await initEventMap(container, view(crowd), callbacks());
    const map = leaflet.map.mock.results[0]?.value as { flyTo: ReturnType<typeof vi.fn>; flyToBounds: ReturnType<typeof vi.fn> };
    const bubble = leaflet.marker.mock.results[0]?.value as { click: (() => void) | null };

    bubble.click?.();

    expect(map.flyToBounds.mock.calls.length).toBe(1);
    expect(map.flyTo.mock.calls.length).toBe(0);
    expect((leaflet.divIcon.mock.calls[0][0] as { html: string }).html).toContain(">3<");
  });

  it("leaves events that share a coordinate on that point when the number is tapped", async () => {
    zoom = 11;
    const stacked: MapMarker[] = [0, 1].map((index) => ({ key: `event-${index}`, eventId: `e${index}`, placeId: null, promoted: false, friends: false, glyph: "afisha", title: `Событие ${index}`, subtitle: "", lat: 55.75, lng: 37.61 }));
    await initEventMap(container, view(stacked), callbacks());
    const map = leaflet.map.mock.results[0]?.value as { flyTo: ReturnType<typeof vi.fn>; flyToBounds: ReturnType<typeof vi.fn> };
    const bubble = leaflet.marker.mock.results[0]?.value as { click: (() => void) | null };

    bubble.click?.();
    bubble.click?.();

    expect(leaflet.marker.mock.calls.map((call) => call[0])).toEqual([[55.75, 37.61]]);
    expect(map.flyTo.mock.calls.length).toBe(0);
    expect(map.flyToBounds.mock.calls.length).toBe(2);
  });

  it("draws each separated event on its own coordinates once zoom opens a pin of space", async () => {
    zoom = 11;
    const houses: MapMarker[] = [0, 1].map((index) => ({ key: `place-${index}`, eventId: null, placeId: `p${index}`, promoted: false, friends: false, glyph: "place", title: `Место ${index}`, subtitle: "", lat: 55.75 + index * 0.003, lng: 37.61 }));
    await initEventMap(container, view(houses), callbacks());
    const map = leaflet.map.mock.results[0]?.value as { on: { mock: { calls: [string, () => void][] } } };
    expect(leaflet.marker).toHaveBeenCalledTimes(1);

    zoom = 16;
    map.on.mock.calls.find((call) => call[0] === "zoom")?.[1]?.();

    expect(leaflet.marker.mock.calls.slice(-2).map((call) => call[0])).toEqual([
      [55.75, 37.61],
      [55.753, 37.61],
    ]);
  });

  it("marks where the viewer stands and draws the walking geometry", async () => {
    await initEventMap(
      container,
      view([], {
        origin: [55.75, 37.61],
        route: [
          [55.75, 37.61],
          [55.753, 37.615],
          [55.76, 37.62],
        ],
      }),
      callbacks(),
    );

    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin app-map-pin--me" }));
    expect((leaflet.divIcon.mock.calls[0][0] as { html: string }).html).toContain("Вы здесь");
    expect(leaflet.polyline).toHaveBeenCalledWith(
      [
        [55.75, 37.61],
        [55.753, 37.615],
        [55.76, 37.62],
      ],
      expect.objectContaining({ className: "app-map-route" }),
    );
  });

  it("numbers each walk step and draws the route without a here pin", async () => {
    const steps: MapMarker[] = [
      { key: "walk-1", eventId: null, placeId: null, promoted: false, friends: false, glyph: "place", title: "Кремль", subtitle: "", lat: 55.75, lng: 37.61, badge: 1 },
      { key: "walk-2", eventId: null, placeId: null, promoted: false, friends: false, glyph: "place", title: "Набережная", subtitle: "", lat: 55.76, lng: 37.62, badge: 2 },
    ];
    await initEventMap(
      container,
      view(steps, {
        origin: [55.75, 37.61],
        walkRoute: true,
        route: [
          [55.75, 37.61],
          [55.755, 37.615],
          [55.76, 37.62],
        ],
      }),
      callbacks(),
    );

    const html = leaflet.divIcon.mock.calls.map((call) => (call[0] as { html: string }).html).join("\n");
    expect(html).toContain('class="app-map-step">1');
    expect(html).toContain('class="app-map-step">2');
    expect(html).not.toContain("Вы здесь");
    expect(leaflet.marker).toHaveBeenCalledTimes(2);
    expect(leaflet.polyline).toHaveBeenCalledWith(
      [
        [55.75, 37.61],
        [55.755, 37.615],
        [55.76, 37.62],
      ],
      expect.objectContaining({ className: "app-map-route-casing" }),
    );
  });

  it("asks the screen to reopen the route card when the dropped pin is tapped", async () => {
    const onSelectDropped = vi.fn();
    await initEventMap(container, view([], { dropped: [55.7522, 37.6156] }), callbacks({ onSelectDropped }));
    const dropped = leaflet.marker.mock.results.at(-1)?.value as { click: (() => void) | null };

    dropped.click?.();

    expect(onSelectDropped).toHaveBeenCalledTimes(1);
  });

  it("redraws new data into the map it already built instead of building a second one", async () => {
    const handle = await initEventMap(container, view([]), callbacks());
    leaflet.marker.mockClear();

    handle.update(view(buildMapMarkers([], [mockPlaces[0]])));

    expect(leaflet.map).toHaveBeenCalledTimes(1);
    expect(leaflet.marker).toHaveBeenCalledTimes(1);
  });

  it("zooms and flies through the map it holds, so the chrome needs no Leaflet of its own", async () => {
    const handle = await initEventMap(container, view([]), callbacks());
    const map = leaflet.map.mock.results[0].value;

    handle.zoomBy(1);
    handle.focus([55.8, 37.5]);

    expect(map.setZoom).toHaveBeenCalledWith(STREET_ZOOM + 1);
    expect(map.flyTo).toHaveBeenCalledWith([55.8, 37.5], expect.any(Number), expect.anything());
  });

  it("reports dead tiles once per basemap, however many of them fail, and re-arms on a swap", async () => {
    const onTileTrouble = vi.fn();
    const handle = await initEventMap(container, view([]), callbacks({ onTileTrouble }));

    tileHandlers.tileerror();
    tileHandlers.tileerror();
    expect(onTileTrouble).toHaveBeenCalledTimes(1);

    // Another server is another chance: its first failure is reported afresh, the second is not
    handle.update(view([], { basemap: basemapById("osm-de") }));
    tileHandlers.tileerror();
    tileHandlers.tileerror();
    expect(onTileTrouble).toHaveBeenCalledTimes(2);
  });
});
