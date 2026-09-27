/** A real photograph for a card. A stored cover wins; otherwise a stable photo for this id, not a flat color. */
export function pictured(id: string, coverUrl?: string | null): string {
  if (coverUrl) return coverUrl;
  return `https://picsum.photos/seed/maxevents-${encodeURIComponent(id)}/800/1066`;
}

/** «занято 12 из 30». Absent when the event has no capacity, so an unlimited event does not invent a fill. */
export function eventFillLabel(event: { capacity?: number | null; bookedCount?: number | null; remainingSeats?: number | null }): string | null {
  const capacity = event.capacity;
  if (capacity == null) return null;
  const booked = event.bookedCount ?? (event.remainingSeats != null ? Math.max(0, capacity - event.remainingSeats) : null);
  if (booked == null) return null;
  return `занято ${booked} из ${capacity}`;
}
