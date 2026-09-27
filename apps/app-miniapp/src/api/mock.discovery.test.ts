import { afterEach, describe, expect, it } from "vitest";
import { DiscoveryResponseSchema, FriendPlaceVisitSchema, FriendRouteSchema, PeopleResponseSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { createMockCheckIn, discoverySummary, friendPlaceLayer, friendRoute, installMockApi, mockDemoUser, mockEvents, mockFriendIds, mockPlaces, peopleSuggest, resetMockCheckIns, resetMockProfiles } from "./mock";
import { mockProfiles, profileFor } from "./mock/profile";
import { resetMockCloseAuthors, setMockCloseAuthor } from "./mock/social";

const DEMO_USER_ID = mockDemoUser.id;
const UNKNOWN_UUID = "00000000-0000-4000-8000-000000000000";
const MOSCOW: [number, number] = [55.7522, 37.6156];
const [ANNA, DIMA, KATYA, PETR, , IGOR, LENA] = mockFriendIds;
const [PARK, GMII, , DEPO, VERANDA] = mockPlaces.map((place) => place.id);

describe("discoverySummary mock", () => {
  afterEach(() => {
    resetMockCheckIns();
    resetMockProfiles();
    resetMockCloseAuthors();
  });

  it("passes the contract and counts per-friend unseen places, privacy-gated", () => {
    const summary = discoverySummary();

    expect(DiscoveryResponseSchema.safeParse(summary).success).toBe(true);
    expect(summary.newPlacesCount).toBe(5);
    // Пётр скрыл историю посещений — его строка идёт последней и несёт только состояние (макет, экран 27).
    expect(summary.byFriend.map((entry) => entry.friend.id)).toEqual([ANNA, DIMA, IGOR, KATYA, LENA, PETR]);
    expect(summary.byFriend[0].newPlacesCount).toBe(3);
    expect(summary.byFriend[0].places.map((place) => place.id)).toEqual([GMII, DEPO, VERANDA]);
  });

  it("shows the hidden-history friend as a state rather than dropping the row", () => {
    const petr = discoverySummary().byFriend.find((entry) => entry.friend.id === PETR)!;

    expect(petr).toMatchObject({ visitHistoryHidden: true, newPlacesCount: 0, places: [] });
    expect(
      discoverySummary()
        .byFriend.filter((entry) => entry.visitHistoryHidden)
        .map((entry) => entry.friend.id),
    ).toEqual([PETR]);
  });

  it("keeps the routes-hidden friend with her count but without places", () => {
    const summary = discoverySummary();
    const lena = summary.byFriend.find((entry) => entry.friend.id === LENA)!;

    expect(lena.newPlacesCount).toBe(1);
    expect(lena.places).toEqual([]);
  });

  it("shows a close-friends trail only after that friend marked the viewer close", () => {
    const anna = profileFor(ANNA);
    mockProfiles.set(ANNA, { ...anna, privacy: { ...anna.privacy, routes: "close" } });
    const hidden = discoverySummary().byFriend.find((entry) => entry.friend.id === ANNA)!;

    expect(hidden.newPlacesCount).toBe(3);
    expect(hidden.places).toEqual([]);
    expect(friendRoute(ANNA)).toBe("hidden");
    expect(friendPlaceLayer().flatMap((row) => row.friends.map((friend) => friend.id))).not.toContain(ANNA);

    setMockCloseAuthor(ANNA, true);
    const open = discoverySummary().byFriend.find((entry) => entry.friend.id === ANNA)!;
    expect(open.places.map((place) => place.id)).toEqual([GMII, DEPO, VERANDA]);
    expect(friendRoute(ANNA)).toMatchObject({ friend: { id: ANNA } });
    expect(friendPlaceLayer().flatMap((row) => row.friends.map((friend) => friend.id))).toContain(ANNA);
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

describe("friendPlaceLayer mock", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockCheckIns();
  });

  it("serves every place friends were at, newest visit first, through the contract", async () => {
    restore = installMockApi();
    const layer = await new ApiClient("/api").listFriendPlaces();

    expect(layer.every((row) => FriendPlaceVisitSchema.safeParse(row).success)).toBe(true);
    expect(layer.map((row) => row.place.id)).toEqual([DEPO, GMII, mockPlaces[2].id, VERANDA]);
    // One marker per place, with everyone who was there behind it.
    expect(layer.find((row) => row.place.id === DEPO)!.friends.map((friend) => friend.id)).toEqual([ANNA, DIMA, IGOR]);
    expect(layer.every((row) => row.friends.length > 0)).toBe(true);
  });

  it("keeps a place the demo user has already visited, unlike reverse discovery", () => {
    createMockCheckIn(DEMO_USER_ID, { placeId: DEPO });

    // The summary drops what the viewer has already seen; the map layer is about company, not novelty.
    expect(discoverySummary().byFriend.flatMap((entry) => entry.places.map((place) => place.id))).not.toContain(DEPO);
    expect(friendPlaceLayer().map((row) => row.place.id)).toContain(DEPO);
  });

  it("leaves out a friend who hid her routes, the way the summary withholds her places", () => {
    // Лена is the only visitor of the park, and she hid her routes: the layer has no marker there at all.
    expect(discoverySummary().byFriend.find((entry) => entry.friend.id === LENA)!.places).toEqual([]);
    expect(friendPlaceLayer().some((row) => row.place.id === PARK)).toBe(false);
    expect(friendPlaceLayer().flatMap((row) => row.friends.map((friend) => friend.id))).not.toContain(LENA);
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

    const mock = friendRoute(ANNA) as { friend: unknown; stops: { place: { id: string }; visitedAt: string; note: string }[] };

    // Клиент отдаёт точки с часами и пометкой, а не голый список мест контракта.
    expect(await client().getFriendRoute(ANNA)).toEqual({ friend: mock.friend, stops: mock.stops });
    expect(mock.stops.every((stop) => stop.visitedAt !== null && stop.note !== null)).toBe(true);
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
