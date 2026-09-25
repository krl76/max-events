// START_MODULE_CONTRACT
// PURPOSE: Discovery endpoints of the api client: the today digest of экран 08, the «Куда пойдём?» wizard, the nearby timeline with its free-window leisure chains, the NL assistant and the swipe deck of экран 09.
// SCOPE: GET /today, GET /whereto, GET /nearby[/free], POST /assist[/day], GET /discover/swipe, POST /discover/swipe/:placeId; the TodayDigest, WheretoPicks, LeisureChain and SwipeCandidate aggregates are client-side shapes like EventDetails in ./catalog.ts.
// DEPENDS: ./transport.js, ./catalog.js (CatalogCard), @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LeisureQuery - free-window leisure payload (hours 1..8, mood, coordinates)
// - WheretoPick - one suggestion of экран 12: the event plus the distance its card prints (#504)
// - WheretoPicks - GET /whereto answer: up to five picks; a superset of WheretoResponse, so a backend that answers plain events still parses
// - LeisureChainStop - one stop of the chain of экран 14: the contract stop plus its distance and price
// - LeisureChain - GET /nearby/free chain with enriched stops; a superset of LeisureOption
// - TodayCard - one card of the digest: a CatalogCard plus its typed labels (макет, экран 08, «Для вас»)
// - TodayDigest - digest response: the three summary counters plus the cards; a superset of the TodayResponse contract, so a backend that answers the plain shape still parses (extras read as null)
// - SwipeCategory - the four filter chips of экран 09 (Все / Еда / На природе / Спорт)
// - SWIPE_CATEGORIES - the chips in design order, so the screen cannot invent a fifth
// - SwipeCandidate - one card of the swipe deck: the venue plus its amenities, friends and the match score (#498)
// - SwipeDecision - what the swipe meant: right = into favourites, left = past it
// - withDiscover - ApiClient.getToday / getWhereto / getNearbyTimeline / getLeisureOptions / assistQuery / assistDay / listSwipeCandidates / saveSwipeDecision
// END_MODULE_MAP

import { AssistDayResponseSchema, AssistResponseSchema, EventSchema, FriendSchema, LeisureOptionSchema, NearbyTimelineSchema, PlaceSchema, TodayCardLabelSchema, TodaySummarySchema } from "@max-events/api-contracts";
import type { AssistDayResponse, AssistResponse, Event, Friend, LeisureMood, LeisureOption, LeisureStop, NearbyTimeline, Place, TodayCardLabel, TodaySummary, WheretoQuery } from "@max-events/api-contracts";
import type { CatalogCard } from "./catalog";
import type { ApiMixin, ZodSchema } from "./transport";

/** Free-window leisure query: hours 1..8 plus the mood. */
export interface LeisureQuery {
  hours: number;
  mood: LeisureMood;
  latitude: number;
  longitude: number;
}

const isNullableNumber = (value: unknown): value is number | null => value === null || typeof value === "number";

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";

/**
 * One suggestion of макет экран 12. The wizard answers plain events (WheretoResponse), and the card
 * of the design also prints how far the venue is — a number the whereto item does not carry (#504),
 * so it reads null until it does.
 */
export interface WheretoPick extends Event {
  /** «1,2 км» from the viewer; null while the item carries no distance (#504). */
  distanceKm: number | null;
}

/**
 * GET /whereto: at most five picks (the contract caps it). Structurally a superset of WheretoResponse —
 * an answer of plain events still parses and reads distanceKm as null — so the live endpoint needs no
 * change for this screen to work, and gains the distance drop-in once #504 lands.
 */
export interface WheretoPicks {
  items: WheretoPick[];
}

const WheretoPicksSchema: ZodSchema<WheretoPicks> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a whereto response object" };
    const raw = data as Record<string, unknown>;
    if (!Array.isArray(raw.items)) return { success: false as const, error: "invalid whereto response" };
    const items: WheretoPick[] = [];
    for (const entry of raw.items) {
      const event = EventSchema.safeParse(entry);
      if (!event.success) return { success: false as const, error: "invalid whereto item" };
      // Absent, not merely null: the distance is ours, and an answer without it is still valid.
      const distanceKm = (entry as Record<string, unknown>).distanceKm ?? null;
      if (!isNullableNumber(distanceKm)) return { success: false as const, error: "invalid whereto item" };
      items.push({ ...event.data, distanceKm });
    }
    return { success: true as const, data: { items } };
  },
};

/**
 * One stop of the chain of макет экран 14 («19:00 · 0,4 км · 400 ₽»). The contract stop carries the
 * kind, the title and the time; neither the distance (#504) nor what the stop costs (a Place has no
 * price at all, #492) is in it, so both read as absent rather than as an invented zero.
 */
export interface LeisureChainStop extends LeisureStop {
  /** «0,4 км» from the viewer; null while the stop carries no distance (#504). */
  distanceKm: number | null;
  /** «400 ₽» — what the stop costs; null when there is no price to print (#492). */
  priceRub: number | null;
  /** «бесплатно» — true only when the stop is known to be free; an unknown price is not free. */
  free: boolean;
}

/** GET /nearby/free chain with enriched stops; a superset of LeisureOption, so the live answer parses unchanged. */
export interface LeisureChain extends LeisureOption {
  stops: LeisureChainStop[];
}

const LeisureChainsSchema: ZodSchema<LeisureChain[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected a leisure chain array" };
    const chains: LeisureChain[] = [];
    for (const item of data) {
      const option = LeisureOptionSchema.safeParse(item);
      if (!option.success) return { success: false as const, error: "invalid leisure chain" };
      const rawStops = (item as { stops?: unknown }).stops;
      if (!Array.isArray(rawStops)) return { success: false as const, error: "invalid leisure chain" };
      const stops: LeisureChainStop[] = [];
      for (const [index, stop] of option.data.stops.entries()) {
        const raw = (rawStops[index] ?? {}) as Record<string, unknown>;
        const distanceKm = raw.distanceKm ?? null;
        const priceRub = raw.priceRub ?? null;
        const free = raw.free ?? false;
        if (!isNullableNumber(distanceKm) || !isNullableNumber(priceRub) || typeof free !== "boolean") return { success: false as const, error: "invalid leisure stop" };
        stops.push({ ...stop, distanceKm, priceRub, free });
      }
      chains.push({ ...option.data, stops });
    }
    return { success: true as const, data: chains };
  },
};

/** One card of the digest (макет, экран 08): the catalog card the «Для вас» tiles print, plus the contextual labels. */
export interface TodayCard extends CatalogCard {
  labels: TodayCardLabel[];
}

/**
 * The digest behind «Сегодня для тебя» and «Для вас». Structurally a superset of the TodayResponse
 * contract: summary and cards keep their meaning, and the three fields the card needs but the DTO
 * does not carry (#496) read as null when the answer predates them, so a live backend still parses.
 */
export interface TodayDigest {
  summary: TodaySummary;
  cards: TodayCard[];
}

const TodayDigestSchema: ZodSchema<TodayDigest> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a today digest object" };
    const raw = data as Record<string, unknown>;
    const summary = TodaySummarySchema.safeParse(raw.summary);
    if (!summary.success || !Array.isArray(raw.cards)) return { success: false as const, error: "invalid today digest" };
    const cards: TodayCard[] = [];
    for (const item of raw.cards) {
      if (typeof item !== "object" || item === null) return { success: false as const, error: "invalid today card" };
      const card = item as Record<string, unknown>;
      const event = EventSchema.safeParse(card.event);
      const labels = TodayCardLabelSchema.array().safeParse(card.labels);
      if (!event.success || !labels.success) return { success: false as const, error: "invalid today card" };
      // Absent, not merely null: the enriched fields are ours, and an answer without them is still valid.
      const distanceKm = card.distanceKm ?? null;
      const rating = card.rating ?? null;
      const placeTitle = card.placeTitle ?? null;
      if (!isNullableNumber(distanceKm) || !isNullableNumber(rating) || !isNullableString(placeTitle)) return { success: false as const, error: "invalid today card" };
      cards.push({ event: event.data, labels: labels.data, distanceKm, rating, placeTitle });
    }
    return { success: true as const, data: { summary: summary.data, cards } };
  },
};

/** The filter chips of экран 09; «all» is the unfiltered deck. */
export type SwipeCategory = "all" | "food" | "outdoors" | "sport";

export const SWIPE_CATEGORIES: readonly SwipeCategory[] = ["all", "food", "outdoors", "sport"];

/**
 * One card of the swipe deck (макет, экран 09). Neither the deck nor the score exists in the backend
 * (#498): there is no candidate feed, and the taste graph answers category weights rather than a
 * per-place percentage. Everything the card prints beyond the Place itself is nullable or empty for
 * the same reason (#496 distance/rating, #492 the hourly price of the slot domain).
 */
export interface SwipeCandidate {
  place: Place;
  /** «Серебряный Бор · 4-я линия у воды» — where in the city the spot is; null when the venue has no such line. */
  areaLine: string | null;
  /** «Мангальная зона» — what the spot offers, the chip over the photo; null without an offer. */
  offerLabel: string | null;
  /** «2,4 км»; null until the list DTO carries a distance (#496). */
  distanceKm: number | null;
  /** «4.9»; null until the list DTO carries a rating (#496). */
  rating: number | null;
  /** «143 отзыва»; null together with the rating (#496). */
  reviewsCount: number | null;
  /** «800 ₽/час»; null until the slot domain lands (#492). */
  pricePerHourRub: number | null;
  /** «навес от дождя · розетка · мангал и решётки»; empty when the venue lists none. */
  amenities: string[];
  /** «Анна и Дима были здесь»; empty when no friend has. */
  friendsHere: Friend[];
  /** «92% совпадение с тобой», 0..100; null because nothing scores a place against a person yet (#498). */
  matchPercent: number | null;
}

const SwipeCandidatesSchema: ZodSchema<SwipeCandidate[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected a swipe candidate array" };
    const candidates: SwipeCandidate[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) return { success: false as const, error: "invalid swipe candidate" };
      const raw = item as Record<string, unknown>;
      const place = PlaceSchema.safeParse(raw.place);
      const friendsHere = FriendSchema.array().safeParse(raw.friendsHere);
      const amenities = Array.isArray(raw.amenities) && raw.amenities.every((entry) => typeof entry === "string") ? (raw.amenities as string[]) : null;
      if (!place.success || !friendsHere.success || amenities === null) return { success: false as const, error: "invalid swipe candidate" };
      if (!isNullableString(raw.areaLine) || !isNullableString(raw.offerLabel)) return { success: false as const, error: "invalid swipe candidate" };
      if (!isNullableNumber(raw.distanceKm) || !isNullableNumber(raw.rating) || !isNullableNumber(raw.reviewsCount) || !isNullableNumber(raw.pricePerHourRub) || !isNullableNumber(raw.matchPercent)) return { success: false as const, error: "invalid swipe candidate" };
      candidates.push({ place: place.data, areaLine: raw.areaLine, offerLabel: raw.offerLabel, distanceKm: raw.distanceKm, rating: raw.rating, reviewsCount: raw.reviewsCount, pricePerHourRub: raw.pricePerHourRub, amenities, friendsHere: friendsHere.data, matchPercent: raw.matchPercent });
    }
    return { success: true as const, data: candidates };
  },
};

/** Right swipe saves the venue, left one passes on it (макет, экран 09). */
export type SwipeDecision = "like" | "skip";

export function withDiscover<TBase extends ApiMixin>(Base: TBase) {
  return class DiscoverEndpoints extends Base {
    getToday(origin: { latitude: number; longitude: number } | null = null): Promise<TodayDigest> {
      const query = origin === null ? "" : `?${new URLSearchParams({ lat: String(origin.latitude), lng: String(origin.longitude) }).toString()}`;
      return this.request(`/today${query}`, TodayDigestSchema);
    }

    /** The wizard answer of экран 12. The coordinates ride along for the distance of #504; the live endpoint ignores what it does not know. */
    getWhereto(query: WheretoQuery, origin: { latitude: number; longitude: number } | null = null): Promise<WheretoPicks> {
      const params = new URLSearchParams({ company: query.company, mood: query.mood, budget: query.budget });
      if (origin !== null) {
        params.set("lat", String(origin.latitude));
        params.set("lng", String(origin.longitude));
      }
      return this.request(`/whereto?${params.toString()}`, WheretoPicksSchema);
    }

    getNearbyTimeline(latitude: number, longitude: number): Promise<NearbyTimeline> {
      const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
      return this.request(`/nearby?${query.toString()}`, NearbyTimelineSchema);
    }

    getLeisureOptions(query: LeisureQuery): Promise<LeisureChain[]> {
      const params = new URLSearchParams({ hours: String(query.hours), mood: query.mood, latitude: String(query.latitude), longitude: String(query.longitude) });
      return this.request(`/nearby/free?${params.toString()}`, LeisureChainsSchema);
    }

    assistQuery(query: string): Promise<AssistResponse> {
      return this.request("/assist", AssistResponseSchema, { body: { query } });
    }

    assistDay(query: string, save?: boolean): Promise<AssistDayResponse> {
      return this.request("/assist/day", AssistDayResponseSchema, { body: { query, ...(save === undefined ? {} : { save }) } });
    }

    /** The swipe deck of экран 09; GET /discover/swipe. */
    listSwipeCandidates(category: SwipeCategory = "all", origin: { latitude: number; longitude: number } | null = null): Promise<SwipeCandidate[]> {
      const params = new URLSearchParams({ category });
      if (origin !== null) {
        params.set("latitude", String(origin.latitude));
        params.set("longitude", String(origin.longitude));
      }
      return this.request(`/discover/swipe?${params.toString()}`, SwipeCandidatesSchema);
    }

    /** Record one swipe: right saves the venue, left passes. Answers 204. */
    saveSwipeDecision(placeId: string, decision: SwipeDecision): Promise<void> {
      return this.requestVoid(`/discover/swipe/${encodeURIComponent(placeId)}`, { body: { decision } });
    }
  };
}
