import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import type { FriendsService } from "../friends/friends.service";
import { PlaceEntity } from "../places/place.entity";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";
import { DiscoveryService } from "./discovery.service";

const now = new Date("2026-09-12T10:00:00Z");
const me = "00000000-0000-4000-8000-00000000000a";
const anna = "00000000-0000-4000-8000-00000000000b";
const parkId = "00000000-0000-4000-8000-0000000000p1";
const museumId = "00000000-0000-4000-8000-0000000000p2";

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

function createStoreRepo<T extends object>(initial: T[] = []) {
  const store = [...initial];
  return { store, find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => matchesWhere(row as object, opts.where ?? {})) };
}

function place(id: string, title: string): PlaceEntity {
  return { id, title, address: "x", city: "Москва", category: "park", latitude: 55.75, longitude: 37.62, published: true, createdAt: now, updatedAt: now } as PlaceEntity;
}

function createService(options: { hidden?: boolean } = {}) {
  const checkIns = createStoreRepo<CheckInEntity>([
    { id: "c1", userId: me, eventId: null, placeId: parkId, checkedInAt: now } as CheckInEntity,
    { id: "c2", userId: anna, eventId: null, placeId: parkId, checkedInAt: now } as CheckInEntity,
    { id: "c3", userId: anna, eventId: null, placeId: museumId, checkedInAt: now } as CheckInEntity,
  ]);
  const users = createStoreRepo<UserEntity>([
    { id: me, firstName: "Саша", lastName: null, avatarUrl: null } as UserEntity,
    { id: anna, firstName: "Анна", lastName: null, avatarUrl: null } as UserEntity,
  ]);
  const profiles = createStoreRepo<ProfileEntity>(
    options.hidden
      ? [{ userId: anna, city: "Москва", interests: [], smartAlerts: { leaveNow: true, weather: true, friendLeft: true, listDigest: true }, privacy: { visitHistory: "hidden", routes: "hidden" }, updatedAt: now } as unknown as ProfileEntity]
      : [],
  );
  const friends = { friendIds: async () => new Set([anna]) } as unknown as FriendsService;
  const service = new DiscoveryService(
    checkIns as unknown as Repository<CheckInEntity>,
    createStoreRepo<EventEntity>() as unknown as Repository<EventEntity>,
    createStoreRepo<PlaceEntity>([place(parkId, "Парк"), place(museumId, "Музей")]) as unknown as Repository<PlaceEntity>,
    users as unknown as Repository<UserEntity>,
    profiles as unknown as Repository<ProfileEntity>,
    friends,
  );
  return { service };
}

describe("DiscoveryService", () => {
  it("counts places friends opened that the viewer has not visited", async () => {
    const { service } = createService();
    const payload = await service.summary(me);
    expect(payload.newPlacesCount).toBe(1);
    expect(payload.byFriend[0]?.friend.name).toBe("Анна");
    expect(payload.byFriend[0]?.places.map((row) => row.title)).toEqual(["Музей"]);
    const route = await service.route(me, anna);
    expect(route.places).toHaveLength(1);
  });

  it("hides a friend who turned visit history off", async () => {
    const { service } = createService({ hidden: true });
    const payload = await service.summary(me);
    expect(payload.newPlacesCount).toBe(0);
    expect(payload.byFriend).toEqual([]);
    await expect(service.route(me, anna)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
