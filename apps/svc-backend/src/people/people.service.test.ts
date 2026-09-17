import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import type { FriendsService } from "../friends/friends.service";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";
import { PeopleService } from "./people.service";

const now = new Date("2026-09-12T10:00:00Z");
const me = "00000000-0000-4000-8000-00000000000a";
const other = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const placeId = "00000000-0000-4000-8000-0000000000p1";

function inValues(value: unknown): unknown[] | undefined {
  if (value && typeof value === "object" && Array.isArray((value as { _value?: unknown })._value)) return (value as { _value: unknown[] })._value;
  return undefined;
}

function matchesWhere(row: object, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    const cell = (row as Record<string, unknown>)[key];
    const values = inValues(value);
    if (values) return values.includes(cell);
    if (value && typeof value === "object" && "_value" in value) {
      const bound = (value as { _value: Date })._value;
      if (bound instanceof Date && cell instanceof Date) return cell.getTime() >= bound.getTime();
      return true;
    }
    return cell === value;
  });
}

function createStoreRepo<T extends object>(initial: T[] = []) {
  const store = [...initial];
  return { store, find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => matchesWhere(row as object, opts.where ?? {})) };
}

function eventRow(): EventEntity {
  return {
    id: eventId,
    title: "Джаз в парке",
    description: "",
    category: "afisha",
    city: "Москва",
    placeId,
    startsAt: new Date("2026-09-12T16:00:00+03:00"),
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

function createService(options: { otherPrivacy?: ProfileEntity["privacy"]; otherStatus?: ParticipationEntity["status"]; otherLat?: number; viewerCheckIn?: boolean; friendIds?: string[]; otherCity?: string } = {}) {
  const otherCity = options.otherCity ?? "Москва";
  const profiles = createStoreRepo<ProfileEntity>([
    { userId: me, city: "Москва", interests: ["джаз"] } as ProfileEntity,
    { userId: other, city: otherCity, interests: ["джаз"], privacy: options.otherPrivacy } as ProfileEntity,
  ]);
  const users = createStoreRepo<UserEntity>([{ id: me, firstName: "Саша", lastName: null, avatarUrl: null } as UserEntity, { id: other, firstName: "Кирилл", lastName: null, avatarUrl: null } as UserEntity]);
  const checkIns = createStoreRepo<CheckInEntity>([
    ...(options.viewerCheckIn === false ? [] : [{ id: "c1", userId: me, eventId: null, placeId, checkedInAt: now } as CheckInEntity]),
    { id: "c2", userId: other, eventId: null, placeId, checkedInAt: now } as CheckInEntity,
  ]);
  const events = createStoreRepo<EventEntity>([eventRow()]);
  const places = createStoreRepo<PlaceEntity>([{ id: placeId, title: "Парк", address: "x", city: "Москва", category: "park", latitude: options.otherLat ?? 55.75, longitude: 37.62, published: true, createdAt: now, updatedAt: now } as PlaceEntity]);
  const participations = createStoreRepo<ParticipationEntity>([
    { id: "p1", userId: me, eventId, status: "going" } as ParticipationEntity,
    { id: "p2", userId: other, eventId, status: options.otherStatus ?? "looking_for_company" } as ParticipationEntity,
  ]);
  const friends = { friendIds: async () => new Set(options.friendIds ?? []) } as unknown as FriendsService;
  const service = new PeopleService(
    users as unknown as Repository<UserEntity>,
    profiles as unknown as Repository<ProfileEntity>,
    checkIns as unknown as Repository<CheckInEntity>,
    events as unknown as Repository<EventEntity>,
    places as unknown as Repository<PlaceEntity>,
    participations as unknown as Repository<ParticipationEntity>,
    friends,
  );
  return service;
}

describe("PeopleService.suggest", () => {
  it("returns nearby people with a shared event and looking-for-company today", async () => {
    const payload = await createService().suggest(me, { latitude: 55.75, longitude: 37.62 }, now);
    expect(payload.nearbyCount).toBe(1);
    expect(payload.lookingForCompanyTodayCount).toBe(1);
    expect(payload.people[0]?.person.name).toBe("Кирилл");
    expect(payload.people[0]?.distanceKm).toBeNull();
    expect(payload.people[0]?.context).toMatchObject({ kind: "shared_event" });
    expect(payload.people[0]?.context.kind === "shared_event" && payload.people[0].context.explanation).toContain("вы оба хотите");
  });

  it("matches the same city without a live origin and without leaking visit distance", async () => {
    const service = createService({ viewerCheckIn: false });
    const payload = await service.suggest(me, null, now);
    expect(payload.nearbyCount).toBe(1);
    expect(payload.people[0]?.distanceKm).toBeNull();
  });

  it("omits visit-derived distance for non-friends and for hidden visit history", async () => {
    const hidden = await createService({ otherPrivacy: { visitHistory: "hidden", routes: "friends" } }).suggest(me, { latitude: 55.75, longitude: 37.62 }, now);
    expect(hidden.people[0]?.distanceKm).toBeNull();
    const friend = await createService({ friendIds: [other] }).suggest(me, { latitude: 55.75, longitude: 37.62 }, now);
    expect(friend.people[0]?.distanceKm).toBe(0);
  });

  it("matches probably_going as shared-event intent", async () => {
    const payload = await createService({ otherStatus: "probably_going" }).suggest(me, { latitude: 55.75, longitude: 37.62 }, now);
    expect(payload.people[0]?.context).toMatchObject({ kind: "shared_event" });
    expect(payload.lookingForCompanyTodayCount).toBe(0);
  });

  it("omits a friend more than 15 km away", async () => {
    const payload = await createService({ friendIds: [other], otherLat: 55.9 }).suggest(me, { latitude: 55.75, longitude: 37.62 }, now);
    expect(payload.people).toEqual([]);
  });

  it("omits a different-city candidate without usable visit coords", async () => {
    const payload = await createService({ otherCity: "Казань" }).suggest(me, { latitude: 55.75, longitude: 37.62 }, now);
    expect(payload.people).toEqual([]);
  });
});
