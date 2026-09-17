import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type DataSource, type EntityManager, type Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { UserEntity } from "../users/user.entity";
import { WaitlistEntryEntity } from "./waitlist-entry.entity";
import { WaitlistService } from "./waitlist.service";

const now = new Date("2026-09-12T10:00:00Z");
const userA = "00000000-0000-4000-8000-00000000000a";
const userB = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";

function seedEvent(bookedCount: number, capacity: number | null = 1, published = true): EventEntity {
  return { id: eventId, capacity, bookedCount, title: "Jazz", published } as EventEntity;
}

function createHarness(event: EventEntity) {
  const entries: WaitlistEntryEntity[] = [];
  const bookings: BookingEntity[] = [];
  const events = [event];
  const users = [{ id: userA, maxUserId: "1" } as UserEntity, { id: userB, maxUserId: "2" } as UserEntity];
  const sent: string[] = [];
  let seq = 0;
  const manager = {
    findOne: async (entity: unknown, options: { where: Record<string, unknown>; order?: { createdAt: string } }) => {
      const where = options.where;
      if (entity === EventEntity) return events.find((row) => row.id === where.id) ?? null;
      if (entity === BookingEntity) return bookings.find((row) => row.userId === where.userId && row.eventId === where.eventId && row.status === where.status) ?? null;
      const status = where.status as { _value?: string[] } | string | undefined;
      const statuses = typeof status === "string" ? [status] : Array.isArray((status as { _value?: string[] } | undefined)?._value) ? (status as { _value: string[] })._value : undefined;
      const matches = entries.filter((row) => {
        if (where.id && row.id !== where.id) return false;
        if (where.userId && row.userId !== where.userId) return false;
        if (where.eventId && row.eventId !== where.eventId) return false;
        if (statuses) return statuses.includes(row.status);
        if (typeof status === "string") return row.status === status;
        return true;
      });
      if (options.order?.createdAt === "ASC") matches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return matches[0] ?? null;
    },
    find: async (entity: unknown, options: { where: Record<string, unknown>; order?: { createdAt: string } }) => {
      if (entity !== WaitlistEntryEntity) return [];
      const where = options.where;
      const status = where.status as { _value?: string[] } | string | undefined;
      const statuses = typeof status === "string" ? [status] : Array.isArray((status as { _value?: string[] } | undefined)?._value) ? (status as { _value: string[] })._value : undefined;
      const rows = entries.filter((row) => {
        if (where.eventId && row.eventId !== where.eventId) return false;
        if (statuses) return statuses.includes(row.status);
        return true;
      });
      return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    create: (_entity: unknown, fields: Partial<WaitlistEntryEntity | BookingEntity>) => ({ ...fields }),
    save: async (entity: unknown, row: WaitlistEntryEntity | EventEntity | BookingEntity) => {
      if (entity === EventEntity) return row;
      if (entity === BookingEntity) {
        const booking = row as BookingEntity;
        if (booking.status === "active" && bookings.some((item) => item !== booking && item.userId === booking.userId && item.eventId === booking.eventId && item.status === "active")) {
          throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate"), { code: "23505" }));
        }
        if (!bookings.includes(booking)) {
          booking.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
          booking.createdAt ??= now;
          booking.updatedAt ??= now;
          bookings.push(booking);
        }
        return booking;
      }
      const entry = row as WaitlistEntryEntity;
      if (!entries.includes(entry)) {
        entry.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        entry.createdAt ??= now;
        entry.updatedAt ??= now;
        entries.push(entry);
      }
      return entry;
    },
  };
  const dataSource = {
    transaction: async <T>(run: (em: EntityManager) => Promise<T>) => run(manager as unknown as EntityManager),
  } as unknown as DataSource;
  const bot = {
    sendMessage: async (maxUserId: string, text: string) => {
      sent.push(`${maxUserId}:${text}`);
      return true;
    },
  } as unknown as MaxBotClient;
  const entriesRepo = {
    find: async (opts: { where: { status?: string } }) =>
      entries.filter((row) => {
        if (opts.where.status && row.status !== opts.where.status) return false;
        if (row.offeredUntil && row.offeredUntil.getTime() > now.getTime()) return false;
        return true;
      }),
  };
  const service = new WaitlistService(dataSource, entriesRepo as unknown as Repository<WaitlistEntryEntity>, { findOneBy: async () => event } as unknown as Repository<EventEntity>, { findOneBy: async (where: { id: string }) => users.find((row) => row.id === where.id) ?? null } as unknown as Repository<UserEntity>, bot);
  return { service, entries, events, bookings, sent, manager, entriesRepo, bot };
}

describe("WaitlistService.join", () => {
  it("rejects joining while seats remain", async () => {
    const { service } = createHarness(seedEvent(0, 1));
    await expect(service.join(userA, eventId)).rejects.toBeInstanceOf(ConflictException);
  });

  it("enqueues FIFO positions when the event is full", async () => {
    const { service } = createHarness(seedEvent(1, 1));
    const first = await service.join(userA, eventId);
    const second = await service.join(userB, eventId);
    expect(first.position).toBe(1);
    expect(second.position).toBe(2);
    expect(first.status).toBe("waiting");
  });

  it("rejects a second join by the same user", async () => {
    const { service } = createHarness(seedEvent(1, 1));
    await service.join(userA, eventId);
    await expect(service.join(userA, eventId)).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects joining an unpublished event", async () => {
    const { service } = createHarness(seedEvent(1, 1, false));
    await expect(service.join(userA, eventId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects joining while public booking has not opened", async () => {
    const event = seedEvent(1, 1);
    event.bookingOpensAt = new Date("2026-09-20T00:00:00Z");
    const { service } = createHarness(event);
    await expect(service.join(userA, eventId)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("WaitlistService.onSeatFreed, confirm and expiry", () => {
  it("offers the first waiter, notifies them, and confirm creates a booking", async () => {
    const harness = createHarness(seedEvent(1, 1));
    const joined = await harness.service.join(userA, eventId);
    harness.events[0]!.bookedCount = 0;
    const offered = await harness.service.onSeatFreed(harness.manager as unknown as EntityManager, harness.events[0]!, now);
    expect(offered?.id).toBe(joined.id);
    expect(offered?.status).toBe("offered");
    expect(harness.events[0]!.bookedCount).toBe(1);
    await harness.service.notifyOffer(offered!);
    expect(harness.sent[0]).toContain("1:");
    expect(harness.sent[0]).toContain("подтверди");
    const confirmed = await harness.service.confirm(userA, joined.id, now);
    expect(confirmed.status).toBe("confirmed");
    expect(harness.bookings).toHaveLength(1);
    expect(harness.bookings[0]?.userId).toBe(userA);
  });

  it("passes an expired offer to the next waiter without double-counting the reserved seat", async () => {
    const harness = createHarness(seedEvent(1, 1));
    const first = await harness.service.join(userA, eventId);
    await harness.service.join(userB, eventId);
    harness.events[0]!.bookedCount = 0;
    await harness.service.onSeatFreed(harness.manager as unknown as EntityManager, harness.events[0]!, now);
    const firstRow = harness.entries.find((row) => row.id === first.id)!;
    firstRow.offeredUntil = new Date(now.getTime() - 1);
    const expired = await harness.service.expireOffers(now);
    expect(expired).toBe(1);
    expect(firstRow.status).toBe("expired");
    const next = harness.entries.find((row) => row.userId === userB);
    expect(next?.status).toBe("offered");
    expect(harness.events[0]!.bookedCount).toBe(1);
  });

  it("skips a waiter who already has an active booking and offers the next", async () => {
    const harness = createHarness(seedEvent(1, 1));
    await harness.service.join(userA, eventId);
    await harness.service.join(userB, eventId);
    harness.bookings.push({ id: "b1", userId: userA, eventId, status: "active" } as BookingEntity);
    harness.events[0]!.bookedCount = 0;
    const offered = await harness.service.onSeatFreed(harness.manager as unknown as EntityManager, harness.events[0]!, now);
    expect(offered?.userId).toBe(userB);
    expect(harness.entries.find((row) => row.userId === userA)?.status).toBe("cancelled");
  });

  it("is idempotent when confirming an already confirmed offer", async () => {
    const harness = createHarness(seedEvent(1, 1));
    const joined = await harness.service.join(userA, eventId);
    harness.events[0]!.bookedCount = 0;
    await harness.service.onSeatFreed(harness.manager as unknown as EntityManager, harness.events[0]!, now);
    const first = await harness.service.confirm(userA, joined.id, now);
    const second = await harness.service.confirm(userA, joined.id, now);
    expect(first.status).toBe("confirmed");
    expect(second.status).toBe("confirmed");
    expect(harness.bookings).toHaveLength(1);
  });

  it("expires a 23505 confirm and passes the seat to the next waiter", async () => {
    const harness = createHarness(seedEvent(1, 1));
    const first = await harness.service.join(userA, eventId);
    await harness.service.join(userB, eventId);
    harness.bookings.push({ id: "b1", userId: userA, eventId, status: "active" } as BookingEntity);
    harness.events[0]!.bookedCount = 1;
    const firstRow = harness.entries.find((row) => row.id === first.id)!;
    firstRow.status = "offered";
    firstRow.offeredUntil = new Date(now.getTime() + 60_000);
    await expect(harness.service.confirm(userA, first.id, now)).rejects.toMatchObject({ message: "Booking already exists" });
    expect(firstRow.status).toBe("expired");
    expect(harness.entries.find((row) => row.userId === userB)?.status).toBe("offered");
    expect(harness.sent[0]).toContain("2:");
  });

  it("returns the FIFO position among remaining offered and waiting entries", async () => {
    const harness = createHarness(seedEvent(2, 2));
    await harness.service.join(userA, eventId);
    const second = await harness.service.join(userB, eventId);
    harness.events[0]!.capacity = 4;
    await harness.service.fillVacancies(eventId, now);
    const confirmed = await harness.service.confirm(userB, second.id, now);
    expect(confirmed.position).toBe(2);
    expect(confirmed.status).toBe("confirmed");
  });

  it("rejects confirm on an unpublished event", async () => {
    const harness = createHarness(seedEvent(1, 1));
    const joined = await harness.service.join(userA, eventId);
    harness.events[0]!.bookedCount = 0;
    await harness.service.onSeatFreed(harness.manager as unknown as EntityManager, harness.events[0]!, now);
    harness.events[0]!.published = false;
    await expect(harness.service.confirm(userA, joined.id, now)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("does not offer or confirm a waitlist seat during early access", async () => {
    const event = seedEvent(1, 1);
    const harness = createHarness(event);
    const joined = await harness.service.join(userA, eventId);
    event.bookingOpensAt = new Date("2026-09-20T00:00:00Z");
    harness.events[0]!.bookedCount = 0;
    const offered = await harness.service.onSeatFreed(harness.manager as unknown as EntityManager, event, now);
    expect(offered).toBeNull();
    const row = harness.entries.find((item) => item.id === joined.id)!;
    row.status = "offered";
    row.offeredUntil = new Date(now.getTime() + 60_000);
    await expect(harness.service.confirm(userA, joined.id, now)).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.bookings).toHaveLength(0);
  });

  it("does not start a second expireOffers while the first is running", async () => {
    const harness = createHarness(seedEvent(1, 1));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = harness.entriesRepo.find;
    harness.entriesRepo.find = async (opts) => {
      await gate;
      return original(opts);
    };
    const first = harness.service.expireOffers(now);
    await expect(harness.service.expireOffers(now)).resolves.toBe(0);
    release();
    await first;
  });

  it("keeps expiring remaining offers when notify throws", async () => {
    const harness = createHarness(seedEvent(1, 1));
    harness.bot.sendMessage = async () => {
      throw new Error("bot down");
    };
    harness.entries.push({ id: "o1", userId: userA, eventId, status: "offered", offeredUntil: new Date(now.getTime() - 1), createdAt: now, updatedAt: now } as WaitlistEntryEntity, { id: "o2", userId: userB, eventId, status: "offered", offeredUntil: new Date(now.getTime() - 1), createdAt: now, updatedAt: now } as WaitlistEntryEntity);
    await expect(harness.service.expireOffers(now)).resolves.toBe(2);
    expect(harness.entries.every((row) => row.status === "expired")).toBe(true);
  });
});
