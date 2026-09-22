// START_MODULE_CONTRACT
// PURPOSE: Production-build WebApp shim for the staging host that talks to the live backend without the MAX client.
// SCOPE: POST /api/auth/browser-initdata when VITE_BROWSER_AUTH=1 and a real MAX session (non-empty initData) is absent. Replaces the official empty WebApp from st.max.ru (initData is getter-only).
// DEPENDS: ./bridge (MaxWebApp)
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - installBrowserWebAppShim - fetch signed initData and install window.WebApp
// END_MODULE_MAP

import type { MaxWebApp } from "./bridge";
import { parseInitDataUnsafe } from "./dev-init-data";

export async function installBrowserWebAppShim(): Promise<boolean> {
  if (import.meta.env.VITE_BROWSER_AUTH !== "1") return false;
  if (typeof window === "undefined" || window.WebApp?.initData) return false;
  try {
    const response = await fetch("/api/auth/browser-initdata", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    const initData = body && typeof body === "object" && "initData" in body ? (body as { initData: unknown }).initData : null;
    if (typeof initData !== "string" || initData.length === 0) return false;
    const unsafe = parseInitDataUnsafe(initData);
    // Official max-web-app.js always assigns window.WebApp; initData is a getter
    // with no setter, so writing onto that object throws and leaves initData empty.
    window.WebApp = {
      platform: "web",
      version: "browser-auth",
      initData,
      initDataUnsafe: unsafe,
      ready() {},
      openLink(url: string) {
        window.open(url, "_blank", "noopener,noreferrer");
      },
      openMaxLink(url: string) {
        window.open(url, "_blank", "noopener,noreferrer");
      },
      close() {},
    };
    return true;
  } catch {
    return false;
  }
}
