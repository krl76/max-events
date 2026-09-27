/** A real photograph for a card. A stored cover wins; otherwise a stable photo for this id, not a flat color. */
export function pictured(id: string, coverUrl?: string | null): string {
  if (coverUrl) return coverUrl;
  return `https://picsum.photos/seed/maxevents-${encodeURIComponent(id)}/800/1066`;
}
