const RELOAD_AT_KEY = "afisha-chunk-reload-at";
const RELOAD_COOLDOWN_MS = 15_000;

const STALE_CHUNK = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading chunk|Loading CSS chunk|Failed to load module script|Expected a JavaScript-or-Wasm module script|is not a valid JavaScript MIME type|Unexpected token '<'/i;

export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return STALE_CHUNK.test(message);
}

/** Reload once after a deploy left the webview holding hashes that rsync --delete already removed. */
export function recoverFromStaleChunk(reload: () => void = () => window.location.reload()): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  try {
    const previous = Number(sessionStorage.getItem(RELOAD_AT_KEY));
    if (Number.isFinite(previous) && now - previous < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_AT_KEY, String(now));
  } catch {
    // Private mode can throw; still reload — a loop is worse than a missing guard.
  }
  reload();
  return true;
}

export function installChunkLoadRecovery(target: Window = window, recover: () => boolean = recoverFromStaleChunk): () => void {
  const onPreloadError = (event: Event) => {
    event.preventDefault();
    recover();
  };
  target.addEventListener("vite:preloadError", onPreloadError);
  return () => target.removeEventListener("vite:preloadError", onPreloadError);
}

export async function loadLazyModule<T extends Record<string, unknown>>(load: () => Promise<T>, key: keyof T): Promise<{ default: T[keyof T] }> {
  let mod: T;
  try {
    mod = await load();
  } catch (error) {
    if (!isStaleChunkError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 300));
    mod = await load();
  }
  const exported = mod[key];
  if (typeof exported !== "function") {
    throw new Error(`${String(key)} is not a component`);
  }
  return { default: exported };
}
