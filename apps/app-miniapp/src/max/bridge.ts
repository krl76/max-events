// START_MODULE_CONTRACT
// PURPOSE: Thin typed wrapper over MAX Bridge (window.WebApp), the only place touching the global.
// SCOPE: WebApp typing, nullable access outside the MAX client, start_param extraction, external link opening.
// DEPENDS: https://st.max.ru/js/max-web-app.js loaded by index.html
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY, https://dev.max.ru/docs/webapps/bridge
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MaxWebAppUser - user shape from initDataUnsafe
// - MaxWebAppInitDataUnsafe - untrusted launch params shape
// - MaxWebApp - window.WebApp interface
// - webApp - nullable WebApp instance (null outside MAX client)
// - getStartParam - extract start_param from initDataUnsafe
// - openExternalLink - open link via MAX or browser fallback
// END_MODULE_MAP

export interface MaxWebAppUser {
  id: number;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  language_code?: string;
  photo_url?: string | null;
}

export interface MaxWebAppInitDataUnsafe {
  user?: MaxWebAppUser;
  start_param?: string;
  auth_date?: number;
  hash?: string;
}

export interface MaxWebApp {
  platform: string;
  version: string;
  initData: string;
  initDataUnsafe: MaxWebAppInitDataUnsafe;
  ready(): void;
  openLink(url: string): void;
  openMaxLink(url: string): void;
  close(): void;
}

declare global {
  interface Window {
    WebApp?: MaxWebApp;
  }
}

/** null вне клиента MAX (обычный браузер при разработке). */
export const webApp: MaxWebApp | null = typeof window !== "undefined" ? (window.WebApp ?? null) : null;

export function getStartParam(app: Pick<MaxWebApp, "initDataUnsafe"> | null): string | null {
  return app?.initDataUnsafe.start_param ?? null;
}

export function openExternalLink(url: string): void {
  if (webApp) webApp.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
