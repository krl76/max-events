import { afterEach, describe, expect, it, vi } from "vitest";
import { installBrowserWebAppShim } from "./browser-init-data";

describe("installBrowserWebAppShim", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does nothing when VITE_BROWSER_AUTH is off", async () => {
    vi.stubEnv("VITE_BROWSER_AUTH", "");
    vi.stubGlobal("window", { WebApp: undefined });
    vi.stubGlobal("fetch", vi.fn());
    expect(await installBrowserWebAppShim()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("installs window.WebApp from POST /api/auth/browser-initdata", async () => {
    vi.stubEnv("VITE_BROWSER_AUTH", "1");
    vi.stubGlobal("window", { WebApp: undefined });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ initData: "auth_date=1&hash=abc" }) })),
    );
    expect(await installBrowserWebAppShim()).toBe(true);
    expect(window.WebApp?.initData).toBe("auth_date=1&hash=abc");
    expect(window.WebApp?.platform).toBe("web");
  });

  it("leaves a real MAX WebApp untouched", async () => {
    vi.stubEnv("VITE_BROWSER_AUTH", "1");
    const real = { initData: "real" };
    vi.stubGlobal("window", { WebApp: real });
    vi.stubGlobal("fetch", vi.fn());
    expect(await installBrowserWebAppShim()).toBe(false);
    expect(window.WebApp).toBe(real);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns false when the endpoint is disabled", async () => {
    vi.stubEnv("VITE_BROWSER_AUTH", "1");
    vi.stubGlobal("window", { WebApp: undefined });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await installBrowserWebAppShim()).toBe(false);
    expect(window.WebApp).toBeUndefined();
  });
});
