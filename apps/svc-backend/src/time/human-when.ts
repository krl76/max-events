// START_MODULE_CONTRACT
// PURPOSE: Clock time a person can read, plus an optional miniapp link, for bot messages.
// SCOPE: humanWhen / humanMeeting speak Moscow wall time («сегодня в 20:30»); miniappLink builds ?startapp= only when PUBLIC_APP_URL is set. ISO stays in stored timestamps, not in the sentence.
// DEPENDS: ./moscow-date
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - humanWhen - «сегодня в 20:30», «завтра в 20:30», or «12 сентября в 20:30»
// - humanMeeting - humanWhen plus a place, comma-separated
// - miniappLink - absolute ?startapp= URL, or null when no public origin is configured
// - withAppLink - append that URL to a sentence when it exists
// END_MODULE_MAP

import { moscowDateKey, moscowTimeLabel } from "./moscow-date";

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"] as const;

function addCalendarDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

/** «сегодня в 20:30» against Moscow calendar dates. The raw instant stays in the database. */
export function humanWhen(at: Date, now = new Date()): string {
  const day = moscowDateKey(at);
  const today = moscowDateKey(now);
  const clock = moscowTimeLabel(at);
  if (day === today) return `сегодня в ${clock}`;
  if (day === addCalendarDays(today, 1)) return `завтра в ${clock}`;
  const [, month, date] = day.split("-");
  const monthName = MONTHS[(Number(month) || 1) - 1] ?? MONTHS[0];
  return `${Number(date)} ${monthName} в ${clock}`;
}

/** «сегодня в 20:30, у метро Смоленская». An empty place leaves just the clock. */
export function humanMeeting(at: Date, place: string, now = new Date()): string {
  const when = humanWhen(at, now);
  const where = place.trim();
  return where ? `${when}, ${where}` : when;
}

/**
 * A link the miniapp can open. Unset PUBLIC_APP_URL means the sentence stays without a URL:
 * a guessed host would point at the wrong stand.
 */
export function miniappLink(payload: string, base: string | undefined = process.env.PUBLIC_APP_URL): string | null {
  const origin = base?.trim();
  if (!origin || payload.trim().length === 0) return null;
  try {
    const url = new URL(origin);
    url.searchParams.set("startapp", payload);
    return url.toString();
  } catch {
    return null;
  }
}

export function withAppLink(text: string, link: string | null): string {
  return link ? `${text} ${link}` : text;
}
