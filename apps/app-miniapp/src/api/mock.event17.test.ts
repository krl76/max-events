import { describe, expect, it } from "vitest";
import { bookingOfferFor, eventCompanions, eventForecast, eventMoodTags, eventNearby, mockDemoUser, mockEvents, mockPlaces, resetMockParticipations } from "./mock";

// Субботник в Парке Горького: единственная фикстура со снимком погоды и площадкой, вокруг которой есть соседи.
const PARK_EVENT = mockEvents[2];
const CONCERT_EVENT = mockEvents[0];
const UNKNOWN_ID = "c9999999-0000-4000-8000-000000000999";

describe("eventForecast", () => {
  it("builds five columns from the stored snapshot and credits Open-Meteo", () => {
    const forecast = eventForecast(PARK_EVENT.id);

    expect(forecast?.source).toBe("Open-Meteo");
    expect(forecast?.hours).toHaveLength(5);
    expect(forecast?.hours[0].temperatureC).toBe(12);
    expect(forecast?.hours[4].temperatureC).toBeLessThan(forecast!.hours[0].temperatureC);
  });

  it("steps two hours per column and marks the ones past the event end", () => {
    const hours = eventForecast(PARK_EVENT.id)?.hours ?? [];
    const step = new Date(hours[1].at).getTime() - new Date(hours[0].at).getTime();

    expect(step).toBe(2 * 60 * 60 * 1000);
    expect(hours[0].withinEvent).toBe(true);
    expect(hours[4].withinEvent).toBe(false);
  });

  it("stays silent about rain the snapshot does not expect", () => {
    // Субботник: вероятность осадков 40%, ниже порога — предупреждения нет.
    expect(eventForecast(PARK_EVENT.id)?.note).toBeNull();
    expect(eventForecast(UNKNOWN_ID)).toBeNull();
  });
});

describe("eventMoodTags", () => {
  it("counts the tags down from the participations and keeps the design order", () => {
    resetMockParticipations();
    const tags = eventMoodTags(CONCERT_EVENT.id) ?? [];

    expect(tags.map((tag) => tag.label)).toEqual(["Спокойно", "С детьми ок", "Новичкам легко"]);
    expect(tags[0].count).toBeGreaterThanOrEqual(tags[1].count);
    expect(tags[1].count).toBeGreaterThanOrEqual(tags[2].count);
  });

  it("answers an empty list for an event nobody reacted to, rather than three zeros", () => {
    resetMockParticipations();

    expect(eventMoodTags(mockEvents[8].id)).toEqual([]);
    expect(eventMoodTags(UNKNOWN_ID)).toBeNull();
  });
});

describe("eventNearby", () => {
  it("lists the venues within walking distance of the event venue, nearest first", () => {
    const spots = eventNearby(PARK_EVENT.id) ?? [];

    expect(spots.length).toBeGreaterThan(0);
    expect(spots.map((spot) => spot.id)).not.toContain(mockPlaces[0].id);
    expect(spots[0].distanceM).toBeLessThanOrEqual(spots[spots.length - 1].distanceM);
  });

  it("has nothing to be near without a venue", () => {
    expect(eventNearby(CONCERT_EVENT.id)).toEqual([]);
    expect(eventNearby(UNKNOWN_ID)).toBeNull();
  });
});

describe("eventCompanions", () => {
  it("counts the three tabs from the participations and lists the friends behind them", () => {
    resetMockParticipations();
    const companions = eventCompanions(CONCERT_EVENT.id, mockDemoUser.id);

    expect(companions?.counts.going).toBe(1);
    expect(companions?.counts.wants).toBe(2);
    expect(companions?.counts.looking).toBe(4);
    expect(companions?.companions).toHaveLength(7);
  });

  it("keys the interest matches to the person, so the same row reads the same twice", () => {
    resetMockParticipations();
    const first = eventCompanions(CONCERT_EVENT.id, mockDemoUser.id)?.companions[0];
    const again = eventCompanions(CONCERT_EVENT.id, mockDemoUser.id)?.companions[0];

    expect(first?.matchesCount).toBe(again?.matchesCount);
    expect(first?.interests).toEqual(again?.interests);
  });

  it("raises the gathering teaser only once enough people are in", () => {
    resetMockParticipations();

    expect(eventCompanions(CONCERT_EVENT.id, mockDemoUser.id)?.gathering?.extraCount).toBe(5);
    expect(eventCompanions(mockEvents[4].id, mockDemoUser.id)?.gathering).toBeNull();
    expect(eventCompanions(UNKNOWN_ID, mockDemoUser.id)).toBeNull();
  });
});

describe("bookingOfferFor", () => {
  it("reports an empty queue and the friends holding tickets on a paid event", () => {
    resetMockParticipations();
    const offer = bookingOfferFor(CONCERT_EVENT.id, mockDemoUser.id);

    expect(offer?.waitlistAhead).toBe(0);
    expect(offer?.friendsWithTickets.map((friend) => friend.name)).toEqual(["Катя Орлова"]);
  });

  it("counts nobody as a ticket holder on a free event and 404s an unknown one", () => {
    resetMockParticipations();

    expect(bookingOfferFor(PARK_EVENT.id, mockDemoUser.id)?.friendsWithTickets).toEqual([]);
    expect(bookingOfferFor(UNKNOWN_ID, mockDemoUser.id)).toBeNull();
  });
});
