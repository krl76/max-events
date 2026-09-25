import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockEvents, mockFriends, mockPlaces } from "../api/mock";
import { basemapById, DEFAULT_BASEMAP } from "./basemaps";
import { buildMapMarkers, type MapMarker } from "./mapMarkers";
import { escapeHtml, formatMapChange, formatMapTemperature, formatTravelOption, initEventMap, mapFriendsLine, mapNotice, mapRainHint, type MapCallbacks, type MapNoticeInput, type MapView } from "./MapScreen";

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
let tileHandlers: Record<string, () => void> = {};

function fakeLayerGroup() {
  const group = { addTo: vi.fn(() => group), clearLayers: vi.fn() };
  return group;
}

/** Ровно то, что экран спрашивает у leaflet, — остальное карта в тестах не трогает. */
function fakeMap() {
  const api = { remove: vi.fn(), on: vi.fn(), off: vi.fn(), getZoom: vi.fn(() => zoom), setZoom: vi.fn(), flyTo: vi.fn(), flyToBounds: vi.fn() };
  return api;
}

const view = (markers: MapMarker[], extra: Partial<MapView> = {}): MapView => ({ markers, origin: null, route: null, selectedKey: null, basemap: DEFAULT_BASEMAP, scheme: "light", ...extra });

const callbacks = (extra: Partial<MapCallbacks> = {}): MapCallbacks => ({ onOpenEvent: vi.fn(), onOpenPlace: vi.fn(), onSelect: vi.fn(), onTileTrouble: vi.fn(), onBasemapFallback: vi.fn(), ...extra });

beforeEach(() => {
  zoom = STREET_ZOOM;
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
    const api = { addTo: vi.fn(() => api), bindPopup: vi.fn(() => api), on: vi.fn(() => api) };
    return api;
  });
  leaflet.polyline.mockImplementation(() => ({ addTo: vi.fn() }));
  leaflet.latLngBounds.mockImplementation((points: unknown) => points);
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
    const markers = buildMapMarkers(mockEvents, mockPlaces);
    await initEventMap(container, view(markers), callbacks());

    expect(leaflet.marker).toHaveBeenCalledTimes(markers.length);
    expect(leaflet.marker.mock.calls.map((call) => call[0])).toEqual(markers.map((marker) => [marker.lat, marker.lng]));
    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin" }));
  });

  it("renders a popup mini-card with a button that opens the event route", async () => {
    const onOpenEvent = vi.fn();
    const placed = mockEvents.find((item) => item.placeId !== null)!;
    await initEventMap(container, view(buildMapMarkers([placed], mockPlaces)), callbacks({ onOpenEvent }));

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
    await initEventMap(container, view(buildMapMarkers([promoted], mockPlaces)), callbacks());

    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin app-map-pin--promo" }));

    const popup = leaflet.marker.mock.results[0].value.bindPopup.mock.calls[0][0] as FakeNode;
    expect(popup.appended.some((node) => node.textContent === "Промо")).toBe(true);
  });

  it("keeps the plain pin for a regular event and lifts the selected one", async () => {
    const placed = mockEvents.find((item) => item.placeId !== null && !item.promoted)!;
    const markers = buildMapMarkers([placed], mockPlaces);
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

  it("marks where the viewer stands and dots the line to the selected object", async () => {
    await initEventMap(container, view([], { origin: [55.75, 37.61], route: [55.76, 37.62] }), callbacks());

    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin app-map-pin--me" }));
    expect((leaflet.divIcon.mock.calls[0][0] as { html: string }).html).toContain("Вы здесь");
    expect(leaflet.polyline).toHaveBeenCalledWith(
      [
        [55.75, 37.61],
        [55.76, 37.62],
      ],
      expect.objectContaining({ className: "app-map-route" }),
    );
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

const NOTICE: MapNoticeInput = { mapFailed: false, tilesFailed: false, vectorFallback: false, loading: false, placesFailed: false, eventsFailed: false, markerCount: 4, query: "", anyLayerOn: true, geoDenied: false, locateOn: false };

describe("mapNotice", () => {
  it("says nothing when the map has objects and everything loaded", () => {
    expect(mapNotice(NOTICE)).toBeNull();
  });

  it("explains an empty map instead of leaving the canvas mute", () => {
    expect(mapNotice({ ...NOTICE, markerCount: 0 })).toBe("Рядом ничего не нашлось.");
    expect(mapNotice({ ...NOTICE, markerCount: 0, loading: true })).toBe("Ищем объекты рядом…");
    expect(mapNotice({ ...NOTICE, markerCount: 0, anyLayerOn: false })).toContain("слои выключены");
    expect(mapNotice({ ...NOTICE, markerCount: 0, query: "  джаз " })).toBe("По запросу «джаз» на карте ничего нет.");
  });

  it("names the broken source rather than blaming the map", () => {
    expect(mapNotice({ ...NOTICE, markerCount: 0, placesFailed: true, eventsFailed: true })).toContain("Карта на месте");
    // Событие без площадки не имеет координат, поэтому одного упавшего запроса хватает, чтобы карта опустела.
    expect(mapNotice({ ...NOTICE, markerCount: 0, placesFailed: true })).toContain("Объекты не загрузились");
    expect(mapNotice({ ...NOTICE, placesFailed: true })).toContain("Часть объектов не загрузилась");
    expect(mapNotice({ ...NOTICE, tilesFailed: true })).toContain("Подложка карты не отвечает");
    // The own basemap fell back to the standard one: the person sees not what they picked, and hears why
    expect(mapNotice({ ...NOTICE, vectorFallback: true })).toBe("Своя подложка здесь не открылась — показана стандартная.");
    // Dead tiles outrank the fallback line: nothing is drawn at all
    expect(mapNotice({ ...NOTICE, tilesFailed: true, vectorFallback: true })).toContain("Подложка карты не отвечает");
    expect(mapNotice({ ...NOTICE, mapFailed: true, markerCount: 0 })).toContain("Карта не загрузилась");
  });

  it("answers «показать, где я» when geolocation was refused", () => {
    expect(mapNotice({ ...NOTICE, geoDenied: true })).toBeNull();
    expect(mapNotice({ ...NOTICE, geoDenied: true, locateOn: true })).toContain("центр города");
  });
});

const WEATHER = { temperatureC: 19, condition: "ясно", changesAt: "2026-09-12T19:00:00+03:00", changesTo: "дождь" };
const WALK = { mode: "walk" as const, minutes: 18, distanceKm: 1.4, transfers: null };
const METRO = { mode: "metro" as const, minutes: 9, distanceKm: 1.4, transfers: 1 };

describe("map chrome formatting", () => {
  it("signs the temperature and names the change that is coming", () => {
    expect(formatMapTemperature(WEATHER)).toBe("+19°");
    expect(formatMapTemperature({ ...WEATHER, temperatureC: -4.4 })).toBe("-4°");
    expect(formatMapChange(WEATHER)).toMatch(/^дождь в \d\d:\d\d$/);
    expect(formatMapChange({ ...WEATHER, changesAt: null, changesTo: null })).toBeNull();
  });

  it("advises the metro only when there is rain to dodge and a metro to dodge it with", () => {
    expect(mapRainHint(WEATHER, [WALK, METRO])).toMatch(/^Дождь с \d\d:\d\d — метро суше, зонт не понадобится$/);
    expect(mapRainHint(WEATHER, [WALK])).toBeNull();
    expect(mapRainHint({ ...WEATHER, changesTo: "ясно" }, [WALK, METRO])).toBeNull();
    expect(mapRainHint(null, [WALK, METRO])).toBeNull();
  });

  it("splits a travel option into the minutes and the reason under them", () => {
    expect(formatTravelOption(WALK)).toEqual({ value: "18 мин", note: "пешком · 1,4 км" });
    expect(formatTravelOption(METRO)).toEqual({ value: "9 мин", note: "метро · 1 пересадка" });
    expect(formatTravelOption({ ...METRO, transfers: 0 })).toEqual({ value: "9 мин", note: "метро · без пересадок" });
    expect(formatTravelOption({ ...METRO, transfers: 2 })).toEqual({ value: "9 мин", note: "метро · 2 пересадки" });
  });

  it("names the friends who were at the selected place, in the past tense the layer answers in", () => {
    const place = mockPlaces[0];
    const visit = (names: string[]) => ({ place, friends: names.map((name, index) => ({ id: String(index), name, avatarUrl: null })), lastVisitAt: "2026-09-16T20:00:00+03:00" });

    expect(mapFriendsLine(undefined)).toBeNull();
    expect(mapFriendsLine(visit(["Анна Соколова"]))).toBe("Были здесь: Анна");
    expect(mapFriendsLine(visit(["Анна Соколова", "Дима Кузнецов"]))).toBe("Анна и Дима были здесь");
    expect(mapFriendsLine(visit(["Анна Соколова", "Дима Кузнецов", "Катя Орлова"]))).toBe("Анна, Дима и ещё 1 были здесь");
  });

  it("escapes the venue title before it goes into a divIcon, which takes html and not nodes", () => {
    expect(escapeHtml('<b>"Депо" & Co</b>')).toBe("&lt;b&gt;&quot;Депо&quot; &amp; Co&lt;/b&gt;");
  });
});
