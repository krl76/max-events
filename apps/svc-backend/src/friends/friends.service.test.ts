import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { EventEntity } from "../events/event.entity";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { ParticipationEntity } from "../participations/participation.entity";
import { UserEntity } from "../users/user.entity";
import { SubscriptionEntity } from "../subscriptions/subscription.entity";
import { FriendshipEntity } from "./friendship.entity";
import { FriendsService } from "./friends.service";

const now = new Date("2026-09-01T07:00:00Z");
const meId = "00000000-0000-4000-8000-00000000000a";
const annaId = "00000000-0000-4000-8000-0000000000b1";
const dimaId = "00000000-0000-4000-8000-0000000000b2";
const eventJazz = "00000000-0000-4000-8000-0000000000e1";
const eventMatch = "00000000-0000-4000-8000-0000000000e2";

function user(id: string, maxUserId: string, firstName: string, lastName: string | null = null): UserEntity {
  return { id, maxUserId, firstName, lastName, avatarUrl: null, createdAt: now, updatedAt: now } as UserEntity;
}

function eventRow(id: string, title: string, startsAt: string, published = true): EventEntity {
  return {
    id,
    title,
    description: "",
    category: "afisha",
    city: "Москва",
    placeId: null,
    startsAt: new Date(startsAt),
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: null,
    bookedCount: 0,
    published,
    chatLink: null,
    chatSyncPending: false,
    createdAt: now,
    updatedAt: now,
  } as EventEntity;
}

function createFriendshipRepo(initial: FriendshipEntity[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<FriendshipEntity>) => ({ ...fields }) as FriendshipEntity,
    find: async (opts: { where?: { userId?: string; friendUserId?: string; closeFriend?: boolean } } = {}) =>
      store.filter((row) => {
        if (opts.where?.userId && row.userId !== opts.where.userId) return false;
        if (opts.where?.friendUserId && row.friendUserId !== opts.where.friendUserId) return false;
        if (opts.where?.closeFriend !== undefined && row.closeFriend !== opts.where.closeFriend) return false;
        return true;
      }),
    findOneBy: async (where: { userId?: string; friendUserId?: string }) => store.find((row) => (!where.userId || row.userId === where.userId) && (!where.friendUserId || row.friendUserId === where.friendUserId)) ?? null,
    delete: async (where: { id: string }) => {
      const index = store.findIndex((row) => row.id === where.id);
      if (index < 0) return { affected: 0 };
      store.splice(index, 1);
      return { affected: 1 };
    },
    save: async (entity: FriendshipEntity) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        entity.createdAt ??= now;
        entity.updatedAt ??= now;
        store.push(entity);
      }
      return entity;
    },
  };
}

function createUserRepo(initial: UserEntity[]) {
  const store = [...initial];
  return {
    store,
    find: async () => [...store],
    findOneBy: async (where: { id: string }) => store.find((row) => row.id === where.id) ?? null,
    save: async (entity: UserEntity) => {
      const index = store.findIndex((row) => row.id === entity.id);
      if (index >= 0) store[index] = entity;
      else store.push(entity);
      return entity;
    },
  };
}

function createParticipationRepo(initial: ParticipationEntity[]) {
  const store = [...initial];
  return {
    find: async (opts: { where?: { eventId?: string } } = {}) => store.filter((row) => !opts.where?.eventId || row.eventId === opts.where.eventId),
  };
}

function createEventRepo(initial: EventEntity[]) {
  const store = [...initial];
  return {
    find: async () => [...store],
    findOneBy: async (where: { id: string }) => store.find((row) => row.id === where.id) ?? null,
  };
}

function createSubscriptionRepo(initial: SubscriptionEntity[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<SubscriptionEntity>) => ({ ...fields }) as SubscriptionEntity,
    find: async (opts: { where?: { userId?: string; type?: string; targetUserId?: string } } = {}) =>
      store.filter((row) => {
        if (opts.where?.userId && row.userId !== opts.where.userId) return false;
        if (opts.where?.type && row.type !== opts.where.type) return false;
        if (opts.where?.targetUserId && row.targetUserId !== opts.where.targetUserId) return false;
        return true;
      }),
    delete: async (where: { id: string }) => {
      const index = store.findIndex((row) => row.id === where.id);
      if (index < 0) return { affected: 0 };
      store.splice(index, 1);
      return { affected: 1 };
    },
    save: async (entity: SubscriptionEntity) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        entity.createdAt ??= now;
        store.push(entity);
      }
      return entity;
    },
  };
}

function createService(options: { botFriends?: string[] | null; users?: UserEntity[]; participations?: ParticipationEntity[]; events?: EventEntity[]; demoAllUsers?: boolean; nodeEnv?: string } = {}) {
  const users = options.users ?? [user(meId, "1", "Демо"), user(annaId, "2", "Анна", "Соколова"), user(dimaId, "3", "Дима", "Кузнецов")];
  const events = options.events ?? [eventRow(eventJazz, "Джаз в парке", "2026-09-20T16:00:00.000Z"), eventRow(eventMatch, "Матч", "2026-09-18T16:00:00.000Z")];
  const participations = options.participations ?? [{ userId: annaId, eventId: eventJazz, status: "going" } as ParticipationEntity, { userId: dimaId, eventId: eventMatch, status: "looking_for_company" } as ParticipationEntity, { userId: annaId, eventId: eventMatch, status: "wants_to_go" } as ParticipationEntity];
  const friendships = createFriendshipRepo();
  const botState: { friends: string[] | null } = { friends: options.botFriends ?? null };
  const bot = { listFriends: async () => botState.friends } as Pick<MaxBotClient, "listFriends">;
  const config = {
    get: (key: string) => {
      if (key === "FRIENDS_DEMO_ALL_USERS") return options.demoAllUsers ?? false;
      // "in" and not "??": a test that passes nodeEnv: undefined is asking for an unset NODE_ENV.
      if (key === "NODE_ENV") return "nodeEnv" in options ? options.nodeEnv : "development";
      return undefined;
    },
  } as unknown as ConfigService;
  const subscriptions = createSubscriptionRepo();
  const service = new FriendsService(friendships as unknown as Repository<FriendshipEntity>, createUserRepo(users) as unknown as Repository<UserEntity>, createParticipationRepo(participations) as unknown as Repository<ParticipationEntity>, createEventRepo(events) as unknown as Repository<EventEntity>, bot as MaxBotClient, config, subscriptions as unknown as Repository<SubscriptionEntity>);
  return { friendships, subscriptions, botState, service };
}

describe("FriendsService", () => {
  it("leaves the graph untouched when MAX returns no friends list", async () => {
    const { friendships, botState, service } = createService({ botFriends: ["2"] });
    await service.sync(meId);
    expect(friendships.store).toHaveLength(1);

    // MAX stops answering: the known edge survives and nobody new becomes a friend.
    botState.friends = null;
    const afterBlindSync = await service.sync(meId);
    expect(afterBlindSync.map((row) => row.name)).toEqual(["Анна Соколова"]);
    expect(friendships.store).toHaveLength(1);
  });

  it("marks a follower close and remembers that they were marked by this user", async () => {
    const { service, subscriptions } = createService();
    await subscriptions.save(subscriptions.create({ userId: annaId, type: "user", targetUserId: meId, organizerUserId: null, placeId: null, interest: null }));
    expect(await service.isCloseFriend(meId, annaId)).toBe(false);
    expect(await service.setCloseFriend(meId, annaId, true)).toBe(true);
    expect((await service.listClose(meId)).map((row) => row.id)).toEqual([annaId]);
    expect(await service.isCloseFriend(meId, annaId)).toBe(true);
    expect([...(await service.authorsWhoMarkedClose(annaId))]).toEqual([meId]);
    expect(await service.setCloseFriend(meId, annaId, false)).toBe(false);
    expect([...(await service.authorsWhoMarkedClose(annaId))]).toEqual([]);
    await expect(service.setCloseFriend(meId, dimaId, true)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("makes nobody a friend on a first sync without a MAX friends list", async () => {
    const { friendships, service } = createService({ botFriends: null });
    await expect(service.sync(meId)).resolves.toEqual([]);
    expect(friendships.store).toHaveLength(0);
  });

  it("refuses the demo fallback outside development, whatever the switch says", async () => {
    // The switch alone used to be enough, so a production host that set it handed every visitor the
    // whole user table. An unset NODE_ENV has to count as production too.
    for (const nodeEnv of ["production", "staging", undefined]) {
      const { friendships, service } = createService({ botFriends: null, demoAllUsers: true, nodeEnv });
      await expect(service.sync(meId)).resolves.toEqual([]);
      expect(friendships.store).toHaveLength(0);
    }
  });

  it("falls back to every app user only when the demo switch is on", async () => {
    const { friendships, botState, service } = createService({ botFriends: null, demoAllUsers: true });
    const first = await service.sync(meId);
    expect(first.map((row) => row.name).sort()).toEqual(["Анна Соколова", "Дима Кузнецов"]);
    expect(friendships.store).toHaveLength(2);

    botState.friends = ["2"];
    const second = await service.sync(meId);
    expect(second.map((row) => row.name)).toEqual(["Анна Соколова"]);
    expect(friendships.store).toHaveLength(1);
  });

  it("groups activity by friend and sorts by soonest event", async () => {
    const { service } = createService({ botFriends: ["2", "3"] });
    await service.sync(meId);
    const groups = await service.activity(meId);
    expect(groups.map((group) => group.friend.name)).toEqual(["Анна Соколова", "Дима Кузнецов"]);
    expect(groups[0].events.map((item) => item.event.title)).toEqual(["Матч", "Джаз в парке"]);
    expect(groups[0].events.map((item) => item.participationStatus)).toEqual(["wants_to_go", "going"]);
    expect(groups[1].events[0].event.title).toBe("Матч");
  });

  it("counts friends going and looking_for_company on an event, excluding non-friends", async () => {
    const stranger = user("00000000-0000-4000-8000-0000000000b9", "9", "Чужак");
    const { service } = createService({
      users: [user(meId, "1", "Демо"), user(annaId, "2", "Анна", "Соколова"), user(dimaId, "3", "Дима"), stranger],
      botFriends: ["2", "3"],
      participations: [{ userId: annaId, eventId: eventJazz, status: "going" } as ParticipationEntity, { userId: dimaId, eventId: eventJazz, status: "looking_for_company" } as ParticipationEntity, { userId: stranger.id, eventId: eventJazz, status: "going" } as ParticipationEntity],
    });
    await service.sync(meId);
    const summary = await service.eventFriends(meId, eventJazz);
    expect(summary.going).toBe(1);
    expect(summary.lookingForCompany).toBe(1);
    expect(summary.friends).toHaveLength(2);
    await expect(service.eventFriends(meId, "00000000-0000-4000-8000-0000000000e9")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns 404 when syncing an unknown user", async () => {
    const { service } = createService();
    await expect(service.sync("00000000-0000-4000-8000-0000000000ff")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("stamps lastSyncedAt only after a real MAX list and serves suggestions plus replace-all follows", async () => {
    const { service } = createService({ botFriends: ["2"] });
    expect((await service.syncStatus(meId)).lastSyncedAt).toBeNull();
    await service.sync(meId);
    const status = await service.syncStatus(meId);
    expect(status.lastSyncedAt).not.toBeNull();
    expect(status.friends.map((row) => row.name)).toEqual(["Анна Соколова"]);

    const hints = await service.suggestions(meId);
    expect(hints.map((row) => row.friend.id)).toEqual([annaId]);
    expect(hints[0]?.following).toBe(true);
    expect(hints[0]?.hint).toBe("уже в друзьях");
    expect(await service.replaceFollows(meId, [dimaId, dimaId, meId])).toEqual([dimaId]);
    expect((await service.following(meId)).map((row) => row.id)).toEqual([dimaId]);
    expect((await service.list(meId)).map((row) => row.id)).toEqual([annaId]);
  });

  it("unfollows even when MAX has no contacts list, and leaves the friends roster alone", async () => {
    const { service, friendships } = createService({ botFriends: ["2"] });
    await service.sync(meId);
    expect((await service.list(meId)).map((row) => row.id)).toEqual([annaId]);
    await service.replaceFollows(meId, [annaId]);
    expect((await service.following(meId)).map((row) => row.id)).toEqual([annaId]);
    expect(await service.replaceFollows(meId, [])).toEqual([]);
    expect(await service.following(meId)).toEqual([]);
    expect((await service.list(meId)).map((row) => row.id)).toEqual([annaId]);
    expect(friendships.store).toHaveLength(1);
  });

  it("lists outgoing follows and incoming followers", async () => {
    const { service } = createService({ botFriends: ["2", "3"] });
    await service.replaceFollows(meId, [annaId]);
    expect((await service.following(meId)).map((row) => row.id)).toEqual([annaId]);
    expect((await service.followers(annaId)).map((row) => row.id)).toEqual([meId]);
    expect(await service.followers(meId)).toEqual([]);
    expect(await service.list(meId)).toEqual([]);
    await expect(service.following("00000000-0000-4000-8000-0000000000ff")).rejects.toBeInstanceOf(NotFoundException);
  });
});
