// START_MODULE_CONTRACT
// PURPOSE: Turn a KudaGo public-catalog page into rows the afisha import can upsert.
// SCOPE: Pure mapping and the HTTP page walk. No database.
// DEPENDS: @max-events/api-contracts (EventCategory, PlaceCategory)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ImportedAfishaEvent - one upcoming showing ready to upsert
// - mapKudagoEvent - one API event, or null when it has no upcoming showing
// - fetchKudagoCatalog - Moscow and Saint Petersburg, upcoming window, page cap
// END_MODULE_MAP

import type { EventCategory, PlaceCategory } from "@max-events/api-contracts";

export const AFISHA_SOURCE = "kudago";

const CITIES = [
  { slug: "msk", city: "Москва" },
  { slug: "spb", city: "Санкт-Петербург" },
] as const;

const PAGE_SIZE = 100;
const MAX_PAGES = 15;
const HORIZON_MS = 45 * 24 * 60 * 60 * 1000;

export interface ImportedPlace {
  externalId: string;
  title: string;
  address: string;
  city: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  source?: string;
}

export interface ImportedAfishaEvent {
  externalId: string;
  title: string;
  description: string;
  category: EventCategory;
  city: string;
  startsAt: Date;
  endsAt: Date | null;
  isPaid: boolean;
  priceRub: number | null;
  sourceUrl: string | null;
  coverUrl: string | null;
  popularity: number;
  place: ImportedPlace | null;
  source: string;
}

interface KudagoSchedule {
  days_of_week?: number[];
  start_time?: string | null;
  end_time?: string | null;
}

interface KudagoDate {
  start?: number | null;
  end?: number | null;
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  is_continuous?: boolean;
  is_endless?: boolean;
  is_startless?: boolean;
  schedules?: KudagoSchedule[];
}

interface KudagoPlace {
  id?: number;
  title?: string;
  address?: string;
  coords?: { lat?: number; lon?: number };
}

interface KudagoEvent {
  id?: number;
  title?: string;
  description?: string;
  place?: KudagoPlace | number | null;
  dates?: KudagoDate[];
  price?: string;
  is_free?: boolean;
  categories?: string[];
  images?: Array<{ image?: string }>;
  site_url?: string;
  favorites_count?: number;
}

interface KudagoPage {
  next?: string | null;
  results?: KudagoEvent[];
}

export function categoryFromKudago(slugs: readonly string[]): EventCategory {
  if (slugs.some((slug) => slug.includes("sport") || slug === "fitness" || slug === "yoga")) return "sport";
  if (slugs.some((slug) => slug.includes("volunte") || slug.includes("charit"))) return "volunteering";
  if (slugs.some((slug) => slug === "excursion" || slug === "excursions" || slug === "travel" || slug === "tourism")) return "tourism";
  return "afisha";
}

export function placeCategoryFromKudago(slugs: readonly string[]): PlaceCategory {
  if (slugs.some((slug) => slug.includes("museum") || slug === "exhibition")) return "museum";
  if (slugs.some((slug) => slug.includes("park"))) return "park";
  if (slugs.some((slug) => slug.includes("sport"))) return "sport";
  if (slugs.some((slug) => slug === "restaurant" || slug === "bar" || slug === "cafe" || slug.includes("food"))) return "food";
  return "other";
}

export function rubFromKudago(price: string, isFree: boolean): { isPaid: boolean; priceRub: number | null } {
  if (isFree) return { isPaid: false, priceRub: null };
  const match = price.match(/(\d[\d\s]{0,8}\d|\d)/);
  if (!match) return { isPaid: price.trim().length > 0, priceRub: null };
  const value = Number(match[1].replace(/\s/g, ""));
  if (!Number.isFinite(value) || value <= 0) return { isPaid: true, priceRub: null };
  return { isPaid: true, priceRub: Math.min(value, 1_000_000) };
}

export function isKudagoCover(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "media.kudago.com" && (parsed.pathname.startsWith("/images/") || parsed.pathname.startsWith("/thumbs/"));
  } catch {
    return false;
  }
}

export function publicCoverUrl(coverUrl: string | null | undefined): string | null {
  if (coverUrl == null || coverUrl.trim() === "") return null;
  if (!isKudagoCover(coverUrl)) return coverUrl;
  return `/api/media/cover?src=${encodeURIComponent(coverUrl)}`;
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

const EARLIEST_REAL_START_MS = Date.UTC(2000, 0, 1);
/** Moscow has had no DST since 2014. */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

type Showing = { start: Date; end: Date | null };

function moscowWall(date: Date): { year: number; month: number; day: number; hour: number; minute: number; monday0: number } {
  const shifted = new Date(date.getTime() + MSK_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    monday0: (shifted.getUTCDay() + 6) % 7,
  };
}

function fromMoscowWall(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, 0, 0));
}

function parseClock(value: string | null | undefined): { hour: number; minute: number } | null {
  if (value == null || value === "" || value === "00:00:00") return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function parseDay(value: string | null | undefined): { year: number; month: number; day: number } | null {
  if (value == null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function addMoscowDays(parts: { year: number; month: number; day: number }, days: number): { year: number; month: number; day: number } {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function dayKeyParts(parts: { year: number; month: number; day: number }): number {
  return parts.year * 10_000 + parts.month * 100 + parts.day;
}

function nextScheduleShowing(range: KudagoDate, now: Date): Showing | null {
  const schedules = range.schedules ?? [];
  if (schedules.length === 0) return null;
  const startDay = parseDay(range.start_date) ?? moscowWall(now);
  const endDay = parseDay(range.end_date);
  const today = moscowWall(now);
  let cursor = dayKeyParts(startDay) > dayKeyParts(today) ? startDay : { year: today.year, month: today.month, day: today.day };
  const last = endDay ?? addMoscowDays(cursor, 45);
  for (let step = 0; step < 60 && dayKeyParts(cursor) <= dayKeyParts(last); step += 1) {
    const monday0 = moscowWall(fromMoscowWall(cursor.year, cursor.month, cursor.day, 12, 0)).monday0;
    for (const schedule of schedules) {
      const days = schedule.days_of_week ?? [];
      if (days.length > 0 && !days.includes(monday0)) continue;
      const open = parseClock(schedule.start_time);
      if (open === null) continue;
      const start = fromMoscowWall(cursor.year, cursor.month, cursor.day, open.hour, open.minute);
      const close = parseClock(schedule.end_time);
      const end = close === null ? null : fromMoscowWall(cursor.year, cursor.month, cursor.day, close.hour, close.minute);
      if (start.getTime() >= now.getTime()) return { start, end };
    }
    cursor = addMoscowDays(cursor, 1);
  }
  return null;
}

function unixShowing(range: KudagoDate): Showing | null {
  const clock = parseClock(range.start_time);
  const day = parseDay(range.start_date);
  if (clock && day) {
    const start = fromMoscowWall(day.year, day.month, day.day, clock.hour, clock.minute);
    const endClock = parseClock(range.end_time);
    const endDay = parseDay(range.end_date) ?? day;
    const end = endClock === null ? (typeof range.end === "number" ? new Date(range.end * 1000) : null) : fromMoscowWall(endDay.year, endDay.month, endDay.day, endClock.hour, endClock.minute);
    return { start, end };
  }
  if (typeof range.start !== "number") return null;
  const startMs = range.start * 1000;
  if (startMs < EARLIEST_REAL_START_MS) return null;
  const start = new Date(startMs);
  const wall = moscowWall(start);
  if (clock === null && wall.hour === 0 && wall.minute === 0) return null;
  const endMs = typeof range.end === "number" ? range.end * 1000 : null;
  return { start, end: endMs === null ? null : new Date(endMs) };
}

/**
 * Next real showing: a clock time from KudaGo, or the next opening from `schedules`.
 * Sentinel / startless rows without a schedule are dropped so the catalog does not stamp
 * every exhibition with the import clock (they all used to show as 09:02).
 */
export function upcomingWindow(dates: readonly KudagoDate[], now: Date): Showing | null {
  const open: Showing[] = [];
  for (const range of dates) {
    const scheduled = nextScheduleShowing(range, now);
    if (scheduled) {
      open.push(scheduled);
      continue;
    }
    if (range.is_startless === true) continue;
    const showing = unixShowing(range);
    if (showing === null) continue;
    const endMs = showing.end?.getTime() ?? showing.start.getTime();
    if (endMs < now.getTime()) continue;
    if (showing.start.getTime() < now.getTime()) continue;
    open.push(showing);
  }
  open.sort((left, right) => left.start.getTime() - right.start.getTime());
  const future = open.find((row) => row.start.getTime() >= now.getTime());
  return future ?? open[0] ?? null;
}

export function mapKudagoEvent(raw: KudagoEvent, city: string, now: Date): ImportedAfishaEvent | null {
  if (typeof raw.id !== "number" || typeof raw.title !== "string") return null;
  const title = raw.title.trim().slice(0, 200);
  if (title.length === 0) return null;
  const window = upcomingWindow(raw.dates ?? [], now);
  if (window === null) return null;
  const slugs = raw.categories ?? [];
  const money = rubFromKudago(raw.price ?? "", raw.is_free === true);
  const image = raw.images?.find((item) => typeof item.image === "string" && isKudagoCover(item.image))?.image ?? null;
  const place = mapPlace(raw.place, slugs, city);
  const site = typeof raw.site_url === "string" && raw.site_url.startsWith("https://") ? raw.site_url.slice(0, 500) : null;
  return {
    externalId: String(raw.id),
    title,
    description: plainText(raw.description ?? "") || title,
    category: categoryFromKudago(slugs),
    city,
    startsAt: window.start,
    endsAt: window.end,
    isPaid: money.isPaid,
    priceRub: money.priceRub,
    sourceUrl: site,
    coverUrl: image,
    popularity: Number.isFinite(raw.favorites_count) ? Math.max(0, Math.round(raw.favorites_count ?? 0)) : 0,
    place,
    source: AFISHA_SOURCE,
  };
}

function mapPlace(place: KudagoEvent["place"], slugs: readonly string[], city: string): ImportedPlace | null {
  if (place == null || typeof place === "number") return null;
  const title = place.title?.trim().slice(0, 200) ?? "";
  const address = place.address?.trim().slice(0, 300) || title;
  const latitude = place.coords?.lat;
  const longitude = place.coords?.lon;
  if (title.length === 0 || typeof place.id !== "number") return null;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { externalId: String(place.id), title, address, city, category: placeCategoryFromKudago(slugs), latitude, longitude, source: AFISHA_SOURCE };
}

export interface KudagoCatalog {
  events: ImportedAfishaEvent[];
  /** Cities this pull asked for. A complete pull may hide previous rows in these cities. */
  cities: string[];
  complete: boolean;
  source?: string;
}

export async function fetchKudagoCatalog(now: Date, fetchImpl: typeof fetch = fetch): Promise<KudagoCatalog> {
  const since = Math.floor(now.getTime() / 1000);
  const until = Math.floor((now.getTime() + HORIZON_MS) / 1000);
  const events: ImportedAfishaEvent[] = [];
  const seen = new Set<string>();
  let complete = true;
  for (const location of CITIES) {
    const cityResult = await fetchCity(location.slug, location.city, since, until, now, fetchImpl);
    if (!cityResult.complete) complete = false;
    for (const event of cityResult.events) {
      if (seen.has(event.externalId)) continue;
      seen.add(event.externalId);
      events.push(event);
    }
  }
  return { events, cities: CITIES.map((location) => location.city), complete, source: AFISHA_SOURCE };
}

async function fetchCity(slug: string, city: string, since: number, until: number, now: Date, fetchImpl: typeof fetch): Promise<KudagoCatalog> {
  const events: ImportedAfishaEvent[] = [];
  let page = 1;
  while (page <= MAX_PAGES) {
    const url = new URL("https://kudago.com/public-api/v1.4/events/");
    url.searchParams.set("lang", "ru");
    url.searchParams.set("location", slug);
    url.searchParams.set("actual_since", String(since));
    url.searchParams.set("actual_until", String(until));
    url.searchParams.set("page_size", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));
    url.searchParams.set("text_format", "text");
    url.searchParams.set("expand", "dates,place");
    url.searchParams.set("order_by", "-favorites_count");
    url.searchParams.set("fields", "id,title,description,place,dates,price,is_free,categories,images,site_url,favorites_count");
    const response = await fetchImpl(url, { headers: { accept: "application/json", "user-agent": "max-events/afisha" }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`KudaGo ${slug} page ${page} answered ${response.status}`);
    const body = (await response.json()) as KudagoPage;
    for (const raw of body.results ?? []) {
      const mapped = mapKudagoEvent(raw, city, now);
      if (mapped) events.push(mapped);
    }
    if (!body.next) return { events, cities: [city], complete: true };
    page += 1;
  }
  return { events, cities: [city], complete: false };
}
