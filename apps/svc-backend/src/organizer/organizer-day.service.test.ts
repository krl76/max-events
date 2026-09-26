import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { UserEntity } from "../users/user.entity";
import { WaitlistEntryEntity } from "../waitlist/waitlist-entry.entity";
import type { WaitlistService } from "../waitlist/waitlist.service";
import { EventOptionsEntity } from "./event-options.entity";
import { OrganizerDayService } from "./organizer-day.service";

const now = new Date("2026-09-12T10:00:00Z");
const orgId = "00000000-0000-4000-8000-0000000000c1";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const userId = "00000000-0000-4000-8000-00000000000a";

function inValues(value: unknown): unknown[] | undefined {
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
    find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => matchesWhere(row as object, opts.where ?? {})),
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    merge: (entity: T, fields: Partial<T>) => Object.assign(entity, fields),
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= "00000000-0000-4000-8000-0000000000o1";
        store.push(entity);
      }
      return entity;
    },
  };
}

function createService() {
  const events = createStoreRepo<EventEntity>([{ id: eventId, organizerOrganizationId: orgId, capacity: 10, bookedCount: 1 } as EventEntity]);
  const options = createStoreRepo<EventOptionsEntity>();
  const bookings = createStoreRepo<BookingEntity>([{ id: "00000000-0000-4000-8000-0000000000b1", eventId, userId, status: "active", createdAt: now } as BookingEntity, { id: "00000000-0000-4000-8000-0000000000b2", eventId, userId, status: "cancelled", createdAt: now } as BookingEntity]);
  const checkIns = createStoreRepo<CheckInEntity>([{ id: "c1", eventId, userId, checkedInAt: now } as CheckInEntity]);
  const waitlist = createStoreRepo<WaitlistEntryEntity>([{ id: "00000000-0000-4000-8000-0000000000w1", eventId, userId, status: "waiting", createdAt: now } as WaitlistEntryEntity]);
  const users = createStoreRepo<UserEntity>([{ id: userId, firstName: "Анна", lastName: "Соколова" } as UserEntity]);
  const waitlistOffers = { inviteNext: async (_eventId: string, count: number) => Math.min(count, 1) } as unknown as WaitlistService;
  const service = new OrganizerDayService(events as unknown as Repository<EventEntity>, options as unknown as Repository<EventOptionsEntity>, bookings as unknown as Repository<BookingEntity>, checkIns as unknown as Repository<CheckInEntity>, waitlist as unknown as Repository<WaitlistEntryEntity>, users as unknown as Repository<UserEntity>, waitlistOffers);
  return { service, options };
}

describe("OrganizerDayService", () => {
  it("defaults options then patches them without inventing Event columns", async () => {
    const { service } = createService();
    const fresh = await service.getOptions(orgId, eventId);
    expect(fresh).toMatchObject({ waitlistEnabled: true, registrationInApp: true, externalUrl: null, recurrence: null });
    const patched = await service.updateOptions(orgId, eventId, { waitlistEnabled: false, externalUrl: "https://tickets.example.com" });
    expect(patched.waitlistEnabled).toBe(false);
    expect(patched.externalUrl).toBe("https://tickets.example.com");
    expect(patched.registrationInApp).toBe(true);
  });

  it("builds attendance from bookings, check-ins and the waitlist", async () => {
    const { service } = createService();
    const day = await service.attendance(orgId, eventId);
    expect(day.bookedCount).toBe(1);
    expect(day.checkedInCount).toBe(1);
    expect(day.freedSeats).toBe(1);
    expect(day.waitlistCount).toBe(1);
    expect(day.participants[0]?.name).toBe("Анна Соколова");
    expect(day.participants[0]?.checkedInAt).not.toBeNull();
    expect(day.chatMessages).toBeNull();
    expect(day.slots).toEqual([]);
  });

  it("invites from the waitlist and 403s a stranger", async () => {
    const { service } = createService();
    await expect(service.inviteWaitlist(orgId, eventId, 3)).resolves.toEqual({ invited: 1 });
    await expect(service.attendance("00000000-0000-4000-8000-0000000000ff", eventId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getOptions(orgId, "00000000-0000-4000-8000-0000000000e9")).rejects.toBeInstanceOf(NotFoundException);
  });
});
