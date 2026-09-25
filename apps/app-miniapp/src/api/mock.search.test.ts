import { afterEach, describe, expect, it } from "vitest";
import { ApiClient } from "./client";
import { catalogCards, installMockApi, mapWeatherFor, mockPlaces, recordSwipeDecision, resetMockSwipeDecisions, swipeCandidates, travelOptionsFor } from "./mock";

const ORIGIN = { latitude: 55.7522, longitude: 37.6156 };

afterEach(() => {
  resetMockSwipeDecisions();
});

describe("catalog cards", () => {
  it("measures a distance for every event that has a venue and stays silent for the rest", () => {
    for (const card of catalogCards({}, ORIGIN)) {
      expect(card.distanceKm === null).toBe(card.event.placeId === null);
      expect(card.placeTitle === null).toBe(card.event.placeId === null);
    }
  });

  it("answers no distance at all when the request carries no coordinates", () => {
    expect(catalogCards({}).every((card) => card.distanceKm === null)).toBe(true);
  });

  it("searches the title, the description, the city and the venue name", () => {
    const byTitle = catalogCards({ query: "Рахманинова" }, ORIGIN);
    expect(byTitle).toHaveLength(1);
    expect(byTitle[0].event.title).toContain("Рахманинов");
    expect(catalogCards({ query: "Крымский Вал" }, ORIGIN).length).toBeGreaterThan(0);
    expect(catalogCards({ query: "москва" }, ORIGIN).length).toBeGreaterThan(0);
    expect(catalogCards({ query: "несуществующий-запрос" }, ORIGIN)).toEqual([]);
  });

  it("orders by distance, by rating or by start time, depending on the sort asked for", () => {
    const near = catalogCards({ sort: "near" }, ORIGIN).map((card) => card.distanceKm ?? Number.POSITIVE_INFINITY);
    expect([...near].sort((a, b) => a - b)).toEqual(near);

    const rated = catalogCards({ sort: "rating" }, ORIGIN).map((card) => card.rating ?? -1);
    expect([...rated].sort((a, b) => b - a)).toEqual(rated);

    const soon = catalogCards({ sort: "soon" }, ORIGIN).map((card) => card.event.startsAt);
    expect([...soon].sort()).toEqual(soon);
  });

  it("serves the cards through the typed client", async () => {
    const restore = installMockApi();
    try {
      expect(await new ApiClient("/api").listEventCards({ sort: "near" }, ORIGIN)).toEqual(catalogCards({ sort: "near" }, ORIGIN));
    } finally {
      restore();
    }
  });
});

describe("map weather and travel", () => {
  it("answers the temperature now and the change to come", () => {
    const weather = mapWeatherFor();

    expect(weather.temperatureC).toBe(19);
    expect(weather.changesTo).toBe("дождь");
    expect(weather.changesAt).not.toBeNull();
  });

  it("estimates walking and metro from the distance, with an interchange past the first kilometre", () => {
    const options = travelOptionsFor(mockPlaces[2].id, ORIGIN)!;
    const walk = options.find((option) => option.mode === "walk")!;
    const metro = options.find((option) => option.mode === "metro")!;

    expect(walk.transfers).toBeNull();
    expect(walk.minutes).toBeGreaterThan(metro.minutes);
    expect(metro.transfers).toBe(walk.distanceKm! > 1 ? 1 : 0);
    expect(travelOptionsFor("no-such-place", ORIGIN)).toBeNull();
  });

  it("serves both through the typed client", async () => {
    const restore = installMockApi();
    try {
      const client = new ApiClient("/api");
      expect(await client.getMapWeather("Москва")).toEqual(mapWeatherFor());
      expect(await client.getTravelOptions(mockPlaces[0].id, ORIGIN)).toEqual(travelOptionsFor(mockPlaces[0].id, ORIGIN));
    } finally {
      restore();
    }
  });
});

describe("swipe deck", () => {
  it("orders the deck by the match score and keeps every venue of the chosen category", () => {
    const scores = swipeCandidates("all", ORIGIN).map((candidate) => candidate.matchPercent ?? -1);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(swipeCandidates("food", ORIGIN).every((candidate) => candidate.place.category === "food")).toBe(true);
    expect(swipeCandidates("outdoors", ORIGIN).every((candidate) => candidate.place.category === "park")).toBe(true);
  });

  it("drops a venue from the deck once it has been judged", () => {
    const before = swipeCandidates("all", ORIGIN);
    expect(recordSwipeDecision(before[0].place.id, "like")).toBe(true);
    const after = swipeCandidates("all", ORIGIN);

    expect(after).toHaveLength(before.length - 1);
    expect(after.some((candidate) => candidate.place.id === before[0].place.id)).toBe(false);
    expect(recordSwipeDecision("no-such-place", "skip")).toBe(false);
  });

  it("carries the amenities, the friends and the match score the card prints", () => {
    const top = swipeCandidates("all", ORIGIN)[0];

    expect(top.amenities.length).toBeGreaterThan(0);
    expect(top.friendsHere.length).toBeGreaterThan(0);
    expect(top.matchPercent).toBeGreaterThan(0);
    expect(top.distanceKm).not.toBeNull();
  });

  it("serves the deck and takes a decision through the typed client", async () => {
    const restore = installMockApi();
    try {
      const client = new ApiClient("/api");
      const deck = await client.listSwipeCandidates("all", ORIGIN);
      expect(deck).toEqual(swipeCandidates("all", ORIGIN));

      await client.saveSwipeDecision(deck[0].place.id, "skip");
      expect(await client.listSwipeCandidates("all", ORIGIN)).toHaveLength(deck.length - 1);
    } finally {
      restore();
    }
  });
});
