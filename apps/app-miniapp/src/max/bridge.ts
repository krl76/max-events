// START_MODULE_CONTRACT
// PURPOSE: Thin typed wrapper over MAX Bridge (window.WebApp), the only place touching the global.
// SCOPE: WebApp typing, nullable access outside the MAX client, start_param extraction, external link opening, chat sharing (shareMaxContent with clipboard fallback).
// DEPENDS: https://st.max.ru/js/max-web-app.js loaded by index.html
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY, https://dev.max.ru/docs/webapps/bridge
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MaxWebAppUser - user shape from initDataUnsafe
// - MaxWebAppInitDataUnsafe - untrusted launch params shape
// - MaxWebAppShareParams - { text?, link? } payload of shareMaxContent
// - MaxWebApp - window.WebApp interface (shareMaxContent optional: не во всех клиентах)
// - getWebApp - live window.WebApp (null outside MAX / before a browser-auth shim)
// - webApp - snapshot of getWebApp() at module load (tests that stub window then import)
// - getStartParam - extract start_param from initDataUnsafe
// - openExternalLink - open link via MAX or browser fallback
// - openChatLink - openMaxLink for max.ru chat links, else openLink
// - ShareChannel - where the shared text went (bridge / clipboard / unavailable)
// - shareResult - share text (and an optional max.ru link) into a MAX chat via shareMaxContent, clipboard fallback
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

export interface MaxWebAppShareParams {
  text?: string;
  link?: string;
}

export interface MaxWebApp {
  platform: string;
  version: string;
  initData: string;
  initDataUnsafe: MaxWebAppInitDataUnsafe;
  ready(): void;
  openLink(url: string): void;
  openMaxLink(url: string): void;
  /** Документированный шеринг внутри MAX (диалоги/групповые чаты); https://dev.max.ru/docs/webapps/bridge#Шеринг%20контента */
  shareMaxContent?(params: MaxWebAppShareParams): void;
  close(): void;
  /** Шапочная «Назад» клиента MAX. Нет в браузере вне мессенджера. */
  BackButton?: {
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
}

declare global {
  interface Window {
    WebApp?: MaxWebApp;
  }
}

/** Live window.WebApp so a browser-auth shim installed during bootstrap is visible. */
export function getWebApp(): MaxWebApp | null {
  return typeof window !== "undefined" ? (window.WebApp ?? null) : null;
}

/** Snapshot at module load. Prefer getWebApp() after a late shim. */
export const webApp: MaxWebApp | null = getWebApp();

export function getStartParam(app: Pick<MaxWebApp, "initDataUnsafe"> | null): string | null {
  return app?.initDataUnsafe.start_param ?? null;
}

export function openExternalLink(url: string): void {
  const app = getWebApp();
  if (app) app.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

/** Event/plan chats live on max.ru — prefer openMaxLink so they stay in the messenger. */
export function openChatLink(url: string): void {
  const app = getWebApp();
  if (app) {
    if (/^https?:\/\/([a-z0-9-]+\.)*max\.ru(\/|$)/i.test(url)) app.openMaxLink(url);
    else app.openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export type ShareChannel = "bridge" | "clipboard" | "unavailable";

export const SHARE_NOTICE = "max-share-notice";

export function shareNoticeText(channel: ShareChannel): string {
  if (channel === "bridge") return "Выберите чат в MAX и отправьте сообщение";
  if (channel === "clipboard") return "Скопировано. Отправьте его из MAX";
  return "Не удалось поделиться. Откройте MAX и напишите оттуда";
}

export function announceShare(channel: ShareChannel): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ShareChannel>(SHARE_NOTICE, { detail: channel }));
}

/**
 * Share into a MAX chat. `link` is the max.ru deep link (startapp), separate from the sentence,
 * so the client opens the bot window instead of the website the mini-app is hosted on.
 * Outside MAX the same pair is copied.
 */
export async function shareResult(app: Pick<MaxWebApp, "shareMaxContent"> | null, text: string, link?: string): Promise<ShareChannel> {
  const body = link && !text.includes(link) ? `${text}\n${link}` : text;
  if (typeof app?.shareMaxContent === "function") {
    app.shareMaxContent(link ? { text: body, link } : { text: body });
    return "bridge";
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(body);
    return "clipboard";
  }
  return "unavailable";
}
