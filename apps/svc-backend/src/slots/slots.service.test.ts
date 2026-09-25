import { ConflictException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { FriendsService } from "../friends/friends.service";
import { PlaceEntity } from "../places/place.entity";
import { PlaceSlotEntity, SlotBookingEntity } from "./slot.entity";
import { SlotsService } from "./slots.service";

const userId = "00000000-0000-4000-8000-00000000000a";
const placeId = "00000000-0000-4000-8000-0000000000p1";
const now = new Date("2026-09-20T10:00:00+03:00");

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
    save: async (entity: T) => {
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

describe("SlotsService", () => {
  it("publishes a week of windows and books until the table is full", async () => {
    const slots = createStoreRepo<PlaceSlotEntity>();
    const bookings = createStoreRepo<SlotBookingEntity>();
    const places = createStoreRepo<PlaceEntity>([{ id: placeId, title: "Парк", address: "x", city: "Москва", category: "park", latitude: 55.7, longitude: 37.6, published: true, createdAt: now, updatedAt: now } as PlaceEntity]);
    const friends = { list: async () => [] } as unknown as FriendsService;
    const service = new SlotsService(slots as unknown as Repository<PlaceSlotEntity>, bookings as unknown as Repository<SlotBookingEntity>, places as unknown as Repository<PlaceEntity>, friends);
    const board = await service.board(placeId, userId, undefined, now);
    expect(board.days).toHaveLength(7);
    expect(board.slots.length).toBeGreaterThan(0);
    expect(board.slots[0]?.status).toBe("free");
    const booked = await service.book(userId, board.slots[0]!.id, ["00000000-0000-4000-8000-00000000000b"]);
    expect(booked.partySize).toBe(2);
    expect(booked.status).toBe("active");
    const full = slots.store[0]!;
    full.takenSeats = full.capacity;
    await expect(service.book("00000000-0000-4000-8000-00000000000c", full.id)).rejects.toBeInstanceOf(ConflictException);
  });
});
