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

function createService(options: { hidden?: boolean; routesHidden?: boolean; routesClose?: boolean; markedClose?: boolean; unpublishedMuseum?: boolean } = {}) {
  const museum = place(museumId, "Музей");
  if (options.unpublishedMuseum) museum.published = false;
  const privacy = options.hidden ? { visitHistory: "hidden" as const, routes: "hidden" as const } : options.routesHidden ? { visitHistory: "friends" as const, routes: "hidden" as const } : options.routesClose ? { visitHistory: "friends" as const, routes: "close" as const } : null;
  const checkIns = createStoreRepo<CheckInEntity>([{ id: "c1", userId: me, eventId: null, placeId: parkId, checkedInAt: now } as CheckInEntity, { id: "c2", userId: anna, eventId: null, placeId: parkId, checkedInAt: now } as CheckInEntity, { id: "c3", userId: anna, eventId: null, placeId: museumId, checkedInAt: now } as CheckInEntity]);
  const users = createStoreRepo<UserEntity>([{ id: me, firstName: "Саша", lastName: null, avatarUrl: null } as UserEntity, { id: anna, firstName: "Анна", lastName: null, avatarUrl: null } as UserEntity]);
  const profiles = createStoreRepo<ProfileEntity>(privacy ? [{ userId: anna, city: "Москва", interests: [], smartAlerts: { leaveNow: true, weather: true, friendLeft: true, listDigest: true }, privacy, updatedAt: now } as unknown as ProfileEntity] : []);
  const friends = { friendIds: async () => new Set([anna]), authorsWhoMarkedClose: async () => new Set(options.markedClose ? [anna] : []) } as unknown as FriendsService;
  const service = new DiscoveryService(checkIns as unknown as Repository<CheckInEntity>, createStoreRepo<EventEntity>() as unknown as Repository<EventEntity>, createStoreRepo<PlaceEntity>([place(parkId, "Парк"), museum]) as unknown as Repository<PlaceEntity>, users as unknown as Repository<UserEntity>, profiles as unknown as Repository<ProfileEntity>, friends);
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

  it("omits the place trail when routes are hidden but keeps the count", async () => {
    const { service } = createService({ routesHidden: true });
    const payload = await service.summary(me);
    expect(payload.newPlacesCount).toBe(1);
    expect(payload.byFriend[0]?.newPlacesCount).toBe(1);
    expect(payload.byFriend[0]?.places).toEqual([]);
    await expect(service.route(me, anna)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("shows a close-friends trail only to someone that friend marked close", async () => {
    const closed = await createService({ routesClose: true }).service.summary(me);
    expect(closed.newPlacesCount).toBe(1);
    expect(closed.byFriend[0]?.places).toEqual([]);
    await expect(createService({ routesClose: true }).service.route(me, anna)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await createService({ routesClose: true }).service.friendPlaces(me)).toEqual([]);

    const open = await createService({ routesClose: true, markedClose: true }).service.summary(me);
    expect(open.byFriend[0]?.places.map((row) => row.title)).toEqual(["Музей"]);
    expect((await createService({ routesClose: true, markedClose: true }).service.route(me, anna)).places).toHaveLength(1);
  });

  it("drops unpublished places from the friend trail", async () => {
    const { service } = createService({ unpublishedMuseum: true });
    const payload = await service.summary(me);
    expect(payload.newPlacesCount).toBe(0);
    expect(payload.byFriend).toEqual([]);
  });

  it("keeps a friend who turned visit history off as a hidden-state row", async () => {
    const { service } = createService({ hidden: true });
    const payload = await service.summary(me);
    expect(payload.newPlacesCount).toBe(0);
    expect(payload.byFriend).toEqual([{ friend: { id: anna, name: "Анна", avatarUrl: null }, newPlacesCount: 0, places: [], visitHistoryHidden: true }]);
    await expect(service.route(me, anna)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("DiscoveryService.friendPlaces", () => {
  it("keeps the places the viewer has been to as well, because the layer is about company", async () => {
    const { service } = createService();
    const layer = await service.friendPlaces(me);

    // The park is where both of them checked in; the summary hides it, the map layer must not.
    expect(layer.map((row) => row.place.title)).toEqual(["Музей", "Парк"]);
    expect(layer.every((row) => row.friends.map((friend) => friend.name).includes("Анна"))).toBe(true);
    expect(layer.every((row) => row.lastVisitAt === now.toISOString())).toBe(true);
  });

  it("drops a friend who hid either their visit history or their routes", async () => {
    expect(await createService({ hidden: true }).service.friendPlaces(me)).toEqual([]);
    // A marker says where a friend has been — exactly what summary() withholds when routes are hidden.
    expect(await createService({ routesHidden: true }).service.friendPlaces(me)).toEqual([]);
  });

  it("never points at a place that is no longer published", async () => {
    expect((await createService({ unpublishedMuseum: true }).service.friendPlaces(me)).map((row) => row.place.title)).toEqual(["Парк"]);
  });
});
