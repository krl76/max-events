export interface AddressParts {
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  city?: string;
  locality?: string;
}

export interface NearbyPlace {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
}

/** Street and city from a reverse-geocode payload. Empty when the payload has neither. */
export function addressLine(parts: AddressParts): string | null {
  const street = [parts.street, parts.housenumber].map((part) => part?.trim() ?? "").filter((part) => part !== "").join(", ");
  const area = (parts.district || parts.locality || parts.city || "").trim();
  const name = (parts.name ?? "").trim();
  const head = street !== "" ? street : name !== "" && name !== area ? name : "";
  const line = [head, area].filter((part, index, all) => part !== "" && all.indexOf(part) === index).join(", ");
  return line === "" ? null : line;
}

function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** A catalog place within a short walk, so a pin still gets a name when the geocoder is quiet. */
export function nearestPlaceName(places: readonly NearbyPlace[], latitude: number, longitude: number): string | null {
  let best: { name: string; km: number } | null = null;
  for (const place of places) {
    const km = kmBetween(latitude, longitude, place.latitude, place.longitude);
    if (km > 0.4 || (best !== null && km >= best.km)) continue;
    const name = place.address.trim() !== "" ? place.address : place.title;
    if (name.trim() === "") continue;
    best = { name, km };
  }
  return best?.name ?? null;
}

/** Reverse geocode. Null when the service is unreachable or has no street to offer. */
export async function addressAt(latitude: number, longitude: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=ru`, { signal: controller.signal });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const feature = (body as { features?: Array<{ properties?: AddressParts }> }).features?.[0]?.properties;
    return feature === undefined ? null : addressLine(feature);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveAddress(latitude: number, longitude: number, places: readonly NearbyPlace[]): Promise<string | null> {
  return (await addressAt(latitude, longitude)) ?? nearestPlaceName(places, latitude, longitude);
}