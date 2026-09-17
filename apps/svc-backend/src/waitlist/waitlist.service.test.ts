import { ConflictException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { DataSource, EntityManager, Repository } from "typeorm";
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

function seedEvent(bookedCount: number, capacity: number | null = 1): EventEntity {
  return { id: eventId, capacity, bookedCount, title: "Jazz" } as EventEntity;
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
      const rows = entries.filter((row) => row.eventId === options.where.eventId);
      return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    create: (_entity: unknown, fields: Partial<WaitlistEntryEntity | BookingEntity>) => ({ ...fields }),
    save: async (entity: unknown, row: WaitlistEntryEntity | EventEntity | BookingEntity) => {
      if (entity === EventEntity) return row;
      if (entity === BookingEntity) {
        const booking = row as BookingEntity;
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
  const service = new WaitlistService(dataSource, { find: async (opts: { where: { status: string } }) => entries.filter((row) => row.status === opts.where.status) } as unknown as Repository<WaitlistEntryEntity>, { findOneBy: async () => event } as unknown as Repository<EventEntity>, { findOneBy: async (where: { id: string }) => users.find((row) => row.id === where.id) ?? null } as unknown as Repository<UserEntity>, bot);
  return { service, entries, events, bookings, sent, manager };
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
});
