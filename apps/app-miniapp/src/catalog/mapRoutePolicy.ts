// START_MODULE_CONTRACT
// PURPOSE: Which OSM graph a map path should follow: footways for walks and «Дойти куда-то», roads and transit to reach an event.
// SCOPE: Pure policy over travel tiles. Geometry lives in ./walkingRoute.ts and ./metroRoute.ts.
// DEPENDS: ../api/endpoints/catalog.js (TravelOption)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MapRouteIntent - why the path is drawn: event, city walk, or arrive on foot
// - MapRouteProfile - OSM/metro profile the line is built with
// - mapRouteProfileFor - default profile for an intent, honouring the fastest tile for events
// - searchFeatureRouteIntent - how each of the nine search doors reaches the map
// END_MODULE_MAP

import type { TravelOption } from "../api/endpoints/catalog";

export type MapRouteIntent = "event" | "walk" | "arrive-on-foot";
export type MapRouteProfile = "foot" | "driving" | "metro";

/**
 * Search screen doors (экран 08) and the path they ask the map for.
 * Ask / swipe / micro / upcoming open an event, then the event map uses «event».
 * «На карте» is the map itself. «Куда пойдём?» and «Рядом» open a place with drawRoute = event.
 * «Маршрут на день» keeps its own walk/metro/taxi legs. «Прогулка» is always foot.
 */
export const SEARCH_FEATURE_ROUTE_INTENT = {
  ask: "event",
  swipe: "event",
  map: "event",
  whereto: "event",
  nearby: "event",
  micro: "event",
  route: "event",
  walk: "walk",
  soon: "event",
} as const satisfies Record<string, MapRouteIntent>;

export function searchFeatureRouteIntent(feature: keyof typeof SEARCH_FEATURE_ROUTE_INTENT): MapRouteIntent {
  return SEARCH_FEATURE_ROUTE_INTENT[feature];
}

/** Events pick the fastest road or metro tile; walks and a dropped pin stay on the foot graph. */
export function mapRouteProfileFor(intent: MapRouteIntent, options: readonly TravelOption[]): MapRouteProfile {
  if (intent === "walk" || intent === "arrive-on-foot") return "foot";
  if (options.length === 0) return "driving";
  const metro = options.find((item) => item.mode === "metro");
  const car = options.find((item) => item.mode === "car");
  if (metro !== undefined && car !== undefined) return metro.minutes <= car.minutes ? "metro" : "driving";
  if (metro !== undefined) return "metro";
  if (car !== undefined) return "driving";
  return "foot";
}

export function intentForStopKind(kind: "pin" | "place"): MapRouteIntent {
  return kind === "pin" ? "arrive-on-foot" : "event";
}
