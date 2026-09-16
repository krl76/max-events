import { afterEach, describe, expect, it } from "vitest";
import type { ParticipationStatus } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { installMockApi, mockEvents, mockFriendIds, participationStats, resetMockParticipations } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

describe("participation mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockParticipations();
  });

  const client = () => new ApiClient("/api");
  const showcase = mockEvents[0];

  it("seeds status counters, friends count and empty own status from fixtures", async () => {
    restore = installMockApi();
    const stats = await client().getParticipationStats(showcase.id, DEMO_USER_ID);

    expect(stats.myStatus).toBeNull();
    expect(stats.friendsCount).toBe(7);
    expect(stats.counts.wants_to_go).toBe(2);
    expect(stats.counts.going).toBe(1);
    expect(stats.counts.looking_for_company).toBe(4);
    expect(stats.counts.looking_for_travel_buddy).toBe(0);
  });

  it("sets, changes and clears my status with counters following", async () => {
    restore = installMockApi();
    const api = client();

    await api.setParticipationStatus(showcase.id, DEMO_USER_ID, "looking_for_company");
    const afterSet = await api.getParticipationStats(showcase.id, DEMO_USER_ID);
    expect(afterSet.myStatus).toBe("looking_for_company");
    expect(afterSet.counts.looking_for_company).toBe(5);

    await api.setParticipationStatus(showcase.id, DEMO_USER_ID, "going");
    const afterChange = await api.getParticipationStats(showcase.id, DEMO_USER_ID);
    expect(afterChange.myStatus).toBe("going");
    expect(afterChange.counts.looking_for_company).toBe(4);
    expect(afterChange.counts.going).toBe(2);

    await api.deleteParticipation(showcase.id, DEMO_USER_ID);
    const afterClear = await api.getParticipationStats(showcase.id, DEMO_USER_ID);
    expect(afterClear.myStatus).toBeNull();
    expect(afterClear.counts.going).toBe(1);
    expect(afterClear.counts.looking_for_company).toBe(4);
  });

  it("keeps statuses per user and per event", async () => {
    restore = installMockApi();
    const api = client();
    const other = mockEvents[10];

    await api.setParticipationStatus(showcase.id, DEMO_USER_ID, "going");
    await api.setParticipationStatus(other.id, DEMO_USER_ID, "looking_for_travel_buddy");
    await api.setParticipationStatus(showcase.id, mockFriendIds[0], "probably_going");

    const showcaseStats = await api.getParticipationStats(showcase.id, DEMO_USER_ID);
    expect(showcaseStats.myStatus).toBe("going");
    expect(showcaseStats.counts.probably_going).toBe(1);

    const otherStats = await api.getParticipationStats(other.id, DEMO_USER_ID);
    expect(otherStats.myStatus).toBe("looking_for_travel_buddy");
    expect(otherStats.counts.going).toBe(0);
  });

  it("counts a friend's participation into the friends counter but not my own status", async () => {
    restore = installMockApi();
    const api = client();
    const friendless = mockEvents[10];

    const before = await api.getParticipationStats(friendless.id, DEMO_USER_ID);
    expect(before.friendsCount).toBe(0);

    await api.setParticipationStatus(friendless.id, mockFriendIds[2], "going");
    const withFriend = await api.getParticipationStats(friendless.id, DEMO_USER_ID);
    expect(withFriend.friendsCount).toBe(1);
    expect(withFriend.counts.going).toBe(1);

    await api.setParticipationStatus(friendless.id, DEMO_USER_ID, "going");
    const withMe = await api.getParticipationStats(friendless.id, DEMO_USER_ID);
    expect(withMe.friendsCount).toBe(1);
    expect(withMe.counts.going).toBe(2);
  });

  it("rejects an invalid status, unknown events and clearing a missing status", async () => {
    restore = installMockApi();
    const api = client();
    const unknown = "00000000-0000-4000-8000-000000000000";

    await expect(api.setParticipationStatus(showcase.id, DEMO_USER_ID, "maybe" as ParticipationStatus)).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(api.setParticipationStatus(unknown, DEMO_USER_ID, "going")).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.deleteParticipation(showcase.id, DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.getParticipationStats(unknown, DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("matches the pure participationStats helper and resets to the seed", async () => {
    restore = installMockApi();
    const api = client();
    await api.setParticipationStatus(showcase.id, DEMO_USER_ID, "going");

    expect(await api.getParticipationStats(showcase.id, DEMO_USER_ID)).toEqual(participationStats(showcase.id, DEMO_USER_ID));

    resetMockParticipations();
    expect(participationStats(showcase.id, DEMO_USER_ID)).toEqual({ counts: { wants_to_go: 2, probably_going: 0, going: 1, looking_for_company: 4, looking_for_travel_buddy: 0, looking_for_after_event_company: 0 }, friendsCount: 7, myStatus: null });
  });
});
