import { describe, expect, it } from "vitest";
import { mockEvents, mockFriends, mockPlaces } from "../api/mock";
import { buildMapMarkers, clusterCellDegrees, clusterMapMarkers, eventPinGlyph, friendsWereHereSubtitle, hasMapPoint, MAP_CLUSTER_BASE_ZOOM, MAP_CLUSTER_CELL_DEGREES, MAP_CLUSTER_MAX_ZOOM, placePinGlyph, type MapMarker } from "./mapMarkers";

const placedEvent = { ...mockEvents[0], placeId: mockPlaces[0].id, startsAt: "2026-09-19T19:00:00+03:00", priceRub: 1800 };
const freeEvent = { ...mockEvents[0], id: "c0000002-0000-4000-8000-000000000002", placeId: mockPlaces[1].id, priceRub: null };
const unknownPlaceEvent = { ...mockEvents[0], id: "c0000003-0000-4000-8000-000000000003", placeId: "00000000-0000-4000-8000-000000000009" };

describe("buildMapMarkers", () => {
  it("places an event marker at its place coordinates with date and price in the subtitle", () => {
    const markers = buildMapMarkers([placedEvent, freeEvent], mockPlaces);
    const eventMarkers = markers.filter((marker) => marker.eventId !== null);

    expect(eventMarkers).toHaveLength(2);
    expect(eventMarkers[0]).toMatchObject({ eventId: placedEvent.id, title: placedEvent.title, lat: mockPlaces[0].latitude, lng: mockPlaces[0].longitude });
    expect(eventMarkers[0].subtitle).toContain("19:00");
    expect(eventMarkers[0].subtitle).toContain("1800 ₽");
    expect(eventMarkers[1].subtitle).toContain("Бесплатно");
  });

  it("skips events whose place is not in the list", () => {
    const markers = buildMapMarkers([unknownPlaceEvent], mockPlaces);

    expect(markers.every((marker) => marker.eventId === null)).toBe(true);
  });

  it("marks every place at its own coordinates", () => {
    const markers = buildMapMarkers([], mockPlaces);
    const placeMarkers = markers.filter((marker) => marker.eventId === null);

    expect(placeMarkers).toHaveLength(mockPlaces.length);
    for (const marker of placeMarkers) {
      const place = mockPlaces.find((item) => item.id === marker.key.slice("place-".length));
      expect(marker.placeId).toBe(place?.id);
      expect(marker.lat).toBe(place?.latitude);
      expect(marker.lng).toBe(place?.longitude);
      expect(marker.subtitle).toBe(place?.address);
    }
  });

  it("keeps events without a placeId out of the marker list", () => {
    const markers = buildMapMarkers(mockEvents, mockPlaces);
    const eventMarkerCount = markers.filter((marker) => marker.eventId !== null).length;

    expect(eventMarkerCount).toBe(mockEvents.filter((item) => item.placeId !== null).length);
  });

  it("flags only the markers of promoted events", () => {
    const promotedEvent = { ...placedEvent, promoted: true };
    const markers = buildMapMarkers([promotedEvent, freeEvent], mockPlaces);

    expect(markers.find((marker) => marker.eventId === promotedEvent.id)?.promoted).toBe(true);
    expect(markers.find((marker) => marker.eventId === freeEvent.id)?.promoted).toBe(false);
    expect(markers.filter((marker) => marker.eventId === null).every((marker) => !marker.promoted)).toBe(true);
  });
});

const visit = (placeIndex: number, friendCount: number) => ({ place: mockPlaces[placeIndex], friends: mockFriends.slice(0, friendCount), lastVisitAt: "2026-09-16T20:00:00+03:00" });

describe("the «друзья были здесь» layer", () => {
  it("replaces the plain place marker instead of adding a second pin on the same spot", () => {
    const withLayer = buildMapMarkers([], mockPlaces, [visit(0, 1)]);
    const onThatPlace = withLayer.filter((marker) => marker.placeId === mockPlaces[0].id);

    expect(withLayer).toHaveLength(mockPlaces.length);
    expect(onThatPlace).toHaveLength(1);
    expect(onThatPlace[0]).toMatchObject({ friends: true, placeId: mockPlaces[0].id, lat: mockPlaces[0].latitude });
    // The tap still opens the place: that is the whole point of the marker.
    expect(onThatPlace[0].subtitle).toBe(`Были: ${mockFriends[0].name}`);
    expect(withLayer.filter((marker) => marker.friends).length).toBe(1);
  });

  it("names two friends and counts the rest", () => {
    expect(friendsWereHereSubtitle(visit(0, 2))).toBe(`Были: ${mockFriends[0].name}, ${mockFriends[1].name}`);
    expect(friendsWereHereSubtitle(visit(0, 4))).toBe(`Были: ${mockFriends[0].name}, ${mockFriends[1].name} и ещё 2`);
  });

  it("leaves the map exactly as it was when the layer is off", () => {
    expect(buildMapMarkers(mockEvents, mockPlaces)).toEqual(buildMapMarkers(mockEvents, mockPlaces, []));
  });
});

describe("объекты без координат", () => {
  it("не пускает площадку с пустыми координатами в маркеры: leaflet бросил бы на ней всю карту", () => {
    const broken = { ...mockPlaces[0], latitude: null as unknown as number, longitude: undefined as unknown as number };
    const markers = buildMapMarkers([], [broken, mockPlaces[1]]);

    expect(markers).toHaveLength(1);
    expect(markers[0].placeId).toBe(mockPlaces[1].id);
  });

  it("роняет и событие, чья площадка без координат, оставляя остальные на месте", () => {
    const broken = { ...mockPlaces[0], latitude: Number.NaN, longitude: 37.6 };
    const onBroken = { ...mockEvents[0], placeId: broken.id };
    const onGood = { ...mockEvents[0], id: "c0000004-0000-4000-8000-000000000004", placeId: mockPlaces[1].id };
    const markers = buildMapMarkers([onBroken, onGood], [broken, mockPlaces[1]]);

    expect(markers.filter((marker) => marker.eventId !== null).map((marker) => marker.eventId)).toEqual([onGood.id]);
  });

  it("считает координату негодной за пределами глобуса", () => {
    expect(hasMapPoint(55.75, 37.61)).toBe(true);
    expect(hasMapPoint(0, 0)).toBe(true);
    expect(hasMapPoint(91, 37.61)).toBe(false);
    expect(hasMapPoint(55.75, 181)).toBe(false);
    expect(hasMapPoint(Number.POSITIVE_INFINITY, 37.61)).toBe(false);
    expect(hasMapPoint("55.75", 37.61)).toBe(false);
  });
});

describe("глиф пина", () => {
  it("берёт рисунок от категории события", () => {
    expect(eventPinGlyph("afisha")).toBe("afisha");
    expect(eventPinGlyph("sport")).toBe("sport");
    expect(eventPinGlyph("volunteering")).toBe("volunteering");
    expect(eventPinGlyph("tourism")).toBe("tourism");
  });

  it("сводит «прочее» площадки к общей булавке, остальные категории оставляет своими", () => {
    expect(placePinGlyph("park")).toBe("park");
    expect(placePinGlyph("museum")).toBe("museum");
    expect(placePinGlyph("food")).toBe("food");
    expect(placePinGlyph("sport")).toBe("sport");
    expect(placePinGlyph("other")).toBe("place");
  });

  it("проставляет глиф каждому маркеру, а не только событиям", () => {
    const markers = buildMapMarkers(mockEvents, mockPlaces);

    expect(markers.every((marker) => marker.glyph.length > 0)).toBe(true);
  });
});

const point = (key: string, lat: number, lng: number): MapMarker => ({ key, eventId: null, placeId: key, promoted: false, friends: false, glyph: "place", title: key, subtitle: "", lat, lng });

describe("clusterMapMarkers", () => {
  it("склеивает соседей в одну точку на городском зуме", () => {
    const clusters = clusterMapMarkers([point("a", 55.75, 37.61), point("b", 55.7505, 37.6105), point("c", 55.9, 37.9)], MAP_CLUSTER_BASE_ZOOM);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].markers.map((marker) => marker.key)).toEqual(["a", "b"]);
    expect(clusters[0].lat).toBeCloseTo(55.75025, 5);
    expect(clusters[1].markers.map((marker) => marker.key)).toEqual(["c"]);
  });

  it("распускает скопление на уличном зуме: прятать соседние объекты там уже незачем", () => {
    const crowd = [point("a", 55.75, 37.61), point("b", 55.7501, 37.6101)];

    expect(clusterMapMarkers(crowd, MAP_CLUSTER_MAX_ZOOM)).toHaveLength(2);
    expect(clusterMapMarkers(crowd, MAP_CLUSTER_MAX_ZOOM + 3)).toHaveLength(2);
  });

  it("делит клетку пополам на каждый шаг зума", () => {
    expect(clusterCellDegrees(MAP_CLUSTER_BASE_ZOOM)).toBeCloseTo(MAP_CLUSTER_CELL_DEGREES, 6);
    expect(clusterCellDegrees(MAP_CLUSTER_BASE_ZOOM + 1)).toBeCloseTo(MAP_CLUSTER_CELL_DEGREES / 2, 6);
    expect(clusterCellDegrees(MAP_CLUSTER_BASE_ZOOM - 1)).toBeCloseTo(MAP_CLUSTER_CELL_DEGREES * 2, 6);
    // Дробный зум leaflet отдаёт при плавном приближении, а NaN — только если карта ещё не готова.
    expect(clusterCellDegrees(Number.NaN)).toBeCloseTo(MAP_CLUSTER_CELL_DEGREES, 6);
  });

  it("одиночный маркер остаётся собой: его ключ — ключ маркера, а не выдуманный", () => {
    const [lone] = clusterMapMarkers([point("a", 55.75, 37.61)], MAP_CLUSTER_BASE_ZOOM);

    expect(lone.key).toBe("a");
    expect(lone.markers).toHaveLength(1);
  });

  it("держит порядок маркеров: первый в списке даёт первую точку", () => {
    const clusters = clusterMapMarkers([point("far", 55.9, 37.9), point("a", 55.75, 37.61), point("b", 55.7505, 37.6105)], MAP_CLUSTER_BASE_ZOOM);

    expect(clusters.map((cluster) => cluster.key)).toEqual(["far", "cluster-a"]);
  });

  it("на пустом списке отдаёт пустой: карта без объектов — это всё ещё карта", () => {
    expect(clusterMapMarkers([], MAP_CLUSTER_BASE_ZOOM)).toEqual([]);
  });
});
