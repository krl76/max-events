import type { ReactNode } from "react";

function arcPath(cx: number, cy: number, radius: number, startDeg: number, sweepDeg: number): string {
  const start = (Math.PI / 180) * startDeg;
  const end = (Math.PI / 180) * (startDeg + Math.max(sweepDeg, 0.01));
  const x1 = cx + radius * Math.cos(start);
  const y1 = cy + radius * Math.sin(start);
  const x2 = cx + radius * Math.cos(end);
  const y2 = cy + radius * Math.sin(end);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

/** One closed ring, or equal arcs with a gap. A single 360° arc is invalid in SVG and draws only a dot. */
function ringMarks(count: number, unseenShown: number): Array<{ d: string; fresh: boolean }> {
  if (count <= 1) {
    return [{ d: "M 40 6 A 34 34 0 1 1 39.99 6", fresh: unseenShown > 0 }];
  }
  const gap = 16;
  const sweep = (360 - gap * count) / count;
  return Array.from({ length: count }, (_, index) => ({
    d: arcPath(40, 40, 34, -90 + index * (sweep + gap), sweep),
    fresh: index >= count - unseenShown,
  }));
}

/** Segmented ring around an avatar. Each segment is one story: brand blue while unseen, pale once watched. */
export function StoryRing({ total, unseen, label, children }: { total: number; unseen: number; label: string; children: ReactNode }) {
  const count = Math.max(1, Math.min(total, 16));
  const unseenShown = total <= 0 ? 0 : Math.min(count, Math.round((Math.min(Math.max(unseen, 0), total) / total) * count));
  const hot = unseen > 0;
  return (
    <span className={hot ? "app-tg-ring app-tg-ring--new" : "app-tg-ring app-tg-ring--seen"} aria-label={label}>
      <svg className="app-tg-ring-svg" viewBox="0 0 80 80" aria-hidden="true">
        {ringMarks(count, unseenShown).map((mark, index) => (
          <path key={index} d={mark.d} fill="none" stroke={mark.fresh ? "#007aff" : "#479fff"} strokeWidth="5" strokeLinecap="round" />
        ))}
      </svg>
      <span className="app-tg-ring-face">{children}</span>
    </span>
  );
}
