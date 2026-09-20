import { useEffect, useRef, type RefObject } from "react";

export function useLeafletMap(active: boolean, init: (container: HTMLElement) => Promise<() => void>, deps: unknown[]): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active || containerRef.current === null) return;
    let disposed = false;
    let dispose: (() => void) | null = null;
    init(containerRef.current).then((created) => {
      if (disposed) created();
      else dispose = created;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }, deps);

  return containerRef;
}
