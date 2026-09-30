const PICSUM = /https?:\/\/(?:i\.|images\.)?picsum\.photos\/seed\/([^/?#]+)(?:\/(\d+)\/(\d+))?/i;
const UPLOAD = /^(?:https?:\/\/[^/]+)?(\/api\/uploads\/[0-9a-f-]{36})\/?$/i;

/**
 * Picsum is blocked inside the MAX phone webview. The same bytes are served from our origin,
 * so a stored picsum URL and a generated fallback both paint. Uploaded files stored with an
 * absolute host (Docker Host header, public hostname) are rewritten to the same-origin path.
 */
export function showPhoto(url: string | null | undefined): string | null {
  if (url == null || url.trim() === "") return null;
  const trimmed = url.trim();
  const upload = UPLOAD.exec(trimmed);
  if (upload) return upload[1];
  const match = PICSUM.exec(trimmed);
  if (!match) return trimmed;
  const width = match[2] ?? "800";
  const height = match[3] ?? "1066";
  return `/api/media/seed/${encodeURIComponent(decodeURIComponent(match[1]))}?w=${width}&h=${height}`;
}

/** A real photograph for a card. A stored cover wins; otherwise a stable photo for this id, not a flat color. */
export function pictured(id: string, coverUrl?: string | null): string {
  return showPhoto(coverUrl) ?? showPhoto(`https://picsum.photos/seed/maxevents-${encodeURIComponent(id)}/800/1066`)!;
}

/** «занято 12 из 30». Absent when the event has no capacity, so an unlimited event does not invent a fill. */
export function eventFillLabel(event: { capacity?: number | null; bookedCount?: number | null; remainingSeats?: number | null }): string | null {
  const capacity = event.capacity;
  if (capacity == null) return null;
  const booked = event.bookedCount ?? (event.remainingSeats != null ? Math.max(0, capacity - event.remainingSeats) : null);
  if (booked == null) return null;
  return `занято ${booked} из ${capacity}`;
}
