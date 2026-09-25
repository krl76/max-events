import { afterEach, describe, expect, it, vi } from "vitest";
import type { Event, FeedPost, Place } from "@max-events/api-contracts";
import { ApiClient, isEndpointMissing, whenEndpointMissing } from "./client";
import { catalogCardsFromEvents, eventCompanionsFrom } from "./endpoints/catalog";
import { feedCardsFromPosts } from "./endpoints/feed";
import { microEventCardFrom } from "./endpoints/social";
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
  logoUrl: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
};

const event: Event = {
  coverUrl: null,
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

describe("whenEndpointMissing", () => {
  it("answers the fallback value for a missing endpoint", async () => {
    expect(await Promise.reject(new ApiError(404, "no such path")).catch(whenEndpointMissing("empty"))).toBe("empty");
  });

  it("lets every other failure stay a failure", async () => {
    await expect(Promise.reject(new ApiError(500, "boom")).catch(whenEndpointMissing("empty"))).rejects.toBeInstanceOf(ApiError);
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

describe("eventCompanionsFrom", () => {
  const stats = {
    counts: { wants_to_go: 2, probably_going: 1, going: 4, looking_for_company: 3, looking_for_travel_buddy: 1, looking_for_after_event_company: 0 },
    friendsCount: 1,
    myStatus: "going" as const,
  };

  it("counts «хотят» and «ищут» the way the aggregate does", () => {
    const companions = eventCompanionsFrom(stats, []);

    expect(companions.counts).toEqual({ going: 4, wants: 3, looking: 4 });
    expect(companions.myStatus).toBe("going");
  });

  it("keeps a friend with their status and claims nothing else about them", () => {
    const friend = { id: AUTHOR_ID, name: "Майя Щукина", avatarUrl: null };

    const [companion] = eventCompanionsFrom(stats, [{ friend, participationStatus: "wants_to_go" }]).companions;

    expect(companion.friend).toEqual(friend);
    expect(companion.status).toBe("wants_to_go");
    expect(companion.chatTitle).toBeNull();
    expect(companion.note).toBeNull();
    expect(companion.interests).toEqual([]);
  });

  it("shows no gathering teaser, because nothing selects the gathering of an event", () => {
    expect(eventCompanionsFrom(stats, []).gathering).toBeNull();
  });
});

describe("microEventCardFrom", () => {
  const authorId = "3f2b1a0c-6666-4000-8000-000000000006";
  const strangerId = "3f2b1a0c-7777-4000-8000-000000000007";
  const micro = {
    id: "3f2b1a0c-8888-4000-8000-000000000008",
    authorId,
    title: "Пикник в Зарядье",
    startsAt: "2026-09-21T20:30:00.000Z",
    locationText: null,
    placeId: PLACE_ID,
    participantsLimit: 8,
    participantsCount: 2,
    participants: [],
    participantIds: [authorId, strangerId],
    status: "open" as const,
    createdAt: "2026-09-18T10:00:00.000Z",
  };
  const friends = [{ id: authorId, name: "Майя Щукина", avatarUrl: null }];

  it("names the participants the friend graph knows and marks the author", () => {
    const card = microEventCardFrom(micro.id, [micro], [place], friends);

    expect(card?.place?.id).toBe(PLACE_ID);
    expect(card?.participants).toEqual([{ friend: friends[0], author: true }]);
    expect(card?.event.participantsCount).toBe(2);
  });

  it("answers null for a gathering the list does not carry", () => {
    expect(microEventCardFrom("3f2b1a0c-9999-4000-8000-000000000009", [micro], [place], friends)).toBeNull();
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

    const cards = await new ApiClient("/api").listEventCards({ category: "sport", sort: "near" }, { latitude: 55.75, longitude: 37.62 });

    expect(cards).toHaveLength(1);
    expect(cards[0].event.id).toBe(EVENT_ID);
    const eventUrls = vi.mocked(fetch).mock.calls.map((call) => String(call[0])).filter((url) => url.includes("/api/events?"));
    expect(eventUrls.some((url) => url.includes("lat=55.75") && url.includes("lng=37.62") && url.includes("sort=near"))).toBe(true);
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
