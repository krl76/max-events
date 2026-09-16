import { afterEach, describe, expect, it } from "vitest";
import { CheckInSchema, VisitStatsSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { installMockApi, mockEvents, mockPlaces, resetMockCheckIns } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";
const SUBBOTNIK = mockEvents[2];

describe("check-in mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockCheckIns();
  });

  it("create a check-in for a known event through the typed client", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const checkIn = await client.createCheckIn({ userId: DEMO_USER_ID, eventId: SUBBOTNIK.id });

    expect(CheckInSchema.safeParse(checkIn).success).toBe(true);
    expect(checkIn.eventId).toBe(SUBBOTNIK.id);
    expect(checkIn.placeId).toBeNull();
  });

  it("stay idempotent per user and target", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const first = await client.createCheckIn({ userId: DEMO_USER_ID, eventId: SUBBOTNIK.id });
    const second = await client.createCheckIn({ userId: DEMO_USER_ID, eventId: SUBBOTNIK.id });

    expect(second.id).toBe(first.id);
  });

  it("reject unknown targets, missing targets and ambiguous targets", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    await expect(client.createCheckIn({ userId: DEMO_USER_ID, eventId: "00000000-0000-4000-8000-000000000000" })).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(client.createCheckIn({ userId: DEMO_USER_ID, placeId: "00000000-0000-4000-8000-000000000000" })).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(client.createCheckIn({ userId: DEMO_USER_ID })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(client.createCheckIn({ userId: DEMO_USER_ID, eventId: SUBBOTNIK.id, placeId: mockPlaces[0].id })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(client.createCheckIn({ userId: "", eventId: SUBBOTNIK.id })).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("expose the check-in through the event details aggregate", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const before = await client.getEventDetails(SUBBOTNIK.id, DEMO_USER_ID);
    expect(before.checkInId).toBeNull();

    const checkIn = await client.createCheckIn({ userId: DEMO_USER_ID, eventId: SUBBOTNIK.id });
    const after = await client.getEventDetails(SUBBOTNIK.id, DEMO_USER_ID);
    expect(after.checkInId).toBe(checkIn.id);
  });

  it("update the visit statistics after a check-in", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const empty = await client.getVisitStats(DEMO_USER_ID);
    expect(VisitStatsSchema.safeParse(empty).success).toBe(true);
    expect(empty.eventsCount).toBe(0);
    expect(empty.placesCount).toBe(0);

    await client.createCheckIn({ userId: DEMO_USER_ID, eventId: SUBBOTNIK.id });
    const stats = await client.getVisitStats(DEMO_USER_ID);

    expect(stats.eventsCount).toBe(1);
    expect(stats.placesCount).toBe(1);
    expect(stats.byCategory.find((item) => item.category === "volunteering")!.count).toBe(1);
    expect(stats.byCategory.find((item) => item.category === "afisha")!.count).toBe(0);
  });

  it("count a place check-in and a second distinct place into placesCount", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const placeCheckIn = await client.createCheckIn({ userId: DEMO_USER_ID, placeId: mockPlaces[1].id });
    expect(placeCheckIn.placeId).toBe(mockPlaces[1].id);
    expect(placeCheckIn.eventId).toBeNull();

    await client.createCheckIn({ userId: DEMO_USER_ID, eventId: mockEvents[5].id });
    const stats = await client.getVisitStats(DEMO_USER_ID);

    expect(stats.eventsCount).toBe(1);
    expect(stats.placesCount).toBe(2);
    expect(stats.byCategory.find((item) => item.category === "sport")!.count).toBe(1);
  });
});
