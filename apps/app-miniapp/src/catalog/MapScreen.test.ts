import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockEvents, mockFriends, mockPlaces } from "../api/mock";
import { buildMapMarkers } from "./mapMarkers";
import { escapeHtml, formatMapChange, formatMapTemperature, formatTravelOption, initEventMap, mapFriendsLine, mapRainHint } from "./MapScreen";

const leaflet = vi.hoisted(() => ({
  map: vi.fn(),
  tileLayer: vi.fn(),
  marker: vi.fn(),
  divIcon: vi.fn(),
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

beforeEach(() => {
  vi.stubGlobal("document", { createElement: () => fakeNode() });
  leaflet.map.mockReset();
  leaflet.tileLayer.mockReset();
  leaflet.marker.mockReset();
  leaflet.divIcon.mockReset();
  leaflet.map.mockReturnValue({ remove: vi.fn() });
  leaflet.tileLayer.mockReturnValue({ addTo: vi.fn() });
  leaflet.marker.mockImplementation(() => {
    const api = { addTo: vi.fn(() => api), bindPopup: vi.fn(() => api) };
    return api;
  });
  leaflet.divIcon.mockImplementation((options: unknown) => options);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initEventMap", () => {
  it("initializes the map centered on Moscow without the Leaflet attribution bar", async () => {
    const dispose = await initEventMap(container, { events: [], places: [], onOpenEvent: vi.fn(), onOpenPlace: vi.fn() });

    expect(leaflet.map).toHaveBeenCalledWith(container, { center: [55.7522, 37.6156], zoom: 11, attributionControl: false });
    expect(leaflet.tileLayer).toHaveBeenCalledWith("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 });
    expect(typeof dispose).toBe("function");
  });

  it("removes the map when disposed", async () => {
    const dispose = await initEventMap(container, { events: [], places: [], onOpenEvent: vi.fn(), onOpenPlace: vi.fn() });
    const remove = leaflet.map.mock.results[0].value.remove;

    dispose();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("creates one marker per mapped event/place at the mapped coordinates", async () => {
    const markers = buildMapMarkers(mockEvents, mockPlaces);
    await initEventMap(container, { events: mockEvents, places: mockPlaces, onOpenEvent: vi.fn(), onOpenPlace: vi.fn() });

    expect(leaflet.marker).toHaveBeenCalledTimes(markers.length);
    expect(leaflet.marker.mock.calls.map((call) => call[0])).toEqual(markers.map((marker) => [marker.lat, marker.lng]));
    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin" }));
  });

  it("renders a popup mini-card with a button that opens the event route", async () => {
    const onOpenEvent = vi.fn();
    const placed = mockEvents.find((item) => item.placeId !== null)!;
    await initEventMap(container, { events: [placed], places: mockPlaces, onOpenEvent, onOpenPlace: vi.fn() });

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
    await initEventMap(container, { events: [], places: mockPlaces, onOpenEvent: vi.fn(), onOpenPlace });

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
    await initEventMap(container, { events: [promoted], places: mockPlaces, onOpenEvent: vi.fn(), onOpenPlace: vi.fn() });

    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin app-map-pin--promo" }));

    const popup = leaflet.marker.mock.results[0].value.bindPopup.mock.calls[0][0] as FakeNode;
    expect(popup.appended.some((node) => node.textContent === "Промо")).toBe(true);
  });

  it("keeps the plain pin for a regular event", async () => {
    const placed = mockEvents.find((item) => item.placeId !== null && !item.promoted)!;
    await initEventMap(container, { events: [placed], places: mockPlaces, onOpenEvent: vi.fn(), onOpenPlace: vi.fn() });

    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin" }));

    const popup = leaflet.marker.mock.results[0].value.bindPopup.mock.calls[0][0] as FakeNode;
    expect(popup.appended.some((node) => node.textContent === "Промо")).toBe(false);
  });

  it("gives the «друзья были здесь» marker its own pin and opens the place from its popup", async () => {
    const onOpenPlace = vi.fn();
    const visit = { place: mockPlaces[0], friends: [mockFriends[0]], lastVisitAt: "2026-09-16T20:00:00+03:00" };
    await initEventMap(container, { events: [], places: [mockPlaces[0]], friendVisits: [visit], onOpenEvent: vi.fn(), onOpenPlace });

    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({ className: "app-map-pin app-map-pin--friends" }));

    const popup = leaflet.marker.mock.results[0].value.bindPopup.mock.calls[0][0] as FakeNode;
    expect(popup.appended.some((node) => node.textContent === `Были: ${mockFriends[0].name}`)).toBe(true);
    popup.appended.find((node) => node.textContent === "Открыть место")!.click!();
    expect(onOpenPlace).toHaveBeenCalledWith(mockPlaces[0].id);
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
