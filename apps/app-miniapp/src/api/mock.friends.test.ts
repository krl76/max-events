import { afterEach, describe, expect, it } from "vitest";
import { FriendSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { friendActivityByFriend, installMockApi, mockEvents, mockFriendIds, mockFriends, resetMockParticipations } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

describe("friends feed mock endpoint", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockParticipations();
  });

  it("every friend fixture passes the friend contract and mirrors mockFriendIds", () => {
    for (const friend of mockFriends) {
      expect(FriendSchema.safeParse(friend)).toMatchObject({ success: true });
    }
    expect(mockFriends.map((friend) => friend.id)).toEqual(mockFriendIds);
  });

  it("groups seeded participations by friend, soonest event first", () => {
    const groups = friendActivityByFriend();

    expect(groups).toHaveLength(mockFriends.length);
    expect(groups[0].friend.name).toBe("Анна Соколова");
    expect(groups[0].events[0].event.id).toBe(mockEvents[1].id);
    const soonest = groups.map((group) => group.events[0].event.startsAt);
    expect([...soonest].sort((a, b) => a.localeCompare(b))).toEqual(soonest);
  });

  it("renders the README showcase: Анна → выставка, Дима → матч, Катя → фестиваль", () => {
    const byName = new Map(friendActivityByFriend().map((group) => [group.friend.name, group]));

    expect(byName.get("Анна Соколова")!.events.some(({ event }) => event.id === mockEvents[1].id)).toBe(true);
    expect(byName.get("Дима Кузнецов")!.events.some(({ event }) => event.id === mockEvents[5].id)).toBe(true);
    expect(byName.get("Катя Орлова")!.events.some(({ event }) => event.id === mockEvents[11].id)).toBe(true);
  });

  it("serves the friends feed through the typed client", async () => {
    restore = installMockApi();

    const groups = await new ApiClient("/api").getFriendsActivity(DEMO_USER_ID);

    expect(groups).toEqual(friendActivityByFriend());
    expect(groups[0].events[0].participationStatus).toBe("going");
  });
});
