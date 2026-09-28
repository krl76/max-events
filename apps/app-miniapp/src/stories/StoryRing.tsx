import type { ReactNode } from "react";

/**
 * One solid ring around the whole avatar. How many stories a person has does not slice it:
 * any unseen story keeps the brand gradient, and a fully watched author goes gray.
 * An SVG arc cannot close a circle (a 360° path draws only a dot), so the ring is the padding of this box.
 */
export function StoryRing({ total, unseen, label, children }: { total: number; unseen: number; label: string; children: ReactNode }) {
  const hot = total > 0 && unseen > 0;
  return (
    <span className={hot ? "app-tg-ring app-tg-ring--new" : "app-tg-ring app-tg-ring--seen"} aria-label={label}>
      <span className="app-tg-ring-face">{children}</span>
    </span>
  );
}
