// START_MODULE_CONTRACT
// PURPOSE: Pure mapping of events and places to map marker data for the catalog map screen.
// SCOPE: Events get coordinates through their place; events without a resolvable place are skipped; places always get their own marker.
// DEPENDS: ./format.js (formatStartsAt), @max-events/api-contracts (Event, Place)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MapMarker - marker payload: popup title/subtitle, coordinates, event id (null for place markers), place id (set for place markers), promoted flag (#205)
// - buildMapMarkers - events (via place coordinates) + places -> marker list
// END_MODULE_MAP

import type { Event, Place } from "@max-events/api-contracts";
import { formatStartsAt } from "./format";

export interface MapMarker {
  key: string;
  /** Event markers navigate to the event page; place markers open the place page. */
  eventId: string | null;
  placeId: string | null;
  /** Promoted event markers get the highlighted pin and the «Промо» popup chip (#205). */
  promoted: boolean;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

export function buildMapMarkers(events: Event[], places: Place[]): MapMarker[] {
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
      title: event.title,
      subtitle: `${formatStartsAt(event.startsAt)} · ${event.priceRub === null ? "Бесплатно" : `${event.priceRub} ₽`}`,
      lat: place.latitude,
      lng: place.longitude,
    });
  }
  for (const place of places) {
    markers.push({ key: `place-${place.id}`, eventId: null, placeId: place.id, promoted: false, title: place.title, subtitle: place.address, lat: place.latitude, lng: place.longitude });
  }
  return markers;
}
