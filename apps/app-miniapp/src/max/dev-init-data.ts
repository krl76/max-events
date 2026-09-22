// START_MODULE_CONTRACT
// PURPOSE: Browser MAX-contour shim: signed initData as window.WebApp so the miniapp can run outside the MAX client against a real backend (HMAC still verified server-side).
// SCOPE: ?initData= (persisted in localStorage) or stored value; overlays empty official WebApp from st.max.ru; no-op on unknown hosts, inside a real MAX session, or when ?clearInitData=1. Allowed on DEV, VITE_ALLOW_INITDATA_SHIM=1, or INITDATA_SHIM_HOSTS. Public mint (POST /auth/browser-initdata) stays off on events.versacegus.cc; signed ?initData= is for agents/devs who have the bot token.
// DEPENDS: ./bridge (MaxWebApp type), tools/dev-initdata.mjs generates the signed initData
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY, https://dev.max.ru/docs/webapps/validation
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DEV_INIT_DATA_STORAGE_KEY - localStorage key where query initData is persisted across reloads
// - INITDATA_SHIM_HOSTS - hostnames that may install the signed ?initData= shim
// - isInitDataShimAllowed - DEV / env flag / allowlisted hostname
// - parseInitDataUnsafe - user/start_param/auth_date from a signed initData query string
// - applySignedWebApp - replace window.WebApp (Bridge initData is a getter)
// - installDevWebAppShim - overlay signed initData onto window.WebApp
// END_MODULE_MAP

import type { MaxWebApp, MaxWebAppInitDataUnsafe } from "./bridge";

export const DEV_INIT_DATA_STORAGE_KEY = "max-events-dev-initdata";

export const INITDATA_SHIM_HOSTS: readonly string[] = ["localhost", "127.0.0.1", "dev.events.versacegus.cc", "events.versacegus.cc"];

export function isInitDataShimAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_ALLOW_INITDATA_SHIM === "1") return true;
  return INITDATA_SHIM_HOSTS.includes(window.location.hostname);
}

export function parseInitDataUnsafe(initData: string): MaxWebAppInitDataUnsafe {
  const params = new URLSearchParams(initData);
  const unsafe: MaxWebAppInitDataUnsafe = {};
  const userRaw = params.get("user");
  if (userRaw) {
    try {
      unsafe.user = JSON.parse(userRaw) as MaxWebAppInitDataUnsafe["user"];
    } catch {
      /* backend rejects a broken user payload; keep the shim so login can surface the error */
    }
  }
  const start = params.get("start_param");
  if (start) unsafe.start_param = start;
  const authDate = params.get("auth_date");
  if (authDate) unsafe.auth_date = Number(authDate);
  return unsafe;
}

function readDevInitData(): string | null {
  const search = new URLSearchParams(window.location.search);
  if (search.get("clearInitData") === "1") {
    window.localStorage.removeItem(DEV_INIT_DATA_STORAGE_KEY);
    stripInitDataQuery();
    return null;
  }
  const fromQuery = search.get("initData");
  if (fromQuery) {
    window.localStorage.setItem(DEV_INIT_DATA_STORAGE_KEY, fromQuery);
    stripInitDataQuery();
    return fromQuery;
  }
  return window.localStorage.getItem(DEV_INIT_DATA_STORAGE_KEY);
}

function stripInitDataQuery(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("initData") && !url.searchParams.has("clearInitData")) return;
    url.searchParams.delete("initData");
    url.searchParams.delete("clearInitData");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", next);
  } catch {
    /* history may be missing in tests */
  }
}

function emptyWebApp(): MaxWebApp {
  return {
    platform: "web",
    version: "dev",
    initData: "",
    initDataUnsafe: {},
    ready() {},
    openLink(url: string) {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    openMaxLink(url: string) {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    close() {},
  };
}

/** Replace window.WebApp. Official Bridge exposes initData as a getter with no setter. */
export function applySignedWebApp(initData: string): void {
  const previous = window.WebApp;
  const unsafe = parseInitDataUnsafe(initData);
  window.WebApp = {
    platform: previous?.platform || "web",
    version: previous?.version || "dev",
    initData,
    initDataUnsafe: unsafe,
    ready() {
      previous?.ready();
    },
    openLink(url: string) {
      if (previous) previous.openLink(url);
      else window.open(url, "_blank", "noopener,noreferrer");
    },
    openMaxLink(url: string) {
      if (previous) previous.openMaxLink(url);
      else window.open(url, "_blank", "noopener,noreferrer");
    },
    close() {
      previous?.close();
    },
    shareMaxContent: previous?.shareMaxContent?.bind(previous),
  };
}

/** Overlay signed initData onto window.WebApp. Returns true when the contour was applied. */
export function installDevWebAppShim(): boolean {
  if (!isInitDataShimAllowed()) return false;
  if (typeof window === "undefined") return false;
  // Official st.max.ru/js/max-web-app.js always assigns window.WebApp, even in a plain browser
  // with empty initData. Only a non-empty initData is a real MAX session — do not clobber it.
  if (window.WebApp?.initData) return false;
  const initData = readDevInitData();
  if (!initData) return false;
  applySignedWebApp(initData);
  return true;
}

// Side effect on import: main.tsx imports this module first, before ./bridge reads window.WebApp.
installDevWebAppShim();
