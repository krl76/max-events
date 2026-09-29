import { useEffect, useRef, useState } from "react";

/** A grab-able thumb on the shell scroller. The native bar is hidden, and this one is wide enough to drag. */
export function ScrollRail() {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  const drag = useRef<{ y: number; scroll: number } | null>(null);

  useEffect(() => {
    const el = document.querySelector(".app-content");
    if (!(el instanceof HTMLElement)) return;
    const measure = () => {
      const overflow = el.scrollHeight - el.clientHeight;
      if (overflow < 48) {
        setBox(null);
        return;
      }
      const height = Math.max(56, (el.clientHeight / el.scrollHeight) * el.clientHeight);
      const top = (el.scrollTop / overflow) * (el.clientHeight - height);
      setBox({ top, height });
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);

  if (box === null) return null;
  return (
    <div className="app-scroll-rail" aria-hidden="true">
      <span
        className="app-scroll-rail-thumb"
        style={{ height: box.height, transform: `translateY(${box.top}px)` }}
        onPointerDown={(event) => {
          const el = document.querySelector(".app-content");
          if (!(el instanceof HTMLElement)) return;
          drag.current = { y: event.clientY, scroll: el.scrollTop };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          const el = document.querySelector(".app-content");
          if (start === null || !(el instanceof HTMLElement)) return;
          const overflow = el.scrollHeight - el.clientHeight;
          const travel = el.clientHeight - box.height;
          if (travel <= 0) return;
          el.scrollTop = Math.min(overflow, Math.max(0, start.scroll + ((event.clientY - start.y) / travel) * overflow));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
    </div>
  );
}
