// START_MODULE_CONTRACT
// PURPOSE: Remember a screen's scroll so leaving it and coming back lands on the same place.
// SCOPE: In-memory positions for the session; the shell scroller is .app-content.
// DEPENDS: none
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

const positions = new Map<string, number>();
const frozen = new Map<string, number>();
const applied = new Map<string, number>();

export function routeScrollKey(name: string, id?: string): string {
  return id === undefined ? name : `${name}:${id}`;
}

export function rememberScroll(key: string, top: number): void {
  positions.set(key, top);
}

export function freezeScroll(key: string, top: number): void {
  positions.set(key, top);
  frozen.set(key, top);
}

/** The position captured when this screen was last left, then forgotten so a later visit starts fresh. */
export function consumeFrozenScroll(key: string): number | undefined {
  const top = frozen.get(key);
  frozen.delete(key);
  return top;
}

export function noteAppliedScroll(key: string, top: number): void {
  applied.set(key, top);
}

/** Put the screen back where it was after its content has finished loading. */
export function replayScroll(key: string): void {
  const top = applied.get(key);
  if (top === undefined) return;
  const el = document.querySelector(".app-content");
  if (el instanceof HTMLElement) el.scrollTop = top;
}

/** The position to restore: frozen on the way out, otherwise the last one this screen applied. */
export function savedScroll(key: string): number | undefined {
  return frozen.get(key) ?? applied.get(key) ?? positions.get(key);
}
