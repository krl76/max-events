// START_MODULE_CONTRACT
// PURPOSE: Great-circle distance helpers without Nest providers, so catalog/nearby/routes do not import each other.
// SCOPE: haversineKm and haversineMeters. No TypeORM, no injectables.
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - haversineKm - kilometres between two WGS84 points
// - haversineMeters - rounded metres from an origin to a point
// END_MODULE_MAP

const EARTH_KM = 6371;
const EARTH_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number, radius: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversine(lat1, lon1, lat2, lon2, EARTH_KM);
}

export function haversineMeters(from: { latitude: number; longitude: number }, latitude: number, longitude: number): number {
  return Math.max(0, Math.round(haversine(from.latitude, from.longitude, latitude, longitude, EARTH_M)));
}
