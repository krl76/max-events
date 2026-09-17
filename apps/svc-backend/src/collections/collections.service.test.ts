import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
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
  return { service };
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
});
