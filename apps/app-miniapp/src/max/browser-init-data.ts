// START_MODULE_CONTRACT
// PURPOSE: Production-build WebApp shim for the staging host that talks to the live backend without the MAX client.
// SCOPE: POST /api/auth/browser-initdata when VITE_BROWSER_AUTH=1 and window.WebApp is absent; no-op otherwise.
// DEPENDS: ./bridge (MaxWebApp)
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - installBrowserWebAppShim - fetch signed initData and install window.WebApp
// END_MODULE_MAP

import type { MaxWebApp } from "./bridge";

export async function installBrowserWebAppShim(): Promise<boolean> {
  if (import.meta.env.VITE_BROWSER_AUTH !== "1") return false;
  if (typeof window === "undefined" || window.WebApp?.initData) return false;
  try {
    const response = await fetch("/api/auth/browser-initdata", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    const initData = body && typeof body === "object" && "initData" in body ? (body as { initData: unknown }).initData : null;
    if (typeof initData !== "string" || initData.length === 0) return false;
    const shim: MaxWebApp = {
      platform: "web",
      version: "browser-auth",
      initData,
      initDataUnsafe: {},
      ready() {},
      openLink() {},
      openMaxLink() {},
      close() {},
    };
    window.WebApp = shim;
    return true;
  } catch {
    return false;
  }
}
