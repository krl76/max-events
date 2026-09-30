import { afterEach, describe, expect, it } from "vitest";
import { ApiClient } from "./client";
import { DEFAULT_APP_SETTINGS, installMockApi, mockEvents, mockPlaces, profileCountersFor, resetMockAppSettings, resetMockCheckIns, visitedPlacesFor } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

describe("profile counters and the impressions grid", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockCheckIns();
  });

  it("opens on the visit history the demo account already has, most visited first", () => {
    const places = visitedPlacesFor(DEMO_USER_ID);

    expect(places[0]).toEqual({ placeId: mockPlaces[0].id, title: "Парк Горького", visits: 12, photoUrl: mockPlaces[0].logoUrl ?? "/onboarding/gorky.jpg" });
    expect(places.map((place) => place.visits)).toEqual([12, 9, 7, 5]);
  });

  it("counts events, places and the companies the visits happened in", () => {
    const counters = profileCountersFor(DEMO_USER_ID);

    expect(counters).toEqual({ userId: DEMO_USER_ID, eventsCount: 33, placesCount: 4, companiesCount: 26 });
  });

  it("adds a live check-in to the counters and to the grid", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    // mockEvents[2] is the Парк Горького subbotnik, so the visit lands on a place already in the history.
    await api.createCheckIn({ userId: DEMO_USER_ID, eventId: mockEvents[2].id });
    const counters = await api.getProfileCounters(DEMO_USER_ID);
    const places = await api.listVisitedPlaces(DEMO_USER_ID);

    expect(counters.eventsCount).toBe(34);
    expect(counters.placesCount).toBe(4);
    expect(places[0].visits).toBe(13);
  });
});

describe("app settings of экран 41", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockAppSettings();
  });

  it("serves the defaults for a user who never changed anything", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    expect(await api.getAppSettings(DEMO_USER_ID)).toEqual({ userId: DEMO_USER_ID, ...DEFAULT_APP_SETTINGS });
  });

  it("merges a patch and keeps everything the patch left alone", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const updated = await api.updateAppSettings(DEMO_USER_ID, { searchRadiusKm: 10, quietHours: false });

    expect(updated.searchRadiusKm).toBe(10);
    expect(updated.quietHours).toBe(false);
    expect(updated.showOnMap).toBe(DEFAULT_APP_SETTINGS.showOnMap);
    expect(await api.getAppSettings(DEMO_USER_ID)).toEqual(updated);
  });

  it("keeps the settings of two users apart", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const other = "a0000000-0000-4000-8000-0000000000b1";

    await api.updateAppSettings(DEMO_USER_ID, { organizerMode: true });

    expect((await api.getAppSettings(other)).organizerMode).toBe(false);
  });
});
