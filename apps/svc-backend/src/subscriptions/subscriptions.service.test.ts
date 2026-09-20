import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { EventEntity } from "../events/event.entity";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { SubscriptionEntity } from "./subscription.entity";
import { matchesSubscription, SubscriptionsService } from "./subscriptions.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const organizerId = "00000000-0000-4000-8000-00000000000b";
const placeId = "00000000-0000-4000-8000-0000000000p1";

function user(id: string, maxUserId: string): UserEntity {
  return { id, maxUserId, firstName: "Демо", lastName: null, avatarUrl: null, createdAt: now, updatedAt: now } as UserEntity;
}

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, string> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        (entity as { createdAt?: Date }).createdAt ??= now;
        store.push(entity);
      }
      return entity;
    },
    delete: async (where: { id: string }) => {
      const index = store.findIndex((row) => row.id === where.id);
      if (index < 0) return { affected: 0 };
      store.splice(index, 1);
      return { affected: 1 };
    },
  };
}

function createService() {
  const subscriptions = createStoreRepo<SubscriptionEntity>();
  const places = createStoreRepo<PlaceEntity>([{ id: placeId, title: "Парк" } as PlaceEntity]);
  const users = createStoreRepo<UserEntity>([user(userId, "1"), user(organizerId, "2")]);
  const messages: string[] = [];
  const bot = {
    sendMessage: async (_id: string, text: string) => {
      messages.push(text);
      return true;
    },
  } as unknown as MaxBotClient;
  const service = new SubscriptionsService(subscriptions as unknown as Repository<SubscriptionEntity>, places as unknown as Repository<PlaceEntity>, users as unknown as Repository<UserEntity>, bot);
  return { service, messages, subscriptions };
}

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate key"), { code: "23505" }));
}

describe("matchesSubscription", () => {
  const event = { title: "Поход в горы", description: "выходные", category: "tourism", placeId, organizerUserId: organizerId };
  it("matches place, organizer and interest needles", () => {
    expect(matchesSubscription(event, { type: "place", placeId, organizerUserId: null, interest: null } as SubscriptionEntity)).toBe(true);
    expect(matchesSubscription(event, { type: "organizer", organizerUserId: organizerId, placeId: null, interest: null } as SubscriptionEntity)).toBe(true);
    expect(matchesSubscription(event, { type: "interest", interest: "поход", organizerUserId: null, placeId: null } as SubscriptionEntity)).toBe(true);
    expect(matchesSubscription(event, { type: "place", placeId: "00000000-0000-4000-8000-0000000000p9", organizerUserId: null, interest: null } as SubscriptionEntity)).toBe(false);
  });
});

describe("SubscriptionsService", () => {
  it("subscribes to a place and organizer, lists them, and is idempotent", async () => {
    const { service } = createService();
    const place = await service.create(userId, { type: "place", placeId });
    const again = await service.create(userId, { type: "place", placeId });
    expect(again.id).toBe(place.id);
    await service.create(userId, { type: "organizer", organizerUserId: organizerId });
    const listed = await service.list(userId);
    expect(listed.map((row) => row.type).sort()).toEqual(["organizer", "place"]);
  });

  it("unsubscribes and 404s unknown places", async () => {
    const { service } = createService();
    const created = await service.create(userId, { type: "interest", interest: "туризм" });
    const removed = await service.remove(userId, created.id);
    expect(removed.id).toBe(created.id);
    expect(await service.list(userId)).toEqual([]);
    await expect(service.create(userId, { type: "place", placeId: "00000000-0000-4000-8000-0000000000p9" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns the concurrent winner when the subscription insert loses the unique race", async () => {
    const { service, subscriptions } = createService();
    const winnerId = "00000000-0000-4000-8000-0000000000d1";
    const originalSave = subscriptions.save;
    subscriptions.save = async () => {
      subscriptions.save = originalSave;
      subscriptions.store.push({ id: winnerId, userId, type: "place", placeId, organizerUserId: null, interest: null, createdAt: now } as SubscriptionEntity);
      throw uniqueViolation();
    };
    const created = await service.create(userId, { type: "place", placeId });
    expect(created.id).toBe(winnerId);
    expect(subscriptions.store).toHaveLength(1);
  });

  it("rethrows a subscription unique violation that leaves no readable row", async () => {
    const { service, subscriptions } = createService();
    subscriptions.save = async () => {
      throw uniqueViolation();
    };
    await expect(service.create(userId, { type: "place", placeId })).rejects.toBeInstanceOf(QueryFailedError);
  });

  it("notifies a matching subscriber once when a new event is created", async () => {
    const { service, messages } = createService();
    await service.create(userId, { type: "place", placeId });
    await service.create(userId, { type: "interest", interest: "поход" });
    const event = {
      title: "Поход",
      description: "",
      category: "tourism",
      placeId,
      organizerUserId: organizerId,
    } as EventEntity;
    const result = await service.notifyNewEvent(event);
    expect(result.sent).toBe(1);
    expect(messages).toHaveLength(1);
  });
});
