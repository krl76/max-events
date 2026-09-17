import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, parseEventFilters, serializeEventFilters } from "./client";
import type { Event } from "@max-events/api-contracts";

function mockFetchOnce(ok: boolean, status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

/** Stub fetch capturing the RequestInit (second arg) of the last call. */
function mockFetchCaptured(body: unknown): () => RequestInit | undefined {
  let lastInit: RequestInit | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      lastInit = init;
      return { ok: true, status: 201, json: () => Promise.resolve(body) };
    }),
  );
  return () => lastInit;
}

const validEvent: Event = {
  id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  title: "Concert",
  description: "",
  category: "afisha",
  city: "Moscow",
  placeId: null,
  startsAt: "2026-09-11T10:00:00.000Z",
  endsAt: null,
  isPaid: false,
  priceRub: null,
  paymentUrl: null,
  capacity: null,
  chatLink: null,
};

describe("ApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a valid GET response into the contract type", async () => {
    mockFetchOnce(true, 200, validEvent);
    const client = new ApiClient("http://localhost:3100/api");

    const event = await client.getEvent(validEvent.id);

    expect(event).toEqual(validEvent);
    expect(event.id).toBe(validEvent.id);
  });

  it("throws ApiError with status on HTTP error response", async () => {
    mockFetchOnce(false, 500, { message: "boom" });
    const client = new ApiClient("http://localhost:3100/api");

    await expect(client.getEvent(validEvent.id)).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
    });
  });

  it("throws ApiError on invalid payload body", async () => {
    mockFetchOnce(true, 200, { id: "not-a-uuid", title: "x" });
    const client = new ApiClient("http://localhost:3100/api");

    await expect(client.getEvent(validEvent.id)).rejects.toMatchObject({
      name: "ApiError",
    });
  });

  it("throws ApiError on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const client = new ApiClient("http://localhost:3100/api");

    await expect(client.getEvent(validEvent.id)).rejects.toMatchObject({
      name: "ApiError",
    });
  });

  it("sends content-type application/json on a POST with body", async () => {
    const getInit = mockFetchCaptured(validEvent);
    const client = new ApiClient("http://localhost:3100/api");

    await client.createEvent({
      title: "Concert",
      description: "",
      category: "afisha",
      city: "Moscow",
      placeId: null,
      startsAt: "2026-09-11T10:00:00.000Z",
      endsAt: null,
      isPaid: false,
      priceRub: null,
      paymentUrl: null,
      capacity: null,
    });

    const init = getInit();
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      title: "Concert",
      description: "",
      category: "afisha",
      city: "Moscow",
      placeId: null,
      startsAt: "2026-09-11T10:00:00.000Z",
      endsAt: null,
      isPaid: false,
      priceRub: null,
      paymentUrl: null,
      capacity: null,
    });
    expect(init?.headers).toMatchObject({ "content-type": "application/json" });
  });

  it("omits content-type header on GET without body", async () => {
    const getInit = mockFetchCaptured(validEvent);
    const client = new ApiClient("http://localhost:3100/api");

    await client.getEvent(validEvent.id);

    expect(getInit()?.headers).not.toMatchObject({ "content-type": "application/json" });
  });

  it("logs in via POST /auth/login and returns the authenticated user", async () => {
    const user = {
      id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      maxUserId: "1001",
      firstName: "Иван",
      lastName: null,
      avatarUrl: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    const getInit = mockFetchCaptured({ user });
    const client = new ApiClient("http://localhost:3100/api");

    const response = await client.login({ initData: "user=%7B%22id%22%3A1%7D" });

    expect(response.user).toEqual(user);
    expect(getInit()?.method).toBe("POST");
    expect(JSON.parse(String(getInit()?.body))).toEqual({ initData: "user=%7B%22id%22%3A1%7D" });
  });
});

describe("ApiClient.listEvents", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetchCaptureUrls(): string[] {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        urls.push(url);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }),
    );
    return urls;
  }

  it("requests /events with the serialized filter params", async () => {
    const urls = mockFetchCaptureUrls();
    const client = new ApiClient("http://localhost:3100/api");

    await client.listEvents({ category: "sport", city: "Москва", date: "2026-09-20" });

    const url = new URL(urls[0]);
    expect(url.pathname).toBe("/api/events");
    expect(url.searchParams.get("category")).toBe("sport");
    expect(url.searchParams.get("city")).toBe("Москва");
    expect(url.searchParams.get("date")).toBe("2026-09-20");
  });

  it("requests /events without a query when filters are empty", async () => {
    const urls = mockFetchCaptureUrls();
    const client = new ApiClient("http://localhost:3100/api");

    await client.listEvents({});

    expect(urls[0]).toBe("http://localhost:3100/api/events");
  });

  it("rejects with ApiError when the list payload is not an array", async () => {
    mockFetchOnce(true, 200, { items: [] });
    const client = new ApiClient("http://localhost:3100/api");

    await expect(client.listEvents()).rejects.toMatchObject({ name: "ApiError" });
  });
});

describe("ApiClient.profile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const profile = { userId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", city: "Москва", interests: ["бег"] };

  it("patches the profile with method PATCH, a JSON body and content-type", async () => {
    const getInit = mockFetchCaptured(profile);
    const client = new ApiClient("http://localhost:3100/api");

    const saved = await client.updateProfile(profile.userId, { city: "Казань" });

    expect(saved).toEqual(profile);
    expect(getInit()?.method).toBe("PATCH");
    expect(JSON.parse(String(getInit()?.body))).toEqual({ city: "Казань" });
    expect(getInit()?.headers).toMatchObject({ "content-type": "application/json" });
  });

  it("rejects an invalid profile payload", async () => {
    mockFetchOnce(true, 200, { userId: "not-a-uuid", city: "Москва" });
    const client = new ApiClient("http://localhost:3100/api");

    await expect(client.updateProfile(profile.userId, { interests: [] })).rejects.toMatchObject({ name: "ApiError" });
  });
});

describe("ApiClient.listCalendar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests /bookings with the userId query param", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        urls.push(url);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }),
    );
    const client = new ApiClient("http://localhost:3100/api");

    const entries = await client.listCalendar("u-1");

    expect(entries).toEqual([]);
    expect(urls[0]).toBe("http://localhost:3100/api/bookings?userId=u-1");
  });

  it("parses a valid calendar entry payload", async () => {
    const event = validEvent;
    const booking = {
      id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
      userId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      eventId: event.id,
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    mockFetchOnce(true, 200, [{ booking, event, place: null }]);
    const client = new ApiClient("http://localhost:3100/api");

    const entries = await client.listCalendar("u-1");

    expect(entries).toEqual([{ booking, event, place: null }]);
  });

  it("rejects a payload with an invalid entry", async () => {
    mockFetchOnce(true, 200, [{ booking: {}, event: {}, place: null }]);
    const client = new ApiClient("http://localhost:3100/api");

    await expect(client.listCalendar("u-1")).rejects.toMatchObject({ name: "ApiError" });
  });
});

describe("event filter serialization", () => {
  it("serializes set filters into a query string", () => {
    expect(serializeEventFilters({ category: "sport", city: "Москва", date: "2026-09-20" })).toBe("category=sport&city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0&date=2026-09-20");
  });

  it("omits empty filters from the query string", () => {
    expect(serializeEventFilters({})).toBe("");
    expect(serializeEventFilters({ city: "" })).toBe("");
  });

  it("parses valid filter params", () => {
    expect(parseEventFilters("?category=sport&city=Москва&date=2026-09-20")).toEqual({
      category: "sport",
      city: "Москва",
      date: "2026-09-20",
    });
  });

  it("drops unknown category values and malformed dates, trims the city", () => {
    expect(parseEventFilters("?category=everything&date=yesterday&city=  Тула ")).toEqual({ city: "Тула" });
    expect(parseEventFilters("")).toEqual({});
  });
});
