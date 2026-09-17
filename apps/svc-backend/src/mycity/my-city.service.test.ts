import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { districtKey, MyCityService } from "./my-city.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const otherUser = "00000000-0000-4000-8000-00000000000b";
const placeA = "00000000-0000-4000-8000-0000000000a1";
const placeB = "00000000-0000-4000-8000-0000000000a2";
const eventId = "00000000-0000-4000-8000-0000000000e1";

function place(id: string, lat: number, lng: number): PlaceEntity {
  return { id, title: id, address: "x", city: "Москва", category: "park", latitude: lat, longitude: lng, createdAt: now, updatedAt: now } as PlaceEntity;
}

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
  return {
    store,
    find: async (opts: { where?: Record<string, unknown> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => matchesWhere(row as object, where));
    },
  };
}

describe("districtKey", () => {
  it("groups nearby coordinates into one cell and splits distant ones", () => {
    expect(districtKey(55.7298, 37.6019)).toBe(districtKey(55.731, 37.604));
    expect(districtKey(55.7298, 37.6019)).not.toBe(districtKey(55.75, 37.65));
  });
});

describe("MyCityService", () => {
  it("counts unique places (including event venues), events and districts and returns map points", async () => {
    const checkIns = createStoreRepo<CheckInEntity>([{ id: "c1", userId, eventId, placeId: null, visitDate: null, checkedInAt: now } as CheckInEntity, { id: "c2", userId, eventId: null, placeId: placeB, visitDate: "2026-09-12", checkedInAt: now } as CheckInEntity]);
    const events = createStoreRepo<EventEntity>([{ id: eventId, placeId: placeA } as EventEntity]);
    const places = createStoreRepo<PlaceEntity>([place(placeA, 55.7298, 37.6019), place(placeB, 55.75, 37.65)]);
    const service = new MyCityService(checkIns as unknown as Repository<CheckInEntity>, events as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>);
    const payload = await service.forUser(userId, userId);
    expect(payload.summary).toEqual({ userId, placesCount: 2, eventsCount: 1, districtsCount: 2 });
    expect(payload.points).toHaveLength(2);
    expect(payload.points.some((point) => point.eventId === eventId && point.placeId === null)).toBe(true);
    expect(payload.points.some((point) => point.placeId === placeB && point.eventId === null)).toBe(true);
  });

  it("forbids reading another user's city", async () => {
    const service = new MyCityService(createStoreRepo<CheckInEntity>() as unknown as Repository<CheckInEntity>, createStoreRepo<EventEntity>() as unknown as Repository<EventEntity>, createStoreRepo<PlaceEntity>() as unknown as Repository<PlaceEntity>);
    await expect(service.forUser(otherUser, userId)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
