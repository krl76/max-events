import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { FindOperator, type Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import type { FriendsService } from "../friends/friends.service";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { CalendarGoingEntity } from "./calendar-going.entity";
import { CalendarInviteEntity } from "./calendar-invite.entity";
import { CalendarShareEntity } from "./calendar-share.entity";
import { CalendarService } from "./calendar.service";

const userId = "00000000-0000-4000-8000-00000000000a";
const annaId = "00000000-0000-4000-8000-00000000000b";
const dimaId = "00000000-0000-4000-8000-00000000000c";
const now = new Date("2026-09-15T00:00:00Z");
const host = "events.versacegus.cc";

function event(id: string, startsAt: string, published = true): EventEntity {
  return {
    id,
    title: id,
    description: "",
    category: "afisha",
    city: "Москва",
    placeId: null,
    organizerUserId: null,
    startsAt: new Date(startsAt),
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: null,
    bookedCount: 1,
    published,
    bookingOpensAt: null,
    chatLink: null,
    chatSyncPending: false,
    createdAt: now,
    updatedAt: now,
  } as EventEntity;
}

function booking(id: string, owner: string, eventId: string, status: "active" | "cancelled" = "active"): BookingEntity {
  return { id, userId: owner, eventId, status, promoCode: null, createdAt: now, updatedAt: now, reminderSentAt: null } as BookingEntity;
}

function user(id: string, firstName: string): UserEntity {
  return { id, maxUserId: id, firstName, lastName: null, avatarUrl: null, createdAt: now, updatedAt: now } as UserEntity;
}

function matchesCell(cell: unknown, condition: unknown): boolean {
  if (condition instanceof FindOperator) {
    if (condition.type === "in") return (condition.value as unknown as unknown[]).includes(cell);
    throw new Error(`unsupported find operator: ${condition.type}`);
  }
  return cell === condition;
}

function createStoreRepo<T extends object>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields, createdAt: now }) as unknown as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => matchesCell((row as Record<string, unknown>)[key], value)));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        (entity as { id?: string }).id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        store.push(entity);
      }
      return entity;
    },
    delete: async (where: Record<string, string>) => {
      const before = store.length;
      for (let i = store.length - 1; i >= 0; i--) {
        if (Object.entries(where).every(([key, value]) => (store[i] as Record<string, unknown>)[key] === value)) store.splice(i, 1);
      }
      return { affected: before - store.length };
    },
  };
}

function createService(opts: { friendIds?: string[]; bookings?: BookingEntity[]; events?: EventEntity[] } = {}) {
  const bookings = createStoreRepo<BookingEntity>(opts.bookings ?? [booking("b-anna", annaId, "e-anna"), booking("b-me", userId, "e-me"), booking("b-cancelled", annaId, "e-other", "cancelled")]);
  const events = createStoreRepo<EventEntity>(opts.events ?? [event("e-anna", "2026-09-20T16:00:00Z"), event("e-me", "2026-09-21T16:00:00Z"), event("e-other", "2026-09-22T16:00:00Z")]);
  const places = createStoreRepo<PlaceEntity>();
  const shares = createStoreRepo<CalendarShareEntity>();
  const invites = createStoreRepo<CalendarInviteEntity>();
  const goings = createStoreRepo<CalendarGoingEntity>();
  const users = createStoreRepo<UserEntity>([user(userId, "Саша"), user(annaId, "Анна"), user(dimaId, "Дима")]);
  const friends = { friendIds: async () => new Set(opts.friendIds ?? [annaId]) } as unknown as FriendsService;
  const service = new CalendarService(bookings as unknown as Repository<BookingEntity>, events as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>, shares as unknown as Repository<CalendarShareEntity>, invites as unknown as Repository<CalendarInviteEntity>, goings as unknown as Repository<CalendarGoingEntity>, users as unknown as Repository<UserEntity>, friends);
  return { service, shares, invites, goings };
}

describe("CalendarService shared", () => {
  it("returns no peers until one is added, but still issues an invite link", async () => {
    const { service } = createService();
    const calendar = await service.shared(userId, { from: null, to: null }, host);
    expect(calendar.peers).toEqual([]);
    expect(calendar.entries).toEqual([]);
    expect(calendar.inviteUrl).toMatch(/^https:\/\/events\.versacegus\.cc\/calendar\/invite\//);
  });

  it("adds a friend mutually so their bookings show up with an owner and «Пойду»", async () => {
    const { service } = createService();
    const calendar = await service.addPeer(userId, annaId, true, host);
    expect(calendar.peers).toEqual([{ friend: { id: annaId, name: "Анна", avatarUrl: null }, canEdit: true }]);
    expect(calendar.entries).toEqual([
      {
        id: "b-anna",
        owner: { id: annaId, name: "Анна", avatarUrl: null },
        title: "e-anna",
        startsAt: "2026-09-20T16:00:00.000Z",
        endsAt: null,
        bothGoing: false,
        needsResponse: true,
        eventId: "e-anna",
      },
    ]);
    const asAnna = await service.shared(annaId, { from: null, to: null }, host);
    expect(asAnna.peers.map((row) => row.friend.id)).toEqual([userId]);
    expect(asAnna.entries.map((row) => row.id)).toEqual(["b-me"]);
  });

  it("rejects sharing with self or a non-friend and is idempotent for a friend already added", async () => {
    const { service, shares } = createService();
    await expect(service.addPeer(userId, userId)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.addPeer(userId, dimaId)).rejects.toBeInstanceOf(BadRequestException);
    await service.addPeer(userId, annaId);
    await service.addPeer(userId, annaId);
    expect(shares.store).toHaveLength(2);
  });

  it("marks «Пойду» on a peer booking without creating a second row on repeat", async () => {
    const { service, goings } = createService();
    await service.addPeer(userId, annaId);
    const after = await service.going(userId, "b-anna", host);
    expect(after.entries[0]).toMatchObject({ bothGoing: true, needsResponse: false });
    await service.going(userId, "b-anna", host);
    expect(goings.store).toHaveLength(1);
  });

  it("does not leak another user's booking and forbids going on a view-only share", async () => {
    const { service } = createService();
    await service.addPeer(userId, annaId, false);
    await expect(service.going(userId, "b-anna")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.going(userId, "b-missing")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.going(userId, "b-me")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("revokes both directions and 404s when there is nothing to revoke", async () => {
    const { service, shares } = createService();
    await service.addPeer(userId, annaId);
    const after = await service.revokePeer(userId, annaId, host);
    expect(after.peers).toEqual([]);
    expect(after.entries).toEqual([]);
    expect(shares.store).toEqual([]);
    await expect(service.revokePeer(userId, annaId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("accepts an invite token without a prior friendship and rejects a missing or own token", async () => {
    const { service, invites } = createService({ friendIds: [] });
    await service.shared(annaId, { from: null, to: null }, host);
    const token = invites.store[0]?.token as string;
    const calendar = await service.acceptInvite(userId, token, host);
    expect(calendar.peers.map((row) => row.friend.id)).toEqual([annaId]);
    expect(calendar.entries.map((row) => row.id)).toEqual(["b-anna"]);
    await expect(service.acceptInvite(userId, "00000000-0000-4000-8000-0000000000ff")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.acceptInvite(annaId, token)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("hides an unpublished peer event from the shared list and 404s going on its booking", async () => {
    const { service } = createService({
      bookings: [booking("b-live", annaId, "e-live"), booking("b-hidden", annaId, "e-hidden")],
      events: [event("e-live", "2026-09-20T16:00:00Z"), event("e-hidden", "2026-09-21T16:00:00Z", false)],
    });
    await service.addPeer(userId, annaId);
    const calendar = await service.shared(userId, { from: null, to: null }, host);
    expect(calendar.entries.map((row) => row.id)).toEqual(["b-live"]);
    await expect(service.going(userId, "b-hidden")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("filters shared entries by the same from/to window as GET /calendar", async () => {
    const { service } = createService({
      bookings: [booking("b-early", annaId, "e-early"), booking("b-in", annaId, "e-in")],
      events: [event("e-early", "2026-09-10T16:00:00Z"), event("e-in", "2026-09-20T16:00:00Z")],
    });
    await service.addPeer(userId, annaId);
    const calendar = await service.shared(userId, { from: new Date("2026-09-15T00:00:00Z"), to: new Date("2026-09-25T00:00:00Z") }, host);
    expect(calendar.entries.map((row) => row.id)).toEqual(["b-in"]);
  });
});
