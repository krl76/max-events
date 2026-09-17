import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
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

describe("PeopleService.suggest", () => {
  it("returns nearby people with a shared event and looking-for-company today", async () => {
    const profiles = createStoreRepo<ProfileEntity>([
      { userId: me, city: "Москва", interests: ["джаз"] } as ProfileEntity,
      { userId: other, city: "Москва", interests: ["джаз"] } as ProfileEntity,
    ]);
    const users = createStoreRepo<UserEntity>([
      { id: me, firstName: "Саша", lastName: null, avatarUrl: null } as UserEntity,
      { id: other, firstName: "Кирилл", lastName: null, avatarUrl: null } as UserEntity,
    ]);
    const checkIns = createStoreRepo<CheckInEntity>([
      { id: "c1", userId: me, eventId: null, placeId, checkedInAt: now } as CheckInEntity,
      { id: "c2", userId: other, eventId: null, placeId, checkedInAt: now } as CheckInEntity,
    ]);
    const events = createStoreRepo<EventEntity>([
      {
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
      } as EventEntity,
    ]);
    const places = createStoreRepo<PlaceEntity>([{ id: placeId, title: "Парк", address: "x", city: "Москва", category: "park", latitude: 55.75, longitude: 37.62, published: true, createdAt: now, updatedAt: now } as PlaceEntity]);
    const participations = createStoreRepo<ParticipationEntity>([
      { id: "p1", userId: me, eventId, status: "going" } as ParticipationEntity,
      { id: "p2", userId: other, eventId, status: "looking_for_company" } as ParticipationEntity,
    ]);
    const service = new PeopleService(
      users as unknown as Repository<UserEntity>,
      profiles as unknown as Repository<ProfileEntity>,
      checkIns as unknown as Repository<CheckInEntity>,
      events as unknown as Repository<EventEntity>,
      places as unknown as Repository<PlaceEntity>,
      participations as unknown as Repository<ParticipationEntity>,
    );
    const payload = await service.suggest(me, { latitude: 55.75, longitude: 37.62 }, now);
    expect(payload.nearbyCount).toBe(1);
    expect(payload.lookingForCompanyTodayCount).toBe(1);
    expect(payload.people[0]?.person.name).toBe("Кирилл");
    expect(payload.people[0]?.context).toMatchObject({ kind: "shared_event" });
    expect(payload.people[0]?.context.kind === "shared_event" && payload.people[0].context.explanation).toContain("вы оба хотите");
  });
});
