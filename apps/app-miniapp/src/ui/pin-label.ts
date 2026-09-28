/** "55.75220, 37.61560" — coordinates kept so a dropped pin can reopen on the map. */
export function pinLabel(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/** Human address first, coordinates after the dot, so the screen can show the street and the map can still open. */
export function placePinLabel(address: string, latitude: number, longitude: number): string {
  const clean = address.trim();
  const coords = pinLabel(latitude, longitude);
  if (clean === "" || clean === coords) return coords;
  return `${clean} · ${coords}`;
}

const PIN_LABEL = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/;
const PIN_TAIL = /·\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/;

function pinPoint(latRaw: string, lngRaw: string): { lat: number; lng: number } | null {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** The coordinates inside a pin label, or null when the string is only a venue name. */
export function parsePinLabel(label: string): { lat: number; lng: number } | null {
  const trimmed = label.trim();
  const whole = PIN_LABEL.exec(trimmed);
  if (whole) return pinPoint(whole[1], whole[2]);
  const tail = PIN_TAIL.exec(trimmed);
  if (!tail) return null;
  return pinPoint(tail[1], tail[2]);
}

/** What a person reads: the street, or «Точка на карте» when only coordinates were stored. */
export function placePinTitle(label: string): string {
  const trimmed = label.trim();
  const point = parsePinLabel(trimmed);
  if (point === null) return trimmed;
  if (trimmed === pinLabel(point.lat, point.lng)) return "Точка на карте";
  return trimmed.replace(PIN_TAIL, "").trim();
}
