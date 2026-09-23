// START_MODULE_CONTRACT
// PURPOSE: Pure mapping of events and places to map marker data for the catalog map screen.
// SCOPE: Events get coordinates through their place; events without a resolvable place are skipped; places always get their own marker. The optional friends layer replaces the plain place marker where friends have been, so one place never carries two pins.
// DEPENDS: ./format.js (formatStartsAt), @max-events/api-contracts (Event, Place, FriendPlaceVisit)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MapMarker - marker payload: popup title/subtitle, coordinates, event id (null for place markers), place id (set for place markers), promoted flag (#205)
// - friendsWereHereSubtitle - «Были: Аня, Пётр» plus how many more, for the friends-layer popup
// - buildMapMarkers - events (via place coordinates) + places -> marker list, with the optional friends layer
// END_MODULE_MAP

import type { Event, FriendPlaceVisit, Place } from "@max-events/api-contracts";
import { formatStartsAt } from "./format";

export interface MapMarker {
  key: string;
  /** Event markers navigate to the event page; place markers open the place page. */
  eventId: string | null;
  placeId: string | null;
  /** Promoted event markers get the highlighted pin and the «Промо» popup chip (#205). */
  promoted: boolean;
  /** Set on the «друзья были здесь» layer markers, which get their own pin (#472). */
  friends: boolean;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

/** Two names and a tail: a popup is no place for a list of twelve. */
export function friendsWereHereSubtitle(visit: FriendPlaceVisit): string {
  const names = visit.friends.map((friend) => friend.name);
  const shown = names.slice(0, 2).join(", ");
  return names.length > 2 ? `Были: ${shown} и ещё ${names.length - 2}` : `Были: ${shown}`;
}

export function buildMapMarkers(events: Event[], places: Place[], friendVisits: FriendPlaceVisit[] = []): MapMarker[] {
  const placeById = new Map(places.map((place) => [place.id, place]));
  const markers: MapMarker[] = [];
  for (const event of events) {
    const place = event.placeId === null ? undefined : placeById.get(event.placeId);
    if (place === undefined) continue;
    markers.push({
      key: `event-${event.id}`,
      eventId: event.id,
      placeId: null,
      promoted: event.promoted,
      friends: false,
      title: event.title,
      subtitle: `${formatStartsAt(event.startsAt)} · ${event.priceRub === null ? "Бесплатно" : `${event.priceRub} ₽`}`,
      lat: place.latitude,
      lng: place.longitude,
    });
  }
  const visitByPlace = new Map(friendVisits.map((visit) => [visit.place.id, visit]));
  for (const place of places) {
    const visit = visitByPlace.get(place.id);
    if (visit !== undefined) {
      // One pin per place: where friends have been, the friends marker is the place marker.
      markers.push({ key: `friends-${place.id}`, eventId: null, placeId: place.id, promoted: false, friends: true, title: place.title, subtitle: friendsWereHereSubtitle(visit), lat: place.latitude, lng: place.longitude });
      continue;
    }
    markers.push({ key: `place-${place.id}`, eventId: null, placeId: place.id, promoted: false, friends: false, title: place.title, subtitle: place.address, lat: place.latitude, lng: place.longitude });
  }
  return markers;
}
