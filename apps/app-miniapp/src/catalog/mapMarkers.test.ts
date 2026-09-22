import { describe, expect, it } from "vitest";
import { mockEvents, mockFriends, mockPlaces } from "../api/mock";
import { buildMapMarkers, friendsWereHereSubtitle } from "./mapMarkers";

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
