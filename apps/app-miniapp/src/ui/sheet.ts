import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

/** Drag a bottom sheet down. Past a short pull it closes; a tap on the scrim is the caller's job. */
export function useSheetSwipe(onClose: () => void): {
  style: CSSProperties;
  grab: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
} {
  const [y, setY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const origin = useRef<number | null>(null);
  const latest = useRef(0);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, input, textarea, a")) return;
    origin.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (origin.current === null) return;
    const next = Math.max(0, event.clientY - origin.current);
    latest.current = next;
    setY(next);
  };
  const finish = () => {
    if (origin.current === null) return;
    origin.current = null;
    setDragging(false);
    if (latest.current > 80) onClose();
    latest.current = 0;
    setY(0);
  };

  const grab = { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish };
  return {
    style: { transform: `translateY(${y}px)`, transition: dragging ? "none" : "transform 220ms ease" },
    grab,
  };
}
