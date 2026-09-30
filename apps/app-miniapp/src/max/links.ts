// START_MODULE_CONTRACT
// PURPOSE: Deep links that open this mini-app inside MAX, on the screen the sender meant.
// SCOPE: Bot URL and start_param only. Sharing itself stays in ./bridge.js.
// DEPENDS: —
// LINKS: M-APP-MINIAPP, https://dev.max.ru/docs/webapps/bridge
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MAX_BOT_APP_URL - https://max.ru/<bot>, the window a friend should land in
// - maxAppLink - that URL plus ?startapp=
// - startParamFromSharedUrl - recover a start_param from a max.ru link or a legacy /calendar/invite/ URL
// - sharePayload - sentence plus the deep link, for shareMaxContent text and link
// END_MODULE_MAP

/** Public bot of this mini-app. Same default as MAX_APP_URL on the backend. */
export const MAX_BOT_APP_URL = "https://max.ru/t691_hakaton_max_bot";

const CALENDAR_INVITE = /\/calendar\/invite\/([^/?#]+)/;

/** `https://max.ru/<bot>?startapp=<payload>`. An empty payload is the bot itself, with no screen. */
export function maxAppLink(startParam: string): string {
  const url = new URL(MAX_BOT_APP_URL);
  const payload = startParam.trim();
  if (payload.length > 0) url.searchParams.set("startapp", payload);
  return url.toString();
}

/**
 * A link we are about to put in a chat. `?startapp=` wins, on any host: the website used to
 * carry the same payload and opened a browser tab. `/calendar/invite/<token>` is the older
 * shape of the same invite.
 */
export function startParamFromSharedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const startapp = url.searchParams.get("startapp")?.trim();
    if (startapp) return startapp;
    const invite = CALENDAR_INVITE.exec(url.pathname);
    const token = invite?.[1];
    return token ? `calendar-${decodeURIComponent(token)}` : null;
  } catch {
    return null;
  }
}

export function sharePayload(sentence: string, startParam: string | null): { text: string; link?: string } {
  const payload = startParam?.trim() ?? "";
  if (payload.length === 0) return { text: sentence };
  return { text: sentence, link: maxAppLink(payload) };
}
