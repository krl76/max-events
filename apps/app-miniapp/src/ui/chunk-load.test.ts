/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { installChunkLoadRecovery, isStaleChunkError, loadLazyModule, recoverFromStaleChunk } from "./chunk-load";

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

describe("isStaleChunkError", () => {
  it("recognises a missing Vite chunk after rsync --delete", () => {
    expect(isStaleChunkError(new Error("Failed to fetch dynamically imported module: https://events.versacegus.cc/assets/ProfilePage-abc.js"))).toBe(true);
    expect(isStaleChunkError(new TypeError("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isStaleChunkError(new Error("Unable to preload CSS for /assets/style-abc.css"))).toBe(true);
    expect(isStaleChunkError(new SyntaxError("Unexpected token '<'"))).toBe(true);
    expect(isStaleChunkError(new Error("Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of \"text/html\""))).toBe(true);
    expect(isStaleChunkError(new Error("profile is not a component"))).toBe(false);
    expect(isStaleChunkError(new Error("Cannot read properties of null"))).toBe(false);
  });
});

describe("recoverFromStaleChunk", () => {
  it("reloads once and refuses another reload inside the cooldown", () => {
    const reload = vi.fn();

    expect(recoverFromStaleChunk(reload)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(recoverFromStaleChunk(reload)).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe("installChunkLoadRecovery", () => {
  it("reloads on vite:preloadError and stops the throw", () => {
    const recover = vi.fn(() => true);
    const stop = installChunkLoadRecovery(window, recover);
    const event = new Event("vite:preloadError", { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(recover).toHaveBeenCalledOnce();
    stop();
  });
});

describe("loadLazyModule", () => {
  it("retries a stale chunk once, then picks the named export", async () => {
    vi.useFakeTimers();
    const load = vi
      .fn<() => Promise<{ Screen: () => null }>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch dynamically imported module"))
      .mockResolvedValueOnce({ Screen: () => null });

    const pending = loadLazyModule(load, "Screen");
    await vi.advanceTimersByTimeAsync(300);
    const loaded = await pending;

    expect(load).toHaveBeenCalledTimes(2);
    expect(typeof loaded.default).toBe("function");
  });

  it("throws when the named export is missing", async () => {
    await expect(loadLazyModule(async () => ({ Other: () => null }) as Record<string, unknown>, "Screen")).rejects.toThrow("Screen is not a component");
  });
});
