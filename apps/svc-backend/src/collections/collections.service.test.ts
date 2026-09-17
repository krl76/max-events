import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { EventEntity } from "../events/event.entity";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { UserEntity } from "../users/user.entity";
import { CollectionEntity, CollectionItemEntity, CollectionMemberEntity } from "./collection.entity";
import { CollectionsService } from "./collections.service";

const now = new Date("2026-09-12T10:00:00Z");
const owner = "00000000-0000-4000-8000-00000000000a";
const coauthor = "00000000-0000-4000-8000-00000000000b";
const stranger = "00000000-0000-4000-8000-00000000000c";
const eventId = "00000000-0000-4000-8000-0000000000e1";

function inValues(value: unknown): unknown[] | undefined {
  if (value && typeof value === "object" && Array.isArray((value as { _value?: unknown })._value)) return (value as { _value: unknown[] })._value;
  return undefined;
}

function matchesWhere(row: object, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    const cell = (row as Record<string, unknown>)[key];
    const values = inValues(value);
    return values ? values.includes(cell) : cell === value;
  });
}

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => matchesWhere(row as object, where));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => matchesWhere(row as object, where)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        (entity as { createdAt?: Date }).createdAt ??= now;
        (entity as { updatedAt?: Date }).updatedAt ??= now;
        (entity as { addedAt?: Date }).addedAt ??= now;
        store.push(entity);
      }
      return entity;
    },
  };
}

function user(id: string, name: string): UserEntity {
  return { id, firstName: name, lastName: null, avatarUrl: null } as UserEntity;
}

function createService() {
  const collections = createStoreRepo<CollectionEntity>();
  const members = createStoreRepo<CollectionMemberEntity>();
  const items = createStoreRepo<CollectionItemEntity>();
  const events = createStoreRepo<EventEntity>([
    {
      id: eventId,
      title: "Джаз",
      description: "",
      category: "afisha",
      city: "Москва",
      placeId: null,
      organizerUserId: null,
      startsAt: now,
      endsAt: null,
      isPaid: false,
      priceRub: null,
      paymentUrl: null,
      capacity: null,
      bookedCount: 0,
      published: true,
      chatLink: null,
      chatSyncPending: false,
      createdAt: now,
      updatedAt: now,
    } as EventEntity,
  ]);
  const users = createStoreRepo<UserEntity>([user(owner, "Саша"), user(coauthor, "Кирилл")]);
  const bot = { createChat: async (title: string) => ({ chatId: 1, link: `https://max.ru/chat/${title}` }) } as unknown as MaxBotClient;
  const service = new CollectionsService(collections as unknown as Repository<CollectionEntity>, members as unknown as Repository<CollectionMemberEntity>, items as unknown as Repository<CollectionItemEntity>, events as unknown as Repository<EventEntity>, users as unknown as Repository<UserEntity>, bot);
  return { service, items, events };
}

describe("CollectionsService", () => {
  it("lets two members add events to different sections and share a chat link", async () => {
    const { service } = createService();
    const created = await service.create(owner, "Саша + Кирилл");
    await service.addMember(owner, created.collection.id, coauthor);
    await service.addItem(owner, created.collection.id, { eventId, section: "want_to_go" });
    const shared = await service.share(coauthor, created.collection.id);
    expect(shared.members.map((row) => row.name).sort()).toEqual(["Кирилл", "Саша"]);
    expect(shared.items).toHaveLength(1);
    expect(shared.items[0]?.section).toBe("want_to_go");
    expect(shared.collection.chatLink).toContain("https://max.ru/chat/");
  });

  it("forbids a stranger from adding items", async () => {
    const { service } = createService();
    const created = await service.create(owner, "Саша + Кирилл");
    await expect(service.addItem(stranger, created.collection.id, { eventId, section: "weekend_ideas" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects adding an unpublished event", async () => {
    const { service, events } = createService();
    events.store[0]!.published = false;
    const created = await service.create(owner, "Саша + Кирилл");
    await expect(service.addItem(owner, created.collection.id, { eventId, section: "want_to_go" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("treats a unique-violation add as already present", async () => {
    const { service, items } = createService();
    const created = await service.create(owner, "Саша + Кирилл");
    items.store.push({
      id: "item-1",
      collectionId: created.collection.id,
      eventId,
      section: "want_to_go",
      addedByUserId: owner,
      addedAt: now,
    } as CollectionItemEntity);
    items.save = async () => {
      throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate"), { code: "23505" }));
    };
    const screen = await service.addItem(owner, created.collection.id, { eventId, section: "want_to_go" });
    expect(screen.items).toHaveLength(1);
    expect(screen.items[0]?.section).toBe("want_to_go");
  });
});
