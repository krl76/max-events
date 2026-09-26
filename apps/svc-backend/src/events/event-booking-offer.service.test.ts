import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { UserEntity } from "../users/user.entity";
import { WaitlistEntryEntity } from "../waitlist/waitlist-entry.entity";
import { EventBookingOfferService } from "./event-booking-offer.service";
import { EventEntity } from "./event.entity";

const now = new Date("2026-09-12T10:00:00Z");
const eventId = "00000000-0000-4000-8000-0000000000e1";
const meId = "00000000-0000-4000-8000-00000000000a";
const annaId = "00000000-0000-4000-8000-00000000000b";
const dimaId = "00000000-0000-4000-8000-00000000000c";

function inValues(value: unknown): unknown[] | undefined {
  if (value && typeof value === "object" && Array.isArray((value as { _value?: unknown })._value)) return (value as { _value: unknown[] })._value;
  if (value && typeof value === "object" && Array.isArray((value as { value?: unknown }).value)) return (value as { value: unknown[] }).value;
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
    findOneBy: async (where: Record<string, unknown>) => store.find((row) => matchesWhere(row as object, where)) ?? null,
    find: async (opts: { where?: Record<string, unknown>; order?: { createdAt?: "ASC" | "DESC" } } = {}) => {
      let rows = store.filter((row) => matchesWhere(row as object, opts.where ?? {}));
      if (opts.order?.createdAt === "ASC") rows = [...rows].sort((a, b) => ((a as { createdAt?: Date }).createdAt?.getTime() ?? 0) - ((b as { createdAt?: Date }).createdAt?.getTime() ?? 0));
      return rows;
    },
  };
}

function user(id: string, firstName: string): UserEntity {
  return { id, firstName, lastName: null, avatarUrl: null } as UserEntity;
}

function createService(opts: { published?: boolean; queue?: WaitlistEntryEntity[]; bookings?: BookingEntity[]; friendships?: FriendshipEntity[] } = {}) {
  const events = createStoreRepo<EventEntity>([{ id: eventId, published: opts.published ?? true } as EventEntity]);
  const waitlist = createStoreRepo<WaitlistEntryEntity>(opts.queue ?? []);
  const bookings = createStoreRepo<BookingEntity>(opts.bookings ?? []);
  const friendships = createStoreRepo<FriendshipEntity>(opts.friendships ?? []);
  const users = createStoreRepo<UserEntity>([user(meId, "Я"), user(annaId, "Анна"), user(dimaId, "Дима")]);
  const service = new EventBookingOfferService(events as unknown as Repository<EventEntity>, waitlist as unknown as Repository<WaitlistEntryEntity>, bookings as unknown as Repository<BookingEntity>, friendships as unknown as Repository<FriendshipEntity>, users as unknown as Repository<UserEntity>);
  return { service };
}

describe("EventBookingOfferService", () => {
  it("404s an unpublished event", async () => {
    const { service } = createService({ published: false });
    await expect(service.get(eventId, meId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("counts people strictly ahead in the FIFO queue and lists friends with an active ticket", async () => {
    const { service } = createService({
      queue: [{ id: "w1", userId: annaId, eventId, status: "waiting", createdAt: new Date("2026-09-12T10:00:00Z") } as WaitlistEntryEntity, { id: "w2", userId: meId, eventId, status: "offered", createdAt: new Date("2026-09-12T10:01:00Z") } as WaitlistEntryEntity, { id: "w3", userId: dimaId, eventId, status: "waiting", createdAt: new Date("2026-09-12T10:02:00Z") } as WaitlistEntryEntity, { id: "w4", userId: annaId, eventId, status: "cancelled", createdAt: new Date("2026-09-12T09:00:00Z") } as WaitlistEntryEntity],
      bookings: [{ id: "b1", userId: annaId, eventId, status: "active" } as BookingEntity, { id: "b2", userId: dimaId, eventId, status: "cancelled" } as BookingEntity, { id: "b3", userId: meId, eventId, status: "active" } as BookingEntity],
      friendships: [{ id: "f1", userId: meId, friendUserId: annaId } as FriendshipEntity, { id: "f2", userId: meId, friendUserId: dimaId } as FriendshipEntity],
    });
    const offer = await service.get(eventId, meId);
    expect(offer.waitlistAhead).toBe(1);
    expect(offer.friendsWithTickets.map((friend) => friend.name)).toEqual(["Анна"]);
  });

  it("answers zero ahead when the viewer is not on the waitlist", async () => {
    const { service } = createService({
      queue: [{ id: "w1", userId: annaId, eventId, status: "waiting", createdAt: now } as WaitlistEntryEntity],
    });
    await expect(service.get(eventId, meId)).resolves.toEqual({ waitlistAhead: 0, friendsWithTickets: [] });
  });
});
