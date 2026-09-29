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
}

interface KudagoDate {
  start?: number | null;
  end?: number | null;
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

function upcomingWindow(dates: readonly KudagoDate[], nowMs: number): { start: Date; end: Date | null } | null {
  const open: Array<{ start: Date; end: Date | null }> = [];
  const startless: Array<{ start: Date; end: Date | null }> = [];
  for (const date of dates) {
    if (typeof date.start !== "number") continue;
    const startMs = date.start * 1000;
    const endMs = typeof date.end === "number" ? date.end * 1000 : null;
    if ((endMs ?? startMs) < nowMs) continue;
    if (startMs < EARLIEST_REAL_START_MS) {
      if (endMs !== null && endMs >= nowMs) startless.push({ start: new Date(nowMs), end: new Date(endMs) });
      continue;
    }
    open.push({ start: new Date(startMs), end: endMs === null ? null : new Date(endMs) });
  }
  const windows = open.length > 0 ? open : startless;
  windows.sort((left, right) => left.start.getTime() - right.start.getTime());
  return windows[0] ?? null;
}

export function mapKudagoEvent(raw: KudagoEvent, city: string, now: Date): ImportedAfishaEvent | null {
  if (typeof raw.id !== "number" || typeof raw.title !== "string") return null;
  const title = raw.title.trim().slice(0, 200);
  if (title.length === 0) return null;
  const window = upcomingWindow(raw.dates ?? [], now.getTime());
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
  return { externalId: String(place.id), title, address, city, category: placeCategoryFromKudago(slugs), latitude, longitude };
}

export interface KudagoCatalog {
  events: ImportedAfishaEvent[];
  /** Cities this pull asked for. A complete pull may hide previous rows in these cities. */
  cities: string[];
  complete: boolean;
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
  return { events, cities: CITIES.map((location) => location.city), complete };
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
