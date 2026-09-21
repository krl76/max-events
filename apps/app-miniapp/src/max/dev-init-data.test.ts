import { afterEach, describe, expect, it, vi } from "vitest";
import { DEV_INIT_DATA_STORAGE_KEY, installDevWebAppShim } from "./dev-init-data";

function stubWindow({ search = "", stored = null as string | null, webApp = undefined as unknown } = {}) {
  const setItem = vi.fn();
  vi.stubGlobal("window", {
    location: { search },
    localStorage: { getItem: vi.fn(() => stored), setItem },
    WebApp: webApp,
  });
  return { setItem };
}

describe("installDevWebAppShim", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does nothing outside DEV", () => {
    vi.stubEnv("DEV", false);
    const { setItem } = stubWindow({ search: "?initData=signed" });

    expect(installDevWebAppShim()).toBe(false);
    expect(window.WebApp).toBeUndefined();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("installs window.WebApp from the ?initData= query param and persists it", () => {
    const { setItem } = stubWindow({ search: "?initData=signed-data" });

    expect(installDevWebAppShim()).toBe(true);
    expect(window.WebApp?.initData).toBe("signed-data");
    expect(window.WebApp?.platform).toBe("web");
    expect(setItem).toHaveBeenCalledWith(DEV_INIT_DATA_STORAGE_KEY, "signed-data");
  });

  it("falls back to localStorage when the query param is absent", () => {
    const { setItem } = stubWindow({ stored: "stored-data" });

    expect(installDevWebAppShim()).toBe(true);
    expect(window.WebApp?.initData).toBe("stored-data");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("does not shim when a real window.WebApp is already present", () => {
    const real = { initData: "real" };
    stubWindow({ search: "?initData=signed-data", webApp: real });

    expect(installDevWebAppShim()).toBe(false);
    expect(window.WebApp).toBe(real);
  });

  it("does nothing when no initData is available", () => {
    stubWindow();

    expect(installDevWebAppShim()).toBe(false);
    expect(window.WebApp).toBeUndefined();
  });
});
