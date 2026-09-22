import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { ListPresetSchema } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { ListItemEntity } from "./list-item.entity";
import { ListEntity } from "./list.entity";
import { LIST_PRESET_TITLES, ListsService, MAX_CUSTOM_LISTS } from "./lists.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const otherUserId = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const otherEventId = "00000000-0000-4000-8000-0000000000e2";
const placeId = "00000000-0000-4000-8000-0000000000p1";

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
  const places = createStoreRepo<PlaceEntity>([{ id: placeId, title: "Парк", address: "Москва", city: "Москва", category: "park", latitude: 55.75, longitude: 37.62, published: true, createdAt: now, updatedAt: now } as PlaceEntity]);
  const service = new ListsService(lists as unknown as Repository<ListEntity>, items as unknown as Repository<ListItemEntity>, events as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>);
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

  it("keeps a list of one's own next to the presets", async () => {
    const { service } = createService();

    const created = await service.create(userId, "Сводить маму");
    const summaries = await service.list(userId);

    expect(created).toMatchObject({ preset: null, title: "Сводить маму" });
    // Presets first, the user's own after them — the order the screen reads top down.
    expect(summaries.map((row) => row.list.preset)).toEqual([...ListPresetSchema.options, null]);
    expect(summaries.at(-1)!.list.id).toBe(created.id);
  });

  it("renames and deletes a list of one's own, with its items", async () => {
    const { service, items } = createService();
    const created = await service.create(userId, "Сводить маму");
    await service.addEvent(userId, created.id, eventId);

    expect((await service.rename(userId, created.id, "Сводить папу")).title).toBe("Сводить папу");
    const removed = await service.remove(userId, created.id);

    expect(removed.id).toBe(created.id);
    expect((await service.list(userId)).map((row) => row.list.id)).not.toContain(created.id);
    // The items go with the list through FK_list_items_list ON DELETE CASCADE, which is a database
    // guarantee — asserted on the migration, not here, where the fake repository has no foreign keys.
    expect(items.store.every((row) => row.listId === created.id)).toBe(true);
  });

  it("refuses to rename or delete a preset", async () => {
    // ensurePresets recreates every missing preset on the next read: a rename would be undone and a
    // delete would come back as a new row with the default title. Better to say no.
    const { service } = createService();
    const want = (await service.list(userId)).find((row) => row.list.preset === "want_to_go")!;

    await expect(service.rename(userId, want.list.id, "Моё")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove(userId, want.list.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.list(userId)).find((row) => row.list.preset === "want_to_go")!.list.title).toBe(want.list.title);
  });

  it("refuses to touch another user's list and bounds how many one user may create", async () => {
    const { service } = createService();
    const mine = await service.create(userId, "Моё");

    await expect(service.rename("00000000-0000-4000-8000-0000000000ff", mine.id, "Чужое")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove("00000000-0000-4000-8000-0000000000ff", mine.id)).rejects.toBeInstanceOf(ForbiddenException);

    for (let index = 1; index < MAX_CUSTOM_LISTS; index += 1) await service.create(userId, `Список ${index}`);
    await expect(service.create(userId, "Ещё один")).rejects.toBeInstanceOf(ConflictException);
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
    expect(cards.map((card) => card.event?.id)).toEqual([eventId]);
    expect(cards[0].place).toBeNull();
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

  it("adds a place to a list and rewrites stale preset titles on read", async () => {
    const { service } = createService();
    const want = (await service.list(userId)).find((row) => row.list.preset === "weekend")!;
    expect(want.list.title).toBe("Выходные");
    const item = await service.addPlace(userId, want.list.id, placeId);
    expect(item.placeId).toBe(placeId);
    expect(item.eventId).toBeNull();
    const again = await service.addPlace(userId, want.list.id, placeId);
    expect(again.id).toBe(item.id);
    const cards = await service.itemsFor(userId, want.list.id);
    expect(cards.map((card) => card.place?.id)).toEqual([placeId]);
    expect(cards[0].event).toBeNull();
    await expect(service.addPlace(userId, want.list.id, "00000000-0000-4000-8000-0000000000p9")).rejects.toBeInstanceOf(NotFoundException);
  });
});
