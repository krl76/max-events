import { afterEach, describe, expect, it } from "vitest";
import { MemoryPointSchema, MyCitySummarySchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { createMockCheckIn, installMockApi, mockEvents, mockPlaces, myCityFor, resetMockCheckIns } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

function checkInEvent(eventIndex: number): void {
  const result = createMockCheckIn(DEMO_USER_ID, { eventId: mockEvents[eventIndex].id });
  if (typeof result === "string") throw new Error(`check-in fixture failed: ${result}`);
}

describe("myCityFor", () => {
  afterEach(resetMockCheckIns);

  it("report zero counters and no points for a user without check-ins", () => {
    const { summary, points } = myCityFor(DEMO_USER_ID);

    expect(summary).toEqual({ userId: DEMO_USER_ID, placesCount: 0, eventsCount: 0, districtsCount: 0 });
    expect(points).toEqual([]);
  });

  it("map event check-ins to memory points at the place coordinates", () => {
    const subbotnik = mockEvents[2];
    const park = mockPlaces[0];
    checkInEvent(2);
    const { summary, points } = myCityFor(DEMO_USER_ID);

    expect(summary.placesCount).toBe(1);
    expect(summary.eventsCount).toBe(1);
    expect(MyCitySummarySchema.safeParse(summary).success).toBe(true);
    expect(points).toEqual([{ latitude: park.latitude, longitude: park.longitude, eventId: subbotnik.id, placeId: null, visitedAt: points[0].visitedAt }]);
    expect(MemoryPointSchema.safeParse(points[0]).success).toBe(true);
  });

  it("skip event check-ins without a resolvable place", () => {
    checkInEvent(6);
    const { summary, points } = myCityFor(DEMO_USER_ID);

    expect(summary.eventsCount).toBe(1);
    expect(points).toEqual([]);
  });
});

describe("my-city mock endpoint", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockCheckIns();
  });

  it("serve the summary and points through the typed client", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    checkInEvent(2);
    const payload = await client.getMyCity(DEMO_USER_ID);

    expect(payload.summary.eventsCount).toBe(1);
    expect(payload.points).toHaveLength(1);
    expect(payload.points[0].eventId).toBe(mockEvents[2].id);
  });
});
