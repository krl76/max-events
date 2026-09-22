import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { FindOperator, QueryFailedError, type Repository } from "typeorm";
import { EventEntity } from "../events/event.entity";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { OrganizationEntity } from "../organizations/organization.entity";
import type { OrganizationsService } from "../organizations/organizations.service";
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

/** Understands the two shapes the service asks for: an exact value and In([...]). */
function matchesWhere(row: unknown, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as Record<string, unknown>)[key];
    if (expected instanceof FindOperator) return (expected.value as unknown[]).includes(actual);
    return actual === expected;
  });
}

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => matchesWhere(row, opts.where ?? {})),
    findOneBy: async (where: Record<string, unknown>) => store.find((row) => matchesWhere(row, where)) ?? null,
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

function createService(options: { organizationName?: string } = {}) {
  const subscriptions = createStoreRepo<SubscriptionEntity>();
  const places = createStoreRepo<PlaceEntity>([{ id: placeId, title: "Парк" } as PlaceEntity]);
  const users = createStoreRepo<UserEntity>([user(userId, "1"), user(organizerId, "2")]);
  // Argument-aware on purpose: a lookup by the wrong id would otherwise still return a name.
  const organizations = {
    findByOrganizerUserId: async (id: string) => (options.organizationName && id === organizerId ? ({ organizerUserId: id, name: options.organizationName } as OrganizationEntity) : null),
    findByOrganizerUserIds: async (ids: string[]) => (options.organizationName ? ids.filter((id) => id === organizerId).map((id) => ({ organizerUserId: id, name: options.organizationName }) as OrganizationEntity) : []),
  } as unknown as OrganizationsService;
  const messages: string[] = [];
  const bot = {
    sendMessage: async (_id: string, text: string) => {
      messages.push(text);
      return true;
    },
  } as unknown as MaxBotClient;
  const service = new SubscriptionsService(subscriptions as unknown as Repository<SubscriptionEntity>, places as unknown as Repository<PlaceEntity>, users as unknown as Repository<UserEntity>, bot, organizations);
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
    expect(matchesSubscription(event, { type: "user", targetUserId: organizerId, organizerUserId: null, placeId: null, interest: null } as SubscriptionEntity)).toBe(true);
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

  it("names the target, because a uuid tells the subscriber nothing", async () => {
    const { service } = createService({ organizationName: "Культурный центр" });

    expect((await service.create(userId, { type: "place", placeId })).title).toBe("Парк");
    expect((await service.create(userId, { type: "interest", interest: "походы" })).title).toBe("походы");
    // The organization name, the same one the event page shows — not the account behind it.
    expect((await service.create(userId, { type: "organizer", organizerUserId: organizerId })).title).toBe("Культурный центр");
    expect((await service.list(userId)).map((row) => row.title).sort()).toEqual(["Культурный центр", "Парк", "походы"]);
  });

  it("falls back to the organizer's own name, and to a label when the target is gone", async () => {
    const { service, subscriptions } = createService();

    // No organization behind the organizer: the account name is the next best thing.
    expect((await service.create(userId, { type: "organizer", organizerUserId: organizerId })).title).toBe("Демо");
    // A place deleted after the subscription was made must not blank the whole list.
    subscriptions.store.push({ id: "00000000-0000-4000-8000-0000000000d7", userId, type: "place", placeId: "00000000-0000-4000-8000-0000000000p9", organizerUserId: null, interest: null, createdAt: now } as SubscriptionEntity);
    expect((await service.list(userId)).map((row) => row.title).sort()).toEqual(["Демо", "Место"]);
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

  it("follows a user by targetUserId and refuses a self-follow", async () => {
    const { service } = createService();
    const created = await service.create(userId, { type: "user", userId: organizerId });
    expect(created.type).toBe("user");
    expect(created.targetUserId).toBe(organizerId);
    expect(created.title).toBe("Демо");
    await expect(service.create(userId, { type: "user", userId })).rejects.toBeInstanceOf(BadRequestException);
  });
});
