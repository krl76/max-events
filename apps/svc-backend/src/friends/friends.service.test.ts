import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { EventEntity } from "../events/event.entity";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { ParticipationEntity } from "../participations/participation.entity";
import { UserEntity } from "../users/user.entity";
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
    find: async (opts: { where?: { userId?: string } } = {}) => store.filter((row) => !opts.where?.userId || row.userId === opts.where.userId),
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

function createService(options: { botFriends?: string[] | null; users?: UserEntity[]; participations?: ParticipationEntity[]; events?: EventEntity[] } = {}) {
  const users = options.users ?? [user(meId, "1", "Демо"), user(annaId, "2", "Анна", "Соколова"), user(dimaId, "3", "Дима", "Кузнецов")];
  const events = options.events ?? [eventRow(eventJazz, "Джаз в парке", "2026-09-20T16:00:00.000Z"), eventRow(eventMatch, "Матч", "2026-09-18T16:00:00.000Z")];
  const participations = options.participations ?? [{ userId: annaId, eventId: eventJazz, status: "going" } as ParticipationEntity, { userId: dimaId, eventId: eventMatch, status: "looking_for_company" } as ParticipationEntity, { userId: annaId, eventId: eventMatch, status: "wants_to_go" } as ParticipationEntity];
  const friendships = createFriendshipRepo();
  const botState: { friends: string[] | null } = { friends: options.botFriends ?? null };
  const bot = { listFriends: async () => botState.friends } as Pick<MaxBotClient, "listFriends">;
  const service = new FriendsService(friendships as unknown as Repository<FriendshipEntity>, createUserRepo(users) as unknown as Repository<UserEntity>, createParticipationRepo(participations) as unknown as Repository<ParticipationEntity>, createEventRepo(events) as unknown as Repository<EventEntity>, bot as MaxBotClient);
  return { friendships, botState, service };
}

describe("FriendsService", () => {
  it("syncs all other app users when MAX has no friends list, and drops edges on a smaller rerun", async () => {
    const { friendships, botState, service } = createService({ botFriends: null });
    const first = await service.sync(meId);
    expect(first.map((row) => row.name).sort()).toEqual(["Анна Соколова", "Дима Кузнецов"]);
    expect(friendships.store).toHaveLength(2);

    botState.friends = ["2"];
    const second = await service.sync(meId);
    expect(second.map((row) => row.name)).toEqual(["Анна Соколова"]);
    expect(friendships.store).toHaveLength(1);
  });

  it("groups activity by friend and sorts by soonest event", async () => {
    const { service } = createService();
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
});
