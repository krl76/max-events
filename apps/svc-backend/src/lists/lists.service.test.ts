import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { ListPresetSchema } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { ListItemEntity } from "./list-item.entity";
import { ListEntity } from "./list.entity";
import { LIST_PRESET_TITLES, ListsService } from "./lists.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const otherUserId = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const otherEventId = "00000000-0000-4000-8000-0000000000e2";

function eventRow(id: string, title: string): EventEntity {
  return {
    id,
    title,
    description: "",
    category: "afisha",
    city: "Москва",
    placeId: null,
    startsAt: new Date("2026-09-20T16:00:00Z"),
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
  } as EventEntity;
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
        (entity as { updatedAt?: Date }).updatedAt ??= now;
        (entity as { addedAt?: Date }).addedAt ??= now;
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
  const lists = createStoreRepo<ListEntity>();
  const items = createStoreRepo<ListItemEntity>();
  const events = createStoreRepo<EventEntity>([eventRow(eventId, "Джаз"), eventRow(otherEventId, "Пробежка")]);
  const service = new ListsService(lists as unknown as Repository<ListEntity>, items as unknown as Repository<ListItemEntity>, events as unknown as Repository<EventEntity>);
  return { service, items };
}

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate key"), { code: "23505" }));
}

describe("ListsService", () => {
  it("creates the six README presets on first list and keeps them on rerun", async () => {
    const { service } = createService();
    const first = await service.list(userId);
    expect(first.map((row) => row.list.preset)).toEqual([...ListPresetSchema.options]);
    expect(first.map((row) => row.list.title)).toEqual(Object.values(LIST_PRESET_TITLES));
    expect(first.every((row) => row.itemsCount === 0 && row.savedItemId === null && row.participants.length === 0)).toBe(true);
    const second = await service.list(userId);
    expect(second.map((row) => row.list.id)).toEqual(first.map((row) => row.list.id));
  });

  it("returns the concurrent winner when the list-item insert loses the unique race", async () => {
    const { service, items } = createService();
    const want = (await service.list(userId)).find((row) => row.list.preset === "want_to_go")!;
    const winnerId = "00000000-0000-4000-8000-0000000000d1";
    const originalSave = items.save;
    items.save = async () => {
      items.save = originalSave;
      items.store.push({ id: winnerId, listId: want.list.id, eventId, placeId: null, addedAt: now } as ListItemEntity);
      throw uniqueViolation();
    };
    const item = await service.addEvent(userId, want.list.id, eventId);
    expect(item.id).toBe(winnerId);
    expect(items.store).toHaveLength(1);
  });

  it("rethrows a list-item unique violation that leaves no readable row", async () => {
    const { service, items } = createService();
    const want = (await service.list(userId)).find((row) => row.list.preset === "want_to_go")!;
    items.save = async () => {
      throw uniqueViolation();
    };
    await expect(service.addEvent(userId, want.list.id, eventId)).rejects.toBeInstanceOf(QueryFailedError);
  });

  it("adds an event idempotently, reports savedItemId, and returns the event on the list", async () => {
    const { service } = createService();
    const summaries = await service.list(userId);
    const want = summaries.find((row) => row.list.preset === "want_to_go")!;
    const item = await service.addEvent(userId, want.list.id, eventId);
    const again = await service.addEvent(userId, want.list.id, eventId);
    expect(again.id).toBe(item.id);
    const after = (await service.list(userId, eventId)).find((row) => row.list.preset === "want_to_go")!;
    expect(after.itemsCount).toBe(1);
    expect(after.savedItemId).toBe(item.id);
    const cards = await service.itemsFor(userId, want.list.id);
    expect(cards.map((card) => card.event.id)).toEqual([eventId]);
    expect(cards[0].addedBy).toBeNull();
  });

  it("removes an event and 404s unknown lists, events and items", async () => {
    const { service } = createService();
    const want = (await service.list(userId)).find((row) => row.list.preset === "favorites")!;
    const item = await service.addEvent(userId, want.list.id, otherEventId);
    const removed = await service.removeItem(userId, want.list.id, item.id);
    expect(removed.id).toBe(item.id);
    expect(await service.itemsFor(userId, want.list.id)).toEqual([]);
    await expect(service.addEvent(userId, "00000000-0000-4000-8000-000000000099", eventId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.addEvent(userId, want.list.id, "00000000-0000-4000-8000-0000000000e9")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.removeItem(userId, want.list.id, "00000000-0000-4000-8000-000000000099")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("forbids another user from mutating a list", async () => {
    const { service } = createService();
    const want = (await service.list(userId)).find((row) => row.list.preset === "weekend")!;
    await expect(service.addEvent(otherUserId, want.list.id, eventId)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
