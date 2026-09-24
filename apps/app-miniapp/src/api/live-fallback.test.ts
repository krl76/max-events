import { afterEach, describe, expect, it, vi } from "vitest";
import type { Event, FeedPost, Place } from "@max-events/api-contracts";
import { ApiClient, isEndpointMissing } from "./client";
import { catalogCardsFromEvents } from "./endpoints/catalog";
import { feedCardsFromPosts } from "./endpoints/feed";
import { ApiError } from "./endpoints/transport";

const PLACE_ID = "3f2b1a0c-1111-4000-8000-000000000001";
const EVENT_ID = "3f2b1a0c-2222-4000-8000-000000000002";
const POST_ID = "3f2b1a0c-3333-4000-8000-000000000003";
const AUTHOR_ID = "3f2b1a0c-4444-4000-8000-000000000004";

const place: Place = {
  id: PLACE_ID,
  title: "Парк Горького",
  address: "Крымский Вал, 9",
  city: "Москва",
  category: "park",
  latitude: 55.729,
  longitude: 37.601,
  published: true,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
};

const event: Event = {
  id: EVENT_ID,
  title: "Кроссфит на воздухе",
  description: "",
  category: "sport",
  city: "Москва",
  placeId: PLACE_ID,
  startsAt: "2026-09-20T17:00:00.000Z",
  endsAt: "2026-09-20T19:00:00.000Z",
  isPaid: false,
  priceRub: null,
  paymentUrl: null,
  capacity: null,
  chatLink: null,
  promoted: false,
  published: true,
  bookingOpensAt: null,
  weather: null,
};

const post: FeedPost = {
  id: POST_ID,
  author: { id: AUTHOR_ID, name: "Майя Щукина", avatarUrl: null },
  eventId: EVENT_ID,
  text: "Только вернулись — до сих пор под впечатлением.",
  photoUrl: null,
  likesCount: 3,
  likedByMe: false,
  comments: [{ id: "3f2b1a0c-5555-4000-8000-000000000005", author: { id: AUTHOR_ID, name: "Дима", avatarUrl: null }, text: "буду к трём" }],
};

/** Routes fetch by path suffix; a path with no route answers 404, the way an unrouted Nest path does. */
function routeFetch(routes: Record<string, unknown>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      const path = new URL(url, "http://localhost").pathname;
      const body = routes[path];
      if (body === undefined) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ message: `Cannot GET ${path}` }) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    }),
  );
}

describe("isEndpointMissing", () => {
  it("is true only for a 404 from the api", () => {
    expect(isEndpointMissing(new ApiError(404, "no such path"))).toBe(true);
    expect(isEndpointMissing(new ApiError(500, "boom"))).toBe(false);
    expect(isEndpointMissing(new Error("network"))).toBe(false);
  });
});

describe("feedCardsFromPosts", () => {
  const now = new Date("2026-09-20T18:00:00.000Z");

  it("keeps the post, its event and its venue, and leaves what no endpoint answers empty", () => {
    const [card] = feedCardsFromPosts([post], [event], [place], now);

    expect(card.id).toBe(POST_ID);
    expect(card.event).toEqual(event);
    expect(card.placeTitle).toBe("Парк Горького");
    expect(card.text).toBe(post.text);
    expect(card.likesCount).toBe(3);
    expect(card.commentsCount).toBe(1);
    expect(card.distanceKm).toBeNull();
    expect(card.myStatus).toBeNull();
    expect(card.publishedAt).toBeNull();
    expect(card.hit).toBe(false);
    expect(card.counts).toEqual({ wantsToGo: null, going: null, waitlist: null, freeSeats: null });
  });

  it("marks an event live only while it is running", () => {
    const before = feedCardsFromPosts([post], [event], [place], new Date("2026-09-20T16:00:00.000Z"));
    const during = feedCardsFromPosts([post], [event], [place], now);
    const openEnded = feedCardsFromPosts([post], [{ ...event, endsAt: null }], [place], now);

    expect(before[0].live).toBe(false);
    expect(during[0].live).toBe(true);
    expect(openEnded[0].live).toBe(false);
  });

  it("drops a post whose event the listing does not carry", () => {
    expect(feedCardsFromPosts([post], [], [place], now)).toEqual([]);
  });
});

describe("catalogCardsFromEvents", () => {
  it("carries the venue line and admits it can measure neither distance nor rating", () => {
    const [card] = catalogCardsFromEvents([event], [place]);

    expect(card.event).toEqual(event);
    expect(card.placeTitle).toBe("Парк Горького");
    expect(card.distanceKm).toBeNull();
    expect(card.rating).toBeNull();
  });

  it("leaves the venue line empty for an event without a place", () => {
    expect(catalogCardsFromEvents([{ ...event, placeId: null }], [place])[0].placeTitle).toBeNull();
  });
});

describe("ApiClient against a backend without the card endpoints", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the home feed out of /feed, /events and /places", async () => {
    routeFetch({ "/api/feed": [post], "/api/events": [event], "/api/places": [place] });

    const cards = await new ApiClient("/api").listFeedCards(AUTHOR_ID);

    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe("friend");
    expect(cards[0].id).toBe(POST_ID);
  });

  it("builds the catalog cards out of /events and /places", async () => {
    routeFetch({ "/api/events": [event], "/api/places": [place] });

    const cards = await new ApiClient("/api").listEventCards({ category: "sport" });

    expect(cards).toHaveLength(1);
    expect(cards[0].event.id).toBe(EVENT_ID);
  });

  it("falls back on the 400 a server without /events/cards answers to the uuid pipe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const path = new URL(url, "http://localhost").pathname;
        if (path === "/api/events/cards") return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ message: "Validation failed (uuid is expected)" }) });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(path === "/api/places" ? [place] : [event]) });
      }),
    );

    expect(await new ApiClient("/api").listEventCards()).toHaveLength(1);
  });

  it("does not paper over a server that answers 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ message: "boom" }) }));

    await expect(new ApiClient("/api").listFeedCards(AUTHOR_ID)).rejects.toBeInstanceOf(ApiError);
  });
});
