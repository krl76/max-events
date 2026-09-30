// START_MODULE_CONTRACT
// PURPOSE: Map TimePad's public event list into the same rows the afisha import upserts.
// SCOPE: Pure mapping plus the HTTP page walk. Skips the pull when TimePad answers 401/403
//   without a token. No database.
// DEPENDS: @max-events/api-contracts (EventCategory, PlaceCategory), ./kudago (ImportedAfishaEvent)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - TIMEPAD_SOURCE - events.source value for this catalog
// - mapTimepadEvent - one API event, or null when it has no upcoming start
// - fetchTimepadCatalog - Moscow and Saint Petersburg, upcoming window, page cap
// END_MODULE_MAP

import type { EventCategory, PlaceCategory } from "@max-events/api-contracts";
import type { ImportedAfishaEvent, ImportedPlace, KudagoCatalog } from "./kudago";

export const TIMEPAD_SOURCE = "timepad";

const CITIES = ["Москва", "Санкт-Петербург"] as const;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const HORIZON_MS = 45 * 24 * 60 * 60 * 1000;

interface TimepadCategory {
  name?: string;
}

interface TimepadTicket {
  price?: number | null;
}

interface TimepadLocation {
  city?: string;
  address?: string;
  coordinates?: number[] | null;
}

interface TimepadPoster {
  default_url?: string | null;
}

interface TimepadEvent {
  id?: number;
  name?: string;
  description_short?: string;
  starts_at?: string;
  ends_at?: string | null;
  url?: string;
  poster_image?: TimepadPoster | null;
  categories?: TimepadCategory[];
  location?: TimepadLocation | null;
  ticket_types?: TimepadTicket[];
}

interface TimepadPage {
  total?: number;
  values?: TimepadEvent[];
}

export function categoryFromTimepad(names: readonly string[]): EventCategory {
  const text = names.join(" ").toLowerCase();
  if (text.includes("спорт") || text.includes("йога") || text.includes("фитнес")) return "sport";
  if (text.includes("волонтер") || text.includes("волонтёр") || text.includes("благотвор")) return "volunteering";
  if (text.includes("экскур") || text.includes("туризм") || text.includes("прогулк")) return "tourism";
  return "afisha";
}

export function mapTimepadEvent(raw: TimepadEvent, now: Date): ImportedAfishaEvent | null {
  if (typeof raw.id !== "number" || typeof raw.name !== "string") return null;
  const title = raw.name.trim().slice(0, 200);
  if (title.length === 0) return null;
  const startsAt = parseInstant(raw.starts_at);
  if (startsAt === null || startsAt.getTime() < now.getTime()) return null;
  const endsAt = parseInstant(raw.ends_at);
  const city = normalizeCity(raw.location?.city);
  if (city === null) return null;
  const money = moneyFromTickets(raw.ticket_types ?? []);
  const cover = httpsUrl(raw.poster_image?.default_url);
  const site = httpsUrl(raw.url);
  return {
    externalId: String(raw.id),
    title,
    description: (raw.description_short ?? "").replace(/\s+/g, " ").trim().slice(0, 5000) || title,
    category: categoryFromTimepad((raw.categories ?? []).map((item) => item.name ?? "")),
    city,
    startsAt,
    endsAt,
    isPaid: money.isPaid,
    priceRub: money.priceRub,
    sourceUrl: site,
    coverUrl: cover,
    popularity: 0,
    place: mapPlace(raw.location ?? null, city),
    source: TIMEPAD_SOURCE,
  };
}

function mapPlace(location: TimepadLocation | null, city: string): ImportedPlace | null {
  if (location === null) return null;
  const title = (location.address ?? "").trim().slice(0, 200) || city;
  const address = (location.address ?? "").trim().slice(0, 300) || title;
  const coords = location.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const latitude = Number(coords[0]);
  const longitude = Number(coords[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return {
    externalId: `${city}:${address}`.slice(0, 200),
    title: title.slice(0, 200),
    address,
    city,
    category: "other" as PlaceCategory,
    latitude,
    longitude,
    source: TIMEPAD_SOURCE,
  };
}

function moneyFromTickets(tickets: readonly TimepadTicket[]): { isPaid: boolean; priceRub: number | null } {
  const prices = tickets.map((ticket) => ticket.price).filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0);
  if (prices.length === 0) return { isPaid: false, priceRub: null };
  return { isPaid: true, priceRub: Math.min(Math.round(Math.min(...prices)), 1_000_000) };
}

function normalizeCity(value: string | null | undefined): string | null {
  const city = value?.trim() ?? "";
  if (city === "Москва" || city === "Санкт-Петербург") return city;
  return null;
}

function parseInstant(value: string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

function httpsUrl(value: string | null | undefined): string | null {
  if (value == null || !value.startsWith("https://")) return null;
  return value.slice(0, 500);
}

export async function fetchTimepadCatalog(now: Date, fetchImpl: typeof fetch = fetch, token?: string): Promise<KudagoCatalog> {
  const until = new Date(now.getTime() + HORIZON_MS);
  const events: ImportedAfishaEvent[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL("https://api.timepad.ru/v1/events.json");
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("skip", String(page * PAGE_SIZE));
    url.searchParams.set("cities", CITIES.join(","));
    url.searchParams.set("sort", "+starts_at");
    url.searchParams.set("starts_at_min", now.toISOString());
    url.searchParams.set("starts_at_max", until.toISOString());
    url.searchParams.set("fields", "location,poster_image,ticket_types,description_short,categories");
    const headers: Record<string, string> = { accept: "application/json", "user-agent": "max-events/afisha" };
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (response.status === 401 || response.status === 403) {
      return { events: [], cities: [...CITIES], complete: false, source: TIMEPAD_SOURCE };
    }
    if (!response.ok) throw new Error(`TimePad page ${page} answered ${response.status}`);
    const body = (await response.json()) as TimepadPage;
    const rows = body.values ?? [];
    for (const raw of rows) {
      const mapped = mapTimepadEvent(raw, now);
      if (!mapped || seen.has(mapped.externalId)) continue;
      seen.add(mapped.externalId);
      events.push(mapped);
    }
    if (rows.length < PAGE_SIZE) {
      return { events, cities: [...CITIES], complete: true, source: TIMEPAD_SOURCE };
    }
  }
  return { events, cities: [...CITIES], complete: false, source: TIMEPAD_SOURCE };
}
