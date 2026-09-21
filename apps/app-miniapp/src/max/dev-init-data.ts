// START_MODULE_CONTRACT
// PURPOSE: Dev-only window.WebApp shim so the miniapp runs in live mode (no VITE_USE_MOCK) from a plain browser against the real backend.
// SCOPE: Reads signed initData from the ?initData= query param (persisted to localStorage) or from localStorage, installs a minimal window.WebApp when the real MAX bridge is absent. Dead code in prod builds (import.meta.env.DEV gate).
// DEPENDS: ./bridge (MaxWebApp type), tools/dev-initdata.mjs generates the signed initData
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY, https://dev.max.ru/docs/webapps/validation
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DEV_INIT_DATA_STORAGE_KEY - localStorage key where query initData is persisted across reloads
// - installDevWebAppShim - install a minimal window.WebApp from query/localStorage initData; no-op outside DEV or inside the MAX client
// END_MODULE_MAP

import type { MaxWebApp } from "./bridge";

export const DEV_INIT_DATA_STORAGE_KEY = "max-events-dev-initdata";

function readDevInitData(): string | null {
  const fromQuery = new URLSearchParams(window.location.search).get("initData");
  if (fromQuery) {
    window.localStorage.setItem(DEV_INIT_DATA_STORAGE_KEY, fromQuery);
    return fromQuery;
  }
  return window.localStorage.getItem(DEV_INIT_DATA_STORAGE_KEY);
}

/** Install a minimal window.WebApp for local dev. Returns true when the shim was installed. */
export function installDevWebAppShim(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === "undefined" || window.WebApp) return false;
  const initData = readDevInitData();
  if (!initData) return false;
  const shim: MaxWebApp = {
    platform: "web",
    version: "dev",
    initData,
    initDataUnsafe: {},
    ready() {},
    openLink() {},
    openMaxLink() {},
    close() {},
  };
  window.WebApp = shim;
  return true;
}

// Side effect on import: main.tsx imports this module first, before ./bridge reads window.WebApp.
if (import.meta.env.DEV) installDevWebAppShim();
