// START_MODULE_CONTRACT
// PURPOSE: Pure mapping of events and places to map marker data for the catalog map screen, plus the grid clustering the pins are drawn through.
// SCOPE: Events get coordinates through their place; events without a resolvable place are skipped; places always get their own marker. Objects whose coordinates are missing or out of range are dropped here rather than handed to Leaflet, which throws on an invalid LatLng and would take the whole map down with one bad row. The optional friends layer replaces the plain place marker where friends have been, so one place never carries two pins. Clustering is a pure grid over the marker list: the screen re-runs it on every zoom change.
// DEPENDS: ./format.js (formatStartsAt), @max-events/api-contracts (Event, Place, FriendPlaceVisit)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MapMarker - marker payload: popup title/subtitle, coordinates, event id (null for place markers), place id (set for place markers), promoted flag (#205), pin glyph
// - MapPinGlyph - which glyph the pin carries: the four event categories, the place categories that have one, «place» for the rest
// - MapCluster - one drawn point: a single marker or a group of them collapsed into one bubble
// - MAP_CLUSTER_BASE_ZOOM - zoom the cell size is quoted at (the initial city zoom of the map)
// - MAP_CLUSTER_CELL_DEGREES - cell side at the base zoom, ~2.2 km of latitude
// - MAP_CLUSTER_MAX_ZOOM - from this zoom on nothing is collapsed: at street scale pins no longer overlap
// - hasMapPoint - whether a lat/lng pair is usable as a Leaflet coordinate
// - eventPinGlyph - event category -> pin glyph
// - placePinGlyph - place category -> pin glyph
// - clusterCellDegrees - grid cell side in degrees for a zoom level
// - clusterMapMarkers - markers + zoom -> the points to draw, singles kept as singles
// - friendsWereHereSubtitle - «Были: Аня, Пётр» plus how many more, for the friends-layer popup
// - buildMapMarkers - events (via place coordinates) + places -> marker list, with the optional friends layer
// END_MODULE_MAP

import type { Event, FriendPlaceVisit, Place } from "@max-events/api-contracts";
import { formatStartsAt } from "./format";

export type MapPinGlyph = "afisha" | "volunteering" | "tourism" | "sport" | "park" | "museum" | "food" | "place";

export interface MapMarker {
  key: string;
  /** Event markers navigate to the event page; place markers open the place page. */
  eventId: string | null;
  placeId: string | null;
  /** Promoted event markers get the highlighted pin and the «Промо» popup chip (#205). */
  promoted: boolean;
  /** Set on the «друзья были здесь» layer markers, which get their own pin (#472). */
  friends: boolean;
  /** Что нарисовано внутри пина: по глифу объект читается до тапа. */
  glyph: MapPinGlyph;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

/**
 * Leaflet бросает на невалидном LatLng, и один объект без координат уносит весь экран: карта не
 * открывается вообще. Поэтому такие строки отсеиваются здесь, до маркеров.
 */
export function hasMapPoint(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Категории события и глифы пина совпадают один в один — пересчёта не нужно, но точка входа одна. */
export function eventPinGlyph(category: Event["category"]): MapPinGlyph {
  return category;
}

/** «Прочее» своего рисунка не имеет: у такой площадки на пине общая булавка. */
export function placePinGlyph(category: Place["category"]): MapPinGlyph {
  return category === "other" ? "place" : category;
}

export interface MapCluster {
  key: string;
  lat: number;
  lng: number;
  /** Ровно один маркер — это не скопление: такая точка рисуется обычным пином. */
  markers: MapMarker[];
}

/** Стартовый зум карты: от него считается шаг сетки. */
export const MAP_CLUSTER_BASE_ZOOM = 11;
/** Сторона клетки на стартовом зуме: 0,02° широты — примерно 2,2 км, четверть экрана города. */
export const MAP_CLUSTER_CELL_DEGREES = 0.02;
/** Ближе этого зума пины уже не налезают друг на друга, и склеивать их значит прятать данные. */
export const MAP_CLUSTER_MAX_ZOOM = 15;

/**
 * Клетка делится пополам на каждый шаг зума — так скопление распадается постепенно, а не рывком.
 * Сетка градусная, а не метрическая: на широте Москвы клетка по долготе вдвое уже, чем по широте,
 * и это ровно то, что нужно — экран тоже шире в градусах, чем в километрах.
 */
export function clusterCellDegrees(zoom: number): number {
  const level = Number.isFinite(zoom) ? zoom : MAP_CLUSTER_BASE_ZOOM;
  return MAP_CLUSTER_CELL_DEGREES * 2 ** (MAP_CLUSTER_BASE_ZOOM - level);
}

function loneCluster(marker: MapMarker): MapCluster {
  return { key: marker.key, lat: marker.lat, lng: marker.lng, markers: [marker] };
}

export function clusterMapMarkers(markers: MapMarker[], zoom: number): MapCluster[] {
  if (zoom >= MAP_CLUSTER_MAX_ZOOM) return markers.map(loneCluster);
  const cell = clusterCellDegrees(zoom);
  const buckets = new Map<string, MapMarker[]>();
  const order: string[] = [];
  for (const marker of markers) {
    const cellKey = `${Math.floor(marker.lat / cell)}:${Math.floor(marker.lng / cell)}`;
    const bucket = buckets.get(cellKey);
    if (bucket === undefined) {
      buckets.set(cellKey, [marker]);
      order.push(cellKey);
    } else bucket.push(marker);
  }
  return order.map((cellKey) => {
    const group = buckets.get(cellKey) ?? [];
    if (group.length === 1) return loneCluster(group[0]);
    // Точка скопления — центр тяжести его маркеров, иначе пузырь садится в угол клетки.
    const lat = group.reduce((sum, marker) => sum + marker.lat, 0) / group.length;
    const lng = group.reduce((sum, marker) => sum + marker.lng, 0) / group.length;
    return { key: `cluster-${group[0].key}`, lat, lng, markers: group };
  });
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
    if (!hasMapPoint(place.latitude, place.longitude)) continue;
    markers.push({
      key: `event-${event.id}`,
      eventId: event.id,
      placeId: null,
      promoted: event.promoted,
      friends: false,
      glyph: eventPinGlyph(event.category),
      title: event.title,
      subtitle: `${formatStartsAt(event.startsAt)} · ${event.priceRub === null ? "Бесплатно" : `${event.priceRub} ₽`}`,
      lat: place.latitude,
      lng: place.longitude,
    });
  }
  const visitByPlace = new Map(friendVisits.map((visit) => [visit.place.id, visit]));
  for (const place of places) {
    if (!hasMapPoint(place.latitude, place.longitude)) continue;
    const visit = visitByPlace.get(place.id);
    if (visit !== undefined) {
      // One pin per place: where friends have been, the friends marker is the place marker.
      markers.push({ key: `friends-${place.id}`, eventId: null, placeId: place.id, promoted: false, friends: true, glyph: placePinGlyph(place.category), title: place.title, subtitle: friendsWereHereSubtitle(visit), lat: place.latitude, lng: place.longitude });
      continue;
    }
    markers.push({ key: `place-${place.id}`, eventId: null, placeId: place.id, promoted: false, friends: false, glyph: placePinGlyph(place.category), title: place.title, subtitle: place.address, lat: place.latitude, lng: place.longitude });
  }
  return markers;
}
