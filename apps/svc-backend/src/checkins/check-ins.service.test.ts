import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { FindOperator, QueryFailedError, type Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import type { UsersService } from "../users/users.service";
import { CheckInEntity } from "./check-in.entity";
import { CheckInsService, utcVisitDate } from "./check-ins.service";
import { entryCodeFromBookingId } from "./entry-code";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const otherUser = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const orgId = "00000000-0000-4000-8000-0000000000c1";
const bookingId = "00000000-0000-4000-8000-0000000000b1";
const placeId = "00000000-0000-4000-8000-0000000000p1";
const otherPlaceId = "00000000-0000-4000-8000-0000000000p2";

function eventRow(): EventEntity {
  return {
    id: eventId,
    title: "Субботник",
    description: "",
    category: "volunteering",
    city: "Москва",
    placeId,
    organizerUserId: null,
    organizerOrganizationId: orgId,
    startsAt: now,
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

// stats() reads the visited places with In(...), so the fake has to match the operator.
function matchesCell(cell: unknown, condition: unknown): boolean {
  if (condition instanceof FindOperator) {
    if (condition.type === "in") return (condition.value as unknown as unknown[]).includes(cell);
    throw new Error(`unsupported find operator in fake repository: ${condition.type}`);
  }
  return cell === condition;
}

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => matchesCell((row as Record<string, unknown>)[key], value)));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        (entity as { checkedInAt?: Date }).checkedInAt ??= now;
        store.push(entity);
      }
      return entity;
    },
  };
}

function createService(options: { bookings?: BookingEntity[] } = {}) {
  const checkIns = createStoreRepo<CheckInEntity>();
  const events = createStoreRepo<EventEntity>([eventRow()]);
  // otherPlaceId sits in the same 0.01° cell as placeId, so two places can still be one district.
  const places = createStoreRepo<PlaceEntity>([{ id: placeId, latitude: 55.73, longitude: 37.6 } as PlaceEntity, { id: otherPlaceId, latitude: 55.731, longitude: 37.601 } as PlaceEntity]);
  const bookings = createStoreRepo<BookingEntity>(options.bookings ?? []);
  const users = { findByIds: async (ids: string[]) => ids.map((id) => ({ id, firstName: "Анна", lastName: "Иванова" })) } as unknown as UsersService;
  const service = new CheckInsService(checkIns as unknown as Repository<CheckInEntity>, events as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>, bookings as unknown as Repository<BookingEntity>, users);
  return { service, checkIns, places, bookings };
}

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate key"), { code: "23505" }));
}

describe("utcVisitDate", () => {
  it("returns the UTC calendar day", () => {
    expect(utcVisitDate(now)).toBe("2026-09-12");
  });
});

describe("CheckInsService", () => {
  it("creates an event check-in once and counts the event place in stats", async () => {
    const { service } = createService();
    const first = await service.create(userId, { eventId }, now);
    const second = await service.create(userId, { eventId }, now);
    expect(second.id).toBe(first.id);
    const stats = await service.stats(userId, userId);
    expect(stats.eventsCount).toBe(1);
    expect(stats.placesCount).toBe(1);
    expect(stats.byCategory.find((row) => row.category === "volunteering")?.count).toBe(1);
    expect(stats.byCategory.find((row) => row.category === "afisha")?.count).toBe(0);
  });

  it("dedups a place check-in on the same UTC day and allows the next day", async () => {
    const { service } = createService();
    const first = await service.create(userId, { placeId }, now);
    const sameDay = await service.create(userId, { placeId }, new Date("2026-09-12T23:00:00Z"));
    expect(sameDay.id).toBe(first.id);
    const nextDay = await service.create(userId, { placeId }, new Date("2026-09-13T00:00:00Z"));
    expect(nextDay.id).not.toBe(first.id);
    await service.create(userId, { placeId: otherPlaceId }, now);
    const stats = await service.stats(userId, userId);
    expect(stats.placesCount).toBe(2);
    expect(stats.eventsCount).toBe(0);
    // Both places fall into the same neighbourhood cell.
    expect(stats.districtsCount).toBe(1);
  });

  it("counts one district per neighbourhood cell of the visited places", async () => {
    const { service, places } = createService();
    const farPlaceId = "00000000-0000-4000-8000-0000000000p3";
    places.store.push({ id: farPlaceId, latitude: 55.9, longitude: 37.9 } as PlaceEntity);

    await service.create(userId, { placeId }, now);
    expect((await service.stats(userId, userId)).districtsCount).toBe(1);

    await service.create(userId, { placeId: farPlaceId }, now);
    const stats = await service.stats(userId, userId);
    expect(stats.placesCount).toBe(2);
    expect(stats.districtsCount).toBe(2);
  });

  it("returns the concurrent winner when the event check-in insert loses the unique race", async () => {
    const { service, checkIns } = createService();
    const winnerId = "00000000-0000-4000-8000-0000000000d1";
    const originalSave = checkIns.save;
    checkIns.save = async () => {
      checkIns.save = originalSave;
      checkIns.store.push({ id: winnerId, userId, eventId, placeId: null, visitDate: null, checkedInAt: now } as CheckInEntity);
      throw uniqueViolation();
    };
    const created = await service.create(userId, { eventId }, now);
    expect(created.id).toBe(winnerId);
    expect(checkIns.store).toHaveLength(1);
  });

  it("returns the concurrent winner when the place check-in insert loses the unique race", async () => {
    const { service, checkIns } = createService();
    const winnerId = "00000000-0000-4000-8000-0000000000d2";
    const originalSave = checkIns.save;
    checkIns.save = async () => {
      checkIns.save = originalSave;
      checkIns.store.push({ id: winnerId, userId, eventId: null, placeId, visitDate: "2026-09-12", checkedInAt: now } as CheckInEntity);
      throw uniqueViolation();
    };
    const created = await service.create(userId, { placeId }, now);
    expect(created.id).toBe(winnerId);
    expect(checkIns.store).toHaveLength(1);
  });

  it("rethrows a unique violation that leaves no readable row", async () => {
    const { service, checkIns } = createService();
    checkIns.save = async () => {
      throw uniqueViolation();
    };
    await expect(service.create(userId, { eventId }, now)).rejects.toBeInstanceOf(QueryFailedError);
  });

  it("404s unknown targets and forbids reading another user's stats", async () => {
    const { service } = createService();
    await expect(service.create(userId, { eventId: "00000000-0000-4000-8000-0000000000e9" }, now)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create(userId, { placeId: "00000000-0000-4000-8000-0000000000p9" }, now)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.stats(otherUser, userId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lists entry codes of the viewer's active bookings only", async () => {
    const { service } = createService({
      bookings: [
        { id: bookingId, userId, eventId, status: "active", createdAt: now } as BookingEntity,
        { id: "00000000-0000-4000-8000-0000000000b2", userId, eventId, status: "cancelled", createdAt: now } as BookingEntity,
        { id: "00000000-0000-4000-8000-0000000000b3", userId: otherUser, eventId, status: "active", createdAt: now } as BookingEntity,
      ],
    });
    await expect(service.listCodes(userId)).resolves.toEqual([{ bookingId, code: entryCodeFromBookingId(bookingId) }]);
  });

  it("marks a guest by entry code, is idempotent, and 404s an unknown code", async () => {
    const { service } = createService({
      bookings: [{ id: bookingId, userId, eventId, status: "active", createdAt: now } as BookingEntity],
    });
    const first = await service.checkInByCode(orgId, eventId, entryCodeFromBookingId(bookingId).toLowerCase(), now);
    expect(first).toMatchObject({ bookingId, userId, name: "Анна Иванова", guests: 0, checkedInAt: now.toISOString(), bookedAt: now.toISOString() });
    const again = await service.checkInByCode(orgId, eventId, entryCodeFromBookingId(bookingId), now);
    expect(again.checkedInAt).toBe(first.checkedInAt);
    await expect(service.checkInByCode(orgId, eventId, "ZZZZZZ", now)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.checkInByCode(otherUser, eventId, entryCodeFromBookingId(bookingId), now)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.checkInByCode(orgId, eventId, "   ", now)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses to check in when two active bookings share a code suffix", async () => {
    const twinId = "ffffffff-ffff-4fff-8fff-0000000000b1";
    const { service } = createService({
      bookings: [
        { id: bookingId, userId, eventId, status: "active", createdAt: now } as BookingEntity,
        { id: twinId, userId: otherUser, eventId, status: "active", createdAt: now } as BookingEntity,
      ],
    });
    expect(entryCodeFromBookingId(bookingId)).toBe(entryCodeFromBookingId(twinId));
    await expect(service.checkInByCode(orgId, eventId, entryCodeFromBookingId(bookingId), now)).rejects.toBeInstanceOf(ConflictException);
  });
});
