import { afterEach, describe, expect, it, vi } from "vitest";
import { DEV_INIT_DATA_STORAGE_KEY, installDevWebAppShim, isInitDataShimAllowed, parseInitDataUnsafe } from "./dev-init-data";

function stubWindow(options: { search?: string; href?: string; hostname?: string; stored?: string | null; webApp?: unknown } = {}) {
  const search = options.search ?? "";
  const hostname = options.hostname ?? "dev.events.versacegus.cc";
  const href = options.href ?? `https://${hostname}/${search}`;
  const stored = options.stored ?? null;
  const webApp = options.webApp;
  const setItem = vi.fn();
  const removeItem = vi.fn();
  const replaceState = vi.fn();
  vi.stubGlobal("window", {
    location: { search, href, hostname, pathname: "/", hash: "" },
    history: { replaceState },
    localStorage: { getItem: vi.fn(() => stored), setItem, removeItem },
    WebApp: webApp,
    open: vi.fn(),
  });
  return { setItem, removeItem, replaceState };
}

describe("isInitDataShimAllowed", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("allows the isolated dev host even in a production build", () => {
    vi.stubEnv("DEV", false);
    stubWindow({ hostname: "dev.events.versacegus.cc" });
    expect(isInitDataShimAllowed()).toBe(true);
  });

  it("rejects an unknown production host", () => {
    vi.stubEnv("DEV", false);
    stubWindow({ hostname: "evil.example" });
    expect(isInitDataShimAllowed()).toBe(false);
  });

  it("allows the production host for signed ?initData= (mint endpoint stays off)", () => {
    vi.stubEnv("DEV", false);
    stubWindow({ hostname: "events.versacegus.cc" });
    expect(isInitDataShimAllowed()).toBe(true);
  });
});

describe("parseInitDataUnsafe", () => {
  it("reads the user JSON and start_param", () => {
    const initData = `user=${encodeURIComponent(JSON.stringify({ id: 42, first_name: "Ann" }))}&start_param=event-1&auth_date=100`;
    expect(parseInitDataUnsafe(initData)).toEqual({ user: { id: 42, first_name: "Ann" }, start_param: "event-1", auth_date: 100 });
  });
});

describe("installDevWebAppShim", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does nothing on an unknown host outside DEV", () => {
    vi.stubEnv("DEV", false);
    const { setItem } = stubWindow({ search: "?initData=signed", hostname: "evil.example", href: "https://evil.example/?initData=signed" });

    expect(installDevWebAppShim()).toBe(false);
    expect(window.WebApp).toBeUndefined();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("installs window.WebApp from the ?initData= query param and persists it", () => {
    const { setItem, replaceState } = stubWindow({ search: "?initData=signed-data", href: "https://dev.events.versacegus.cc/?initData=signed-data" });

    expect(installDevWebAppShim()).toBe(true);
    expect(window.WebApp?.initData).toBe("signed-data");
    expect(window.WebApp?.platform).toBe("web");
    expect(setItem).toHaveBeenCalledWith(DEV_INIT_DATA_STORAGE_KEY, "signed-data");
    expect(replaceState).toHaveBeenCalled();
  });

  it("falls back to localStorage when the query param is absent", () => {
    const { setItem } = stubWindow({ stored: "stored-data" });

    expect(installDevWebAppShim()).toBe(true);
    expect(window.WebApp?.initData).toBe("stored-data");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("does not clobber a real MAX session that already has initData", () => {
    const real = { initData: "real", initDataUnsafe: {} };
    stubWindow({ search: "?initData=signed-data", webApp: real });

    expect(installDevWebAppShim()).toBe(false);
    expect(window.WebApp).toBe(real);
  });

  it("replaces a getter-only official WebApp so signed initData is readable", () => {
    const official = {
      get initData() {
        return "";
      },
      initDataUnsafe: {},
      ready() {},
      openLink() {},
      openMaxLink() {},
      close() {},
    };
    stubWindow({ search: "?initData=user%3D%7B%22id%22%3A1%2C%22first_name%22%3A%22A%22%7D", webApp: official });

    expect(installDevWebAppShim()).toBe(true);
    expect(window.WebApp).not.toBe(official);
    expect(window.WebApp?.initData).toContain("user=");
    expect(window.WebApp?.initDataUnsafe.user).toEqual({ id: 1, first_name: "A" });
  });

  it("clears a stored contour", () => {
    const { removeItem } = stubWindow({ search: "?clearInitData=1", stored: "stored-data" });

    expect(installDevWebAppShim()).toBe(false);
    expect(removeItem).toHaveBeenCalledWith(DEV_INIT_DATA_STORAGE_KEY);
  });

  it("does nothing when no initData is available", () => {
    stubWindow();

    expect(installDevWebAppShim()).toBe(false);
    expect(window.WebApp).toBeUndefined();
  });
});
