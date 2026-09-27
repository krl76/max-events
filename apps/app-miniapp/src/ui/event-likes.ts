import { useSyncExternalStore } from "react";

const KEY = "max-events:event-likes";

function readLikes(): Record<string, true> {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw === null ? {} : JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return {};
    return parsed as Record<string, true>;
  } catch {
    return {};
  }
}

let likes = readLikes();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function toggleEventLike(id: string): void {
  const next = { ...likes };
  if (next[id]) delete next[id];
  else next[id] = true;
  likes = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A private window still toggles the heart for this visit.
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useEventLiked(id: string): boolean {
  const current = useSyncExternalStore(
    subscribe,
    () => likes,
    () => likes,
  );
  return current[id] === true;
}
