import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { CheckInEntity } from "./check-in.entity";
import { CheckInsService, utcVisitDate } from "./check-ins.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const otherUser = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const placeId = "00000000-0000-4000-8000-0000000000p1";
const otherPlaceId = "00000000-0000-4000-8000-0000000000p2";

function eventRow(): EventEntity {
  return {
    id: eventId,
    title: "Субботник",
    description: "",
    category: "volunteering",
    city: "Москва",
    placeId,
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
        (entity as { checkedInAt?: Date }).checkedInAt ??= now;
        store.push(entity);
      }
      return entity;
    },
  };
}

function createService() {
  const checkIns = createStoreRepo<CheckInEntity>();
  const events = createStoreRepo<EventEntity>([eventRow()]);
  const places = createStoreRepo<PlaceEntity>([{ id: placeId } as PlaceEntity, { id: otherPlaceId } as PlaceEntity]);
  const service = new CheckInsService(checkIns as unknown as Repository<CheckInEntity>, events as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>);
  return { service, checkIns };
}

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate key"), { code: "23505" }));
}

describe("utcVisitDate", () => {
  it("returns the UTC calendar day", () => {
    expect(utcVisitDate(now)).toBe("2026-09-12");
  });
});

describe("CheckInsService", () => {
  it("creates an event check-in once and counts the event place in stats", async () => {
    const { service } = createService();
    const first = await service.create(userId, { eventId }, now);
    const second = await service.create(userId, { eventId }, now);
    expect(second.id).toBe(first.id);
    const stats = await service.stats(userId, userId);
    expect(stats.eventsCount).toBe(1);
    expect(stats.placesCount).toBe(1);
    expect(stats.byCategory.find((row) => row.category === "volunteering")?.count).toBe(1);
    expect(stats.byCategory.find((row) => row.category === "afisha")?.count).toBe(0);
  });

  it("dedups a place check-in on the same UTC day and allows the next day", async () => {
    const { service } = createService();
    const first = await service.create(userId, { placeId }, now);
    const sameDay = await service.create(userId, { placeId }, new Date("2026-09-12T23:00:00Z"));
    expect(sameDay.id).toBe(first.id);
    const nextDay = await service.create(userId, { placeId }, new Date("2026-09-13T00:00:00Z"));
    expect(nextDay.id).not.toBe(first.id);
    await service.create(userId, { placeId: otherPlaceId }, now);
    const stats = await service.stats(userId, userId);
    expect(stats.placesCount).toBe(2);
    expect(stats.eventsCount).toBe(0);
  });

  it("returns the concurrent winner when the event check-in insert loses the unique race", async () => {
    const { service, checkIns } = createService();
    const winnerId = "00000000-0000-4000-8000-0000000000d1";
    const originalSave = checkIns.save;
    checkIns.save = async () => {
      checkIns.save = originalSave;
      checkIns.store.push({ id: winnerId, userId, eventId, placeId: null, visitDate: null, checkedInAt: now } as CheckInEntity);
      throw uniqueViolation();
    };
    const created = await service.create(userId, { eventId }, now);
    expect(created.id).toBe(winnerId);
    expect(checkIns.store).toHaveLength(1);
  });

  it("returns the concurrent winner when the place check-in insert loses the unique race", async () => {
    const { service, checkIns } = createService();
    const winnerId = "00000000-0000-4000-8000-0000000000d2";
    const originalSave = checkIns.save;
    checkIns.save = async () => {
      checkIns.save = originalSave;
      checkIns.store.push({ id: winnerId, userId, eventId: null, placeId, visitDate: "2026-09-12", checkedInAt: now } as CheckInEntity);
      throw uniqueViolation();
    };
    const created = await service.create(userId, { placeId }, now);
    expect(created.id).toBe(winnerId);
    expect(checkIns.store).toHaveLength(1);
  });

  it("rethrows a unique violation that leaves no readable row", async () => {
    const { service, checkIns } = createService();
    checkIns.save = async () => {
      throw uniqueViolation();
    };
    await expect(service.create(userId, { eventId }, now)).rejects.toBeInstanceOf(QueryFailedError);
  });

  it("404s unknown targets and forbids reading another user's stats", async () => {
    const { service } = createService();
    await expect(service.create(userId, { eventId: "00000000-0000-4000-8000-0000000000e9" }, now)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create(userId, { placeId: "00000000-0000-4000-8000-0000000000p9" }, now)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.stats(otherUser, userId)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
