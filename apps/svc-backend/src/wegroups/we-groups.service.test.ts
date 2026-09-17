import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { EventEntity } from "../events/event.entity";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { WeGroupEntity, WeGroupItemEntity, WeGroupMemberEntity } from "./we-group.entity";
import { WeGroupsService } from "./we-groups.service";

const now = new Date("2026-09-12T10:00:00Z");
const owner = "00000000-0000-4000-8000-00000000000a";
const member = "00000000-0000-4000-8000-00000000000b";
const stranger = "00000000-0000-4000-8000-00000000000c";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const draftEventId = "00000000-0000-4000-8000-0000000000e2";
const placeId = "00000000-0000-4000-8000-0000000000p1";

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
    find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => matchesWhere(row as object, opts.where ?? {})),
    findOneBy: async (where: Record<string, string>) => store.find((row) => matchesWhere(row as object, where)) ?? null,
    save: async (entity: T) => {
      const item = entity as unknown as WeGroupItemEntity;
      if (item.groupId && (item.eventId || item.placeId)) {
        const duplicate = store.some((row) => {
          const other = row as unknown as WeGroupItemEntity;
          if (other === item || other.groupId !== item.groupId) return false;
          if (item.eventId && other.eventId === item.eventId) return true;
          if (item.placeId && other.placeId === item.placeId) return true;
          return false;
        });
        if (duplicate) {
          throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate"), { code: "23505" }));
        }
      }
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        (entity as { createdAt?: Date }).createdAt ??= now;
        (entity as { updatedAt?: Date }).updatedAt ??= now;
        store.push(entity);
      }
      return entity;
    },
  };
}

function createService() {
  const groups = createStoreRepo<WeGroupEntity>();
  const members = createStoreRepo<WeGroupMemberEntity>();
  const items = createStoreRepo<WeGroupItemEntity>();
  const events = createStoreRepo<EventEntity>([
    {
      id: eventId,
      title: "Джаз",
      description: "",
      category: "afisha",
      city: "Казань",
      placeId: null,
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
    {
      id: draftEventId,
      title: "Черновик",
      description: "",
      category: "afisha",
      city: "Казань",
      placeId: null,
      startsAt: now,
      endsAt: null,
      isPaid: false,
      priceRub: null,
      paymentUrl: null,
      capacity: null,
      bookedCount: 0,
      published: false,
      chatLink: null,
      chatSyncPending: false,
      createdAt: now,
      updatedAt: now,
    } as EventEntity,
  ]);
  const places = createStoreRepo<PlaceEntity>([{ id: placeId, title: "Кремль", address: "x", city: "Казань", category: "museum", latitude: 55.79, longitude: 49.11, published: true, createdAt: now, updatedAt: now } as PlaceEntity]);
  const users = createStoreRepo<UserEntity>([
    { id: owner, firstName: "Саша", lastName: null, avatarUrl: null } as UserEntity,
    { id: member, firstName: "Кирилл", lastName: null, avatarUrl: null } as UserEntity,
  ]);
  const bot = { createChat: async () => ({ chatId: 1, link: "https://max.ru/join/we" }) } as unknown as MaxBotClient;
  const service = new WeGroupsService(
    groups as unknown as Repository<WeGroupEntity>,
    members as unknown as Repository<WeGroupMemberEntity>,
    items as unknown as Repository<WeGroupItemEntity>,
    events as unknown as Repository<EventEntity>,
    places as unknown as Repository<PlaceEntity>,
    users as unknown as Repository<UserEntity>,
    bot,
  );
  return { service, groups };
}

describe("WeGroupsService", () => {
  it("creates a group with members and a MAX chat, then binds event and place", async () => {
    const { service } = createService();
    const created = await service.create(owner, { title: "Поездка в Казань", memberIds: [member] });
    expect(created.group.status).toBe("active");
    expect(created.group.chatLink).toBe("https://max.ru/join/we");
    expect(created.members.map((row) => row.name).sort()).toEqual(["Кирилл", "Саша"]);
    const withEvent = await service.addEvent(member, created.group.id, eventId);
    expect(withEvent.events.map((row) => row.title)).toEqual(["Джаз"]);
    const withPlace = await service.addPlace(owner, created.group.id, placeId);
    expect(withPlace.places.map((row) => row.title)).toEqual(["Кремль"]);
  });

  it("archives to history and then rejects new binds", async () => {
    const { service } = createService();
    const created = await service.create(owner, { title: "Поездка в Казань", memberIds: [member] });
    await expect(service.archive(member, created.group.id)).rejects.toBeInstanceOf(ForbiddenException);
    const archived = await service.archive(owner, created.group.id, now);
    expect(archived.group.status).toBe("archived");
    expect(archived.group.archivedAt).toBe(now.toISOString());
    await expect(service.addEvent(owner, created.group.id, eventId)).rejects.toBeInstanceOf(ConflictException);
    const listed = await service.listForUser(owner);
    expect(listed.map((row) => row.group.status)).toEqual(["archived"]);
  });

  it("forbids strangers and missing catalog rows", async () => {
    const { service, groups } = createService();
    await expect(service.create(owner, { title: "С чужим", memberIds: [stranger] })).rejects.toBeInstanceOf(NotFoundException);
    expect(groups.store).toHaveLength(0);
    const created = await service.create(owner, { title: "Поездка в Казань", memberIds: [] });
    await expect(service.get(stranger, created.group.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.addEvent(owner, created.group.id, "00000000-0000-4000-8000-000000000099")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.addEvent(owner, created.group.id, draftEventId)).rejects.toBeInstanceOf(NotFoundException);
    await service.addEvent(owner, created.group.id, eventId);
    const dup = await service.addEvent(owner, created.group.id, eventId);
    expect(dup.events).toHaveLength(1);
  });
});
