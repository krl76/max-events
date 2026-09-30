// START_MODULE_CONTRACT
// PURPOSE: Route target for a custom pin dropped on a post. Catalog places already have a selection card; a coordinate-only pin does not, so the map has nothing to route to unless this stop is built.
// SCOPE: Visibility of the dropped-pin card and the stop the walking route draws to. Does not fetch travel times or talk to Leaflet.
// DEPENDS: none
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DROPPED_PIN_TITLE - card title for a coordinate-only pin
// - MapRouteStop - destination the walking route draws to
// - droppedPinKey - stable key of one dropped pin, so dismissing one does not hide the next
// - droppedPinCardVisible - whether the custom pin should offer a route (not a catalog place, not dismissed)
// - droppedPinStop - route stop at the dropped coordinates
// - placeRouteStop - route stop for a catalog place
// - routeBarLabel - the line above the drawn route
// END_MODULE_MAP

export const DROPPED_PIN_TITLE = "Точка на карте";

export type MapRouteStop = {
  readonly kind: "pin" | "place";
  readonly title: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly placeId?: string;
};

type DroppedPin = { readonly lat: number; readonly lng: number };

export function droppedPinKey(pin: DroppedPin): string {
  return `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
}

/** A catalog placeId means the place card owns the route. A dismissed key hides this pin until another one arrives. */
export function droppedPinCardVisible(input: { readonly pin: DroppedPin | null; readonly placeId: string | null; readonly dismissedKey: string | null }): boolean {
  if (input.pin === null || input.placeId !== null) return false;
  return input.dismissedKey !== droppedPinKey(input.pin);
}

export function droppedPinStop(pin: DroppedPin): MapRouteStop {
  return { kind: "pin", title: DROPPED_PIN_TITLE, latitude: pin.lat, longitude: pin.lng };
}

export function placeRouteStop(place: { readonly id?: string; readonly title: string; readonly latitude: number; readonly longitude: number }): MapRouteStop {
  if (place.id === undefined) return { kind: "place", title: place.title, latitude: place.latitude, longitude: place.longitude };
  return { kind: "place", title: place.title, latitude: place.latitude, longitude: place.longitude, placeId: place.id };
}

export function routeBarLabel(stop: MapRouteStop): string {
  switch (stop.kind) {
    case "pin":
      return "Маршрут до точки";
    case "place":
      return `Маршрут до ${stop.title}`;
    default: {
      const unreachable: never = stop.kind;
      return unreachable;
    }
  }
}
