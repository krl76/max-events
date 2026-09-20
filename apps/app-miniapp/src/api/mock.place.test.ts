import { afterEach, describe, expect, it } from "vitest";
import { PlacePageSchema, PlaceSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { installMockApi, createMockCheckIn, mockDemoUser, mockEvents, mockFriendIds, mockPlaces, placePageFor, resetMockCheckIns } from "./mock";

const PARK = mockPlaces[0];
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

describe("placePageFor", () => {
  afterEach(resetMockCheckIns);

  it("aggregates today events, friend visits, rating, popularity and personal history for the park", () => {
    const page = placePageFor(PARK.id, mockDemoUser.id)!;

    expect(PlacePageSchema.safeParse(page).success).toBe(true);
    expect(page.placeId).toBe(PARK.id);
    expect(page.todayEvents.map((item) => item.id)).toEqual([mockEvents[14].id]);
    const anna = page.friends.find((visit) => visit.friend.id === mockFriendIds[0]);
    expect(anna).toMatchObject({ visitsCount: 3, goingToday: false });
    expect(page.rating?.summary).toMatchObject({ placeId: PARK.id, reviewsCount: 2, averageStars: 4.5 });
    expect(page.popularityToday).toBe(0);
    expect(page.personalVisitsCount).toBe(0);
  });

  it("counts place check-ins as popularity today and personal visits", () => {
    createMockCheckIn(mockDemoUser.id, { placeId: PARK.id });
    const page = placePageFor(PARK.id, mockDemoUser.id)!;

    expect(page.popularityToday).toBe(1);
    expect(page.personalVisitsCount).toBe(1);
  });

  it("returns null for an unknown place", () => {
    expect(placePageFor(UNKNOWN_ID, mockDemoUser.id)).toBeNull();
  });
});

describe("place page mock endpoint", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockCheckIns();
  });

  it("serves the aggregate through the typed client and 404 for unknown places", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const page = await api.getPlacePage(PARK.id, mockDemoUser.id);

    expect(PlacePageSchema.safeParse(page).success).toBe(true);
    expect(page.placeId).toBe(PARK.id);
    expect(page.todayEvents.map((item) => item.id)).toEqual([mockEvents[14].id]);
    expect(page.friends.some((visit) => visit.friend.id === mockFriendIds[0] && visit.visitsCount === 3)).toBe(true);

    await expect(api.getPlacePage(UNKNOWN_ID, mockDemoUser.id)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("reflects personal history check-ins served through the endpoint", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    await api.createCheckIn({ userId: mockDemoUser.id, placeId: PARK.id });

    const page = await api.getPlacePage(PARK.id, mockDemoUser.id);

    expect(page.personalVisitsCount).toBe(1);
    expect(page.popularityToday).toBe(1);
  });
});

describe("place by-id mock endpoint", () => {
  const PUSHKIN = "b0000002-0000-4000-8000-000000000002";
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
  });

  it("serves a place through the typed client and 404 for unknown ids", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const place = await api.getPlace(PUSHKIN);
    expect(PlaceSchema.safeParse(place).success).toBe(true);
    expect(place.title).toBe("ГМИИ им. А. С. Пушкина");

    await expect(api.getPlace(UNKNOWN_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });
});
