import { describe, expect, it } from "vitest";
import type { EventFriendsSummary, Friend, FriendActivityByFriend } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { EventFriendsController, FriendsController, UserGraphController } from "./friends.controller";
import type { FriendsService } from "./friends.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const eventId = "00000000-0000-4000-8000-0000000000e1";
const friends: Friend[] = [{ id: "00000000-0000-4000-8000-0000000000b1", name: "Анна Соколова", avatarUrl: null }];
const activity: FriendActivityByFriend[] = [{ friend: friends[0], events: [] }];
const summary: EventFriendsSummary = { friends: [], going: 0, lookingForCompany: 0 };

function createService() {
  const calls: { list?: string; sync?: string; activity?: string; suggestions?: string; syncStatus?: string; follows?: string[]; eventFriends?: { userId: string; eventId: string }; followers?: string } = {};
  const service = {
    list: async (userId: string) => {
      calls.list = userId;
      return friends;
    },
    sync: async (userId: string) => {
      calls.sync = userId;
      return friends;
    },
    activity: async (userId: string) => {
      calls.activity = userId;
      return activity;
    },
    suggestions: async (userId: string) => {
      calls.suggestions = userId;
      return [{ friend: friends[0], hint: "пользуется Афишей", following: false }];
    },
    syncStatus: async (userId: string) => {
      calls.syncStatus = userId;
      return { lastSyncedAt: null, friends };
    },
    replaceFollows: async (_userId: string, userIds: string[]) => {
      calls.follows = userIds;
      return userIds;
    },
    eventFriends: async (userId: string, bookedEventId: string) => {
      calls.eventFriends = { userId, eventId: bookedEventId };
      return summary;
    },
    followers: async (userId: string) => {
      calls.followers = userId;
      return friends;
    },
  } as unknown as FriendsService;
  return { calls, service };
}

describe("FriendsController", () => {
  it("lists, syncs, and loads activity for the authenticated user", async () => {
    const { calls, service } = createService();
    const controller = new FriendsController(service);
    await expect(controller.list(user)).resolves.toEqual(friends);
    await expect(controller.sync(user)).resolves.toEqual(friends);
    await expect(controller.activity(user)).resolves.toEqual(activity);
    await expect(controller.suggestions(user)).resolves.toMatchObject([{ following: false }]);
    await expect(controller.syncStatus(user)).resolves.toMatchObject({ lastSyncedAt: null, friends });
    await expect(controller.replaceFollows(user, { userIds: [friends[0]!.id] })).resolves.toEqual([friends[0]!.id]);
    expect(calls).toEqual({ list: user.id, sync: user.id, activity: user.id, suggestions: user.id, syncStatus: user.id, follows: [friends[0]!.id] });
  });
});

describe("UserGraphController", () => {
  it("reads both follow directions for the person in the path, not the viewer", async () => {
    const { calls, service } = createService();
    const controller = new UserGraphController(service);
    const other = "00000000-0000-4000-8000-0000000000b1";
    await expect(controller.following(user, other)).resolves.toEqual(friends);
    await expect(controller.followers(user, other)).resolves.toEqual(friends);
    expect(calls.list).toBe(other);
    expect(calls.followers).toBe(other);
  });
});

describe("EventFriendsController", () => {
  it("loads event friends for the authenticated user", async () => {
    const { calls, service } = createService();
    const controller = new EventFriendsController(service);
    await expect(controller.list(user, eventId)).resolves.toEqual(summary);
    expect(calls.eventFriends).toEqual({ userId: user.id, eventId });
  });
});
