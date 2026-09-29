import type { NearbyCard } from "@max-events/api-contracts";

const MOSCOW_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" });
const WEEKDAY = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", weekday: "short" });
const DAYNUM = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric" });

const DAY_MS = 24 * 60 * 60 * 1000;

/** Moscow calendar day as YYYY-MM-DD. en-CA is the format, not the zone. */
export function moscowDayKey(date: Date): string {
  return MOSCOW_DAY.format(date);
}

export function nearbyDayOptions(now: Date, count = 7): readonly { readonly key: string; readonly label: string }[] {
  const today = moscowDayKey(now);
  const tomorrow = moscowDayKey(new Date(now.getTime() + DAY_MS));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getTime() + index * DAY_MS);
    const key = moscowDayKey(date);
    const label = key === today ? "Сегодня" : key === tomorrow ? "Завтра" : `${WEEKDAY.format(date)} ${DAYNUM.format(date)}`;
    return { key, label };
  });
}

/** Ongoing «сейчас» cards stay on today even if they started earlier. Every other card follows its start day. */
export function cardOnDay(card: Pick<NearbyCard, "bucket"> & { event: Pick<NearbyCard["event"], "startsAt"> }, dayKey: string, todayKey: string): boolean {
  if (dayKey === todayKey && card.bucket === "now") return true;
  return moscowDayKey(new Date(card.event.startsAt)) === dayKey;
}

function stem(word: string): string {
  return word.length <= 4 ? word : word.slice(0, 4);
}

function stems(text: string): string[] {
  return text
    .toLocaleLowerCase("ru")
    .split(/[^a-zа-яё0-9]+/i)
    .filter((word) => word.length >= 3)
    .map(stem);
}

/**
 * A nearby card matches a typed query when the text contains it, a 4-letter stem overlaps,
 * or the assist pick already resolved the word form to this event.
 */
export function cardMatchesQuery(card: { readonly event: { readonly id: string; readonly title: string }; readonly place: { readonly title: string } }, query: string, assistIds: ReadonlySet<string> | null): boolean {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (needle === "") return true;
  if (assistIds?.has(card.event.id) === true) return true;
  const hay = `${card.event.title} ${card.place.title}`.toLocaleLowerCase("ru");
  if (hay.includes(needle)) return true;
  const wanted = stems(needle);
  if (wanted.length === 0) return false;
  const found = new Set(stems(hay));
  return wanted.every((part) => found.has(part));
}
