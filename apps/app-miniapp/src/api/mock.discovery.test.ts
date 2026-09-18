import { afterEach, describe, expect, it } from "vitest";
import { DiscoveryResponseSchema, FriendRouteSchema, PeopleResponseSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { createMockCheckIn, discoverySummary, friendRoute, installMockApi, mockDemoUser, mockEvents, mockFriendIds, mockPlaces, peopleSuggest, resetMockCheckIns } from "./mock";

const DEMO_USER_ID = mockDemoUser.id;
const UNKNOWN_UUID = "00000000-0000-4000-8000-000000000000";
const MOSCOW: [number, number] = [55.7522, 37.6156];
const [ANNA, DIMA, KATYA, , , IGOR, LENA] = mockFriendIds;
const [PARK, GMII, , DEPO, VERANDA] = mockPlaces.map((place) => place.id);

describe("discoverySummary mock", () => {
  afterEach(() => {
    resetMockCheckIns();
  });

  it("passes the contract and counts per-friend unseen places, privacy-gated", () => {
    const summary = discoverySummary();

    expect(DiscoveryResponseSchema.safeParse(summary).success).toBe(true);
    expect(summary.newPlacesCount).toBe(5);
    expect(summary.byFriend.map((entry) => entry.friend.id)).toEqual([ANNA, DIMA, IGOR, KATYA, LENA]);
    expect(summary.byFriend[0].newPlacesCount).toBe(3);
    expect(summary.byFriend[0].places.map((place) => place.id)).toEqual([GMII, DEPO, VERANDA]);
  });

  it("keeps the routes-hidden friend with her count but without places", () => {
    const summary = discoverySummary();
    const lena = summary.byFriend.find((entry) => entry.friend.id === LENA)!;

    expect(lena.newPlacesCount).toBe(1);
    expect(lena.places).toEqual([]);
  });

  it("drops the demo user's check-in places from every friend list", () => {
    createMockCheckIn(DEMO_USER_ID, { placeId: DEPO });
    const summary = discoverySummary();

    expect(summary.newPlacesCount).toBe(4);
    const anna = summary.byFriend.find((entry) => entry.friend.id === ANNA)!;
    expect(anna.places.map((place) => place.id)).toEqual([GMII, VERANDA]);
    expect(summary.byFriend.some((entry) => entry.friend.id === IGOR)).toBe(false);
  });
});

describe("friendRoute mock", () => {
  afterEach(() => {
    resetMockCheckIns();
  });

  it("returns the chronological unseen trail of a friend", () => {
    const route = friendRoute(ANNA);

    expect(route).toMatchObject({ friend: { id: ANNA } });
    expect(FriendRouteSchema.safeParse(route).success).toBe(true);
    expect((route as { places: { id: string }[] }).places.map((place) => place.id)).toEqual([GMII, DEPO, VERANDA]);
  });

  it("flags own route, unknown friends and hidden routes", () => {
    expect(friendRoute(DEMO_USER_ID)).toBe("own");
    expect(friendRoute(UNKNOWN_UUID)).toBe("not_friend");
    expect(friendRoute(LENA)).toBe("hidden");
  });
});

describe("peopleSuggest mock", () => {
  it("passes the contract and matches friends on interests and a shared event", () => {
    const response = peopleSuggest(...MOSCOW);

    expect(PeopleResponseSchema.safeParse(response).success).toBe(true);
    expect(response.people.map((candidate) => candidate.person.id)).toEqual([KATYA, ANNA, IGOR, mockFriendIds[4], mockFriendIds[3]]);
    expect(response.nearbyCount).toBe(response.people.length);
  });

  it("builds the shared_event context for the common event and shared_interest otherwise", () => {
    const response = peopleSuggest(...MOSCOW);
    const katya = response.people.find((candidate) => candidate.person.id === KATYA)!;
    const anna = response.people.find((candidate) => candidate.person.id === ANNA)!;

    expect(katya.context).toMatchObject({ kind: "shared_event", event: { id: mockEvents[11].id } });
    expect(katya.context.explanation).toContain("вы оба хотите на");
    expect(anna.context).toMatchObject({ kind: "shared_interest", interest: "музыка" });
  });

  it("computes haversine distances from the requested coords and null for friends without visits", () => {
    const response = peopleSuggest(...MOSCOW);
    const byId = new Map(response.people.map((candidate) => [candidate.person.id, candidate]));

    expect(byId.get(KATYA)!.distanceKm).toBe(1);
    expect(byId.get(ANNA)!.distanceKm).toBe(2.4);
    expect(byId.get(IGOR)!.distanceKm).toBe(3);
    expect(byId.get(mockFriendIds[3])!.distanceKm).toBeNull();
    for (const candidate of response.people) {
      if (candidate.distanceKm !== null) expect(candidate.distanceKm).toBeLessThanOrEqual(15);
    }
  });

  it("excludes friends without overlap and counts the looking-for-company-today flags", () => {
    const response = peopleSuggest(...MOSCOW);

    expect(response.people.some((candidate) => candidate.person.id === DIMA)).toBe(false);
    expect(response.people.some((candidate) => candidate.person.id === LENA)).toBe(false);
    expect(response.lookingForCompanyTodayCount).toBe(2);
    expect(response.people.filter((candidate) => candidate.lookingForCompanyToday)).toHaveLength(2);
  });
});

describe("discovery and people mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockCheckIns();
  });

  const client = () => new ApiClient("/api");

  it("serves the discovery summary through the typed client", async () => {
    restore = installMockApi();

    expect(await client().getDiscovery()).toEqual(discoverySummary());
  });

  it("serves the friend route through the typed client", async () => {
    restore = installMockApi();

    expect(await client().getFriendRoute(ANNA)).toEqual(friendRoute(ANNA));
  });

  it("mirrors the backend route errors: own 403, unknown 404, hidden 403, broken uuid 400", async () => {
    restore = installMockApi();
    const api = client();

    await expect(api.getFriendRoute(DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 403 });
    await expect(api.getFriendRoute(UNKNOWN_UUID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.getFriendRoute(LENA)).rejects.toMatchObject({ name: "ApiError", status: 403 });
    await expect(api.getFriendRoute("not-a-uuid")).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("reflects a fresh check-in of the demo user in the next summary", async () => {
    restore = installMockApi();
    const api = client();

    await api.createCheckIn({ userId: DEMO_USER_ID, placeId: PARK });
    const summary = await api.getDiscovery();

    expect(summary.newPlacesCount).toBe(4);
    expect(summary.byFriend.every((entry) => entry.places.every((place) => place.id !== PARK))).toBe(true);
  });

  it("serves people matching through the typed client, with and without explicit coords", async () => {
    restore = installMockApi();
    const api = client();

    expect(await api.getPeople({ latitude: MOSCOW[0], longitude: MOSCOW[1] })).toEqual(peopleSuggest(...MOSCOW));
    expect(await api.getPeople()).toEqual(peopleSuggest(...MOSCOW));
  });

  it("rejects a broken geo query with 400, mirroring the backend parseOrigin", async () => {
    restore = installMockApi();
    const api = client();

    await expect(api.getPeople({ latitude: Number("not-a-lat"), longitude: 0 })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(api.getPeople({ latitude: 91, longitude: 0 })).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("rejects a partial geo query with only lat", async () => {
    restore = installMockApi();

    expect((await fetch("/api/people?lat=55.75")).status).toBe(400);
  });

  it("rejects a partial geo query with only lng", async () => {
    restore = installMockApi();

    expect((await fetch("/api/people?lng=37.6")).status).toBe(400);
  });
});
