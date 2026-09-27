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

/** Segmented ring around an avatar. Each segment is one story: brand blue while unseen, gray once watched. */
export function StoryRing({ total, unseen, label, children }: { total: number; unseen: number; label: string; children: ReactNode }) {
  const count = Math.max(1, Math.min(total, 16));
  const unseenShown = total <= 0 ? 0 : Math.min(count, Math.round((Math.min(Math.max(unseen, 0), total) / total) * count));
  const gap = count === 1 ? 0 : 16;
  const sweep = (360 - gap * count) / count;
  const hot = unseen > 0;
  return (
    <span className={hot ? "app-story-ring app-story-ring--active app-story-ring-wrap" : "app-story-ring app-story-ring--seen app-story-ring-wrap"} aria-label={label}>
      <svg className="app-story-ring-svg" viewBox="0 0 72 72" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => {
          const start = -90 + index * (sweep + gap);
          const fresh = index >= count - unseenShown;
          return <path key={start} d={arcPath(36, 36, 32, start, sweep)} className={fresh ? "app-story-arc app-story-arc--new" : "app-story-arc app-story-arc--seen"} />;
        })}
      </svg>
      <span className="app-story-ring-face">{children}</span>
    </span>
  );
}
