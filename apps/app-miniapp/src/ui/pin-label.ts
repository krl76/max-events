/** "55.75220, 37.61560" — the string a dropped pin stores on a post, plan or micro-event. */
export function pinLabel(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

const PIN_LABEL = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/;

/** The coordinates inside a pin label, or null when the string is a venue name. */
export function parsePinLabel(label: string): { lat: number; lng: number } | null {
  const match = PIN_LABEL.exec(label.trim());
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
