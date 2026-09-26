import { afterEach, describe, expect, it } from "vitest";
import { ApiClient } from "./client";
import { installMockApi } from "./mock";
import { mockCloseFriendsOf, setMockCloseFriend } from "./mock/profile.routes";
import { followersOf, mockOnboardingContacts } from "./mock/social";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

describe("close friends assembled from followers", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    for (const person of mockCloseFriendsOf()) setMockCloseFriend(person.id, false);
  });

  it("adds a follower and then takes them back off the list", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const follower = followersOf(DEMO_USER_ID)[0];

    expect(await api.listCloseFriends()).toEqual([]);
    expect(await api.setCloseFriend(follower.id, true)).toBe(true);
    expect(await api.listCloseFriends()).toEqual([follower]);
    expect(await api.getCloseFriend(follower.id)).toBe(true);
    expect(await api.setCloseFriend(follower.id, false)).toBe(false);
    expect(await api.listCloseFriends()).toEqual([]);
  });

  it("refuses a person who does not follow the viewer", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const followerIds = new Set(followersOf(DEMO_USER_ID).map((person) => person.id));
    const outsider = mockOnboardingContacts.find((person) => !followerIds.has(person.id));
    expect(outsider).toBeDefined();
    if (outsider === undefined) return;

    await expect(api.setCloseFriend(outsider.id, true)).rejects.toMatchObject({ name: "ApiError", status: 403 });
    expect(await api.listCloseFriends()).toEqual([]);
    expect(await api.getCloseFriend(outsider.id)).toBe(false);
  });
});
