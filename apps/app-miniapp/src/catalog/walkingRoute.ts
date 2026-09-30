// START_MODULE_CONTRACT
// PURPOSE: OSM path geometry from the viewer to a map pin via public OSRM. Foot uses pedestrian ways; driving uses the car graph. Falls back to a straight line when the router is unreachable.
// SCOPE: One origin-destination pair; lat/lng tuples in Leaflet order. Transit drawing lives in ./metroRoute.ts.
// DEPENDS: fetch
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OsrmProfile - foot (walks, «Дойти куда-то») or driving (roads to an event)
// - OsrmTrip - geometry plus whole minutes from the OSRM duration
// - osrmTrip - OSRM geometry and minutes for a profile, or a straight line when the router fails
// - osrmRoute - path only
// - walkingRoute - OSRM foot geometry
// - drivingRoute - OSRM car-road geometry
// - stitchWalkingTrip - foot geometry and minutes through every stop
// - stitchWalkingRoute - path only of stitchWalkingTrip
// END_MODULE_MAP

export type OsrmProfile = "foot" | "driving";

export interface OsrmTrip {
  path: [number, number][];
  /** OSRM duration in whole minutes; 1 when the router answered a sub-minute hop. */
  minutes: number;
}

function minutesFromDuration(seconds: unknown): number | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  return Math.max(1, Math.round(seconds / 60));
}

export async function osrmTrip(from: [number, number], to: [number, number], profile: OsrmProfile = "foot", fetchImpl: typeof fetch = fetch): Promise<OsrmTrip> {
  const straight: OsrmTrip = { path: [from, to], minutes: 1 };
  const url = `https://router.project-osrm.org/route/v1/${profile}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return straight;
    const body = (await response.json()) as { routes?: Array<{ duration?: number; geometry?: { coordinates?: number[][] } }> };
    const route = body.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return straight;
    const path: [number, number][] = [];
    for (const pair of coords) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const lng = pair[0];
      const lat = pair[1];
      if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      path.push([lat, lng]);
    }
    if (path.length < 2) return straight;
    return { path, minutes: minutesFromDuration(route?.duration) ?? 1 };
  } catch {
    return straight;
  }
}

export async function osrmRoute(from: [number, number], to: [number, number], profile: OsrmProfile = "foot", fetchImpl: typeof fetch = fetch): Promise<[number, number][]> {
  return (await osrmTrip(from, to, profile, fetchImpl)).path;
}

export async function walkingRoute(from: [number, number], to: [number, number], fetchImpl: typeof fetch = fetch): Promise<[number, number][]> {
  return osrmRoute(from, to, "foot", fetchImpl);
}

export async function drivingRoute(from: [number, number], to: [number, number], fetchImpl: typeof fetch = fetch): Promise<[number, number][]> {
  return osrmRoute(from, to, "driving", fetchImpl);
}

/** Foot geometry through every stop, in order. A failed leg stays a straight segment so the line still joins the steps. */
export async function stitchWalkingTrip(stops: readonly [number, number][], fetchImpl: typeof fetch = fetch): Promise<OsrmTrip> {
  const straight = stops.map((point) => [point[0], point[1]] as [number, number]);
  if (stops.length < 2) return { path: straight, minutes: 1 };
  const joined: [number, number][] = [];
  let minutes = 0;
  for (let index = 1; index < stops.length; index += 1) {
    const from = stops[index - 1];
    const to = stops[index];
    if (from === undefined || to === undefined) continue;
    const trip = await osrmTrip(from, to, "foot", fetchImpl);
    minutes += trip.minutes;
    if (joined.length === 0) joined.push(...trip.path);
    else joined.push(...trip.path.slice(1));
  }
  return { path: joined.length >= 2 ? joined : straight, minutes: Math.max(1, minutes) };
}

export async function stitchWalkingRoute(stops: readonly [number, number][], fetchImpl: typeof fetch = fetch): Promise<[number, number][]> {
  return (await stitchWalkingTrip(stops, fetchImpl)).path;
}
