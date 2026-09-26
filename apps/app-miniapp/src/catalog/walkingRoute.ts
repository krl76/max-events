// START_MODULE_CONTRACT
// PURPOSE: Walking geometry from the viewer to a map pin, via public OSRM. Falls back to a straight line when the router is unreachable.
// SCOPE: One origin-destination pair; lat/lng tuples in Leaflet order.
// DEPENDS: fetch
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - walkingRoute - OSRM foot geometry, or the two endpoints when the router fails
// END_MODULE_MAP

export async function walkingRoute(from: [number, number], to: [number, number], fetchImpl: typeof fetch = fetch): Promise<[number, number][]> {
  const straight: [number, number][] = [from, to];
  const url = `https://router.project-osrm.org/route/v1/foot/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return straight;
    const body = (await response.json()) as { routes?: Array<{ geometry?: { coordinates?: number[][] } }> };
    const coords = body.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return straight;
    const path: [number, number][] = [];
    for (const pair of coords) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const lng = pair[0];
      const lat = pair[1];
      if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      path.push([lat, lng]);
    }
    return path.length >= 2 ? path : straight;
  } catch {
    return straight;
  }
}
