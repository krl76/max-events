import { afterEach, describe, expect, it } from "vitest";
import { LeisureOptionSchema, NearbyTimelineSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { installMockApi, leisureOptions, mockEvents, mockPlaces, nearbyTimeline } from "./mock";

const MOSCOW: [number, number] = [55.7522, 37.6156];
const COFFEE_MARKET = "c0000010-0000-4000-8000-000000000010";
const LECTURE = "c0000011-0000-4000-8000-000000000011";
const CONCERT = "c000000f-0000-4000-8000-00000000000f";
const YOGA = "c000000a-0000-4000-8000-00000000000a";

describe("nearbyTimeline mock", () => {
  it("passes the contract and splits fixtures into the four buckets relative to the demo now", () => {
    const timeline = nearbyTimeline(...MOSCOW);

    expect(NearbyTimelineSchema.safeParse(timeline).success).toBe(true);
    expect(timeline.now.map((card) => card.event.id)).toEqual([COFFEE_MARKET]);
    expect(timeline.inAnHour.map((card) => card.event.id)).toEqual([LECTURE]);
    expect(timeline.evening.map((card) => card.event.id)).toEqual([CONCERT]);
    expect(timeline.tomorrow.map((card) => card.event.id)).toEqual([YOGA]);
  });

  it("computes a plausible haversine distance per card", () => {
    const timeline = nearbyTimeline(...MOSCOW);
    const cards = [...timeline.now, ...timeline.inAnHour, ...timeline.evening, ...timeline.tomorrow];

    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.distanceKm).toBeGreaterThan(0);
      expect(card.distanceKm).toBeLessThanOrEqual(15);
      expect(Math.round(card.distanceKm * 10) / 10).toBe(card.distanceKm);
    }
    const parkCard = timeline.evening[0];
    expect(parkCard.place.id).toBe(mockPlaces[0].id);
    expect(parkCard.distanceKm).toBeLessThan(5);
  });

  it("puts the promoted card first in its bucket", () => {
    const timeline = nearbyTimeline(...MOSCOW);

    expect(timeline.now[0].promoted).toBe(true);
    expect(mockEvents.find((item) => item.id === timeline.now[0].event.id)?.promoted).toBe(true);
  });
});

describe("leisureOptions mock", () => {
  it("builds the relax chain park -> event -> food inside the window", () => {
    const options = leisureOptions(3, "relax", ...MOSCOW);

    expect(options).toHaveLength(1);
    const option = options[0];
    expect(LeisureOptionSchema.safeParse(option).success).toBe(true);
    expect(option.mood).toBe("relax");
    expect(option.title).toBe(option.stops.map((stop) => stop.title).join(" → "));
    expect(option.stops.map((stop) => stop.kind)).toEqual(["place", "event", "place"]);
    expect(option.stops[0].placeId).toBe(mockPlaces[0].id);
    expect(option.stops[1].eventId).toBe(COFFEE_MARKET);
    expect(option.stops[1].startsAt).not.toBeNull();
  });

  it("builds the active chain from sport/park places when no sport event fits the window", () => {
    const options = leisureOptions(2, "active", ...MOSCOW);

    expect(options).toHaveLength(1);
    expect(options[0].stops.every((stop) => stop.kind === "place")).toBe(true);
    expect(options[0].stops.map((stop) => stop.placeId)).toEqual([mockPlaces[2].id, mockPlaces[0].id]);
  });

  it("builds the friends chain from the window events, soonest first", () => {
    const options = leisureOptions(8, "friends", ...MOSCOW);

    expect(options).toHaveLength(1);
    expect(options[0].stops.map((stop) => stop.eventId)).toEqual([COFFEE_MARKET, LECTURE, CONCERT]);
  });

  it("shortens the friends chain when the window is tight", () => {
    const options = leisureOptions(1, "friends", ...MOSCOW);

    expect(options).toHaveLength(1);
    expect(options[0].stops).toHaveLength(1);
  });
});

describe("nearby mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
  });

  const client = () => new ApiClient("/api");

  it("serves the timeline through the typed client", async () => {
    restore = installMockApi();

    const timeline = await client().getNearbyTimeline(...MOSCOW);

    expect(timeline).toEqual(nearbyTimeline(...MOSCOW));
  });

  it("rejects broken coordinates with 400, mirroring the backend", async () => {
    restore = installMockApi();

    await expect(client().getNearbyTimeline(Number("not-a-lat"), 0)).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(client().getNearbyTimeline(91, 0)).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("serves leisure options through the typed client", async () => {
    restore = installMockApi();

    const options = await client().getLeisureOptions({ hours: 3, mood: "relax", latitude: MOSCOW[0], longitude: MOSCOW[1] });

    expect(options).toEqual(leisureOptions(3, "relax", ...MOSCOW));
  });

  it("rejects broken hours and mood with 400, mirroring the backend", async () => {
    restore = installMockApi();
    const api = client();

    await expect(api.getLeisureOptions({ hours: 9, mood: "relax", latitude: MOSCOW[0], longitude: MOSCOW[1] })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(api.getLeisureOptions({ hours: 2.5, mood: "relax", latitude: MOSCOW[0], longitude: MOSCOW[1] })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(api.getLeisureOptions({ hours: 3, mood: "party" as never, latitude: MOSCOW[0], longitude: MOSCOW[1] })).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });
});
