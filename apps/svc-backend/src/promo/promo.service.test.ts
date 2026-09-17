import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type EntityManager, type EntityTarget, type ObjectLiteral, type Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { PromoCodeEntity } from "./promo-code.entity";
import { PromoService } from "./promo.service";

const organizer = "00000000-0000-4000-8000-00000000000a";
const other = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const now = new Date("2026-09-12T10:00:00Z");

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate key value"), { code: "23505" }));
}

function seedEvent(overrides: Partial<EventEntity> = {}): EventEntity {
  return {
    id: eventId,
    title: "Джаз в парке",
    description: "",
    category: "afisha",
    city: "Москва",
    placeId: null,
    organizerUserId: organizer,
    startsAt: new Date("2026-09-20T16:00:00Z"),
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: 10,
    bookedCount: 0,
    published: true,
    bookingOpensAt: null,
    chatLink: null,
    chatSyncPending: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createService(event: EventEntity = seedEvent()) {
  const events = [event];
  const codes: PromoCodeEntity[] = [];
  const bookings: BookingEntity[] = [];
  let seq = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const codesRepo = {
    create: (fields: Partial<PromoCodeEntity>) => ({ ...fields }) as PromoCodeEntity,
    save: async (entity: PromoCodeEntity) => {
      const duplicate = codes.some((row) => row !== entity && row.eventId === entity.eventId && row.code === entity.code);
      if (duplicate) throw uniqueViolation();
      if (!codes.includes(entity)) {
        entity.id ??= nextId();
        entity.createdAt ??= now;
        entity.redeemedCount ??= 0;
        codes.push(entity);
      }
      return entity;
    },
    find: async (opts: { where: { eventId: string } }) => codes.filter((row) => row.eventId === opts.where.eventId),
  };
  const eventsRepo = {
    findOneBy: async (where: { id: string }) => events.find((row) => row.id === where.id) ?? null,
    save: async (entity: EventEntity) => entity,
  };
  const bookingsRepo = {
    find: async (opts: { where: { eventId: string } }) => bookings.filter((row) => row.eventId === opts.where.eventId),
  };
  const manager = {
    findOne: async (entity: EntityTarget<ObjectLiteral>, options: { where: Record<string, unknown> }) => {
      const where = options.where;
      if (entity === PromoCodeEntity) {
        return codes.find((row) => row.eventId === where.eventId && row.code === where.code) ?? null;
      }
      return null;
    },
    save: async (_entity: EntityTarget<ObjectLiteral>, row: PromoCodeEntity) => row,
  } as unknown as EntityManager;
  const service = new PromoService(codesRepo as unknown as Repository<PromoCodeEntity>, eventsRepo as unknown as Repository<EventEntity>, bookingsRepo as unknown as Repository<BookingEntity>);
  return { service, codes, events, bookings, manager };
}

describe("PromoService", () => {
  it("creates an uppercased code for the organizer and lists it", async () => {
    const { service } = createService();
    const created = await service.create(organizer, eventId, { code: "early" });
    expect(created.code).toBe("EARLY");
    expect(created.redeemedCount).toBe(0);
    const listed = await service.list(organizer, eventId);
    expect(listed.map((row) => row.code)).toEqual(["EARLY"]);
  });

  it("rejects a blank code and a non-owner", async () => {
    const { service } = createService();
    await expect(service.create(organizer, eventId, { code: "   " })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(other, eventId, { code: "VIP" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list(organizer, "00000000-0000-4000-8000-000000000099")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("sets early access on an owned event", async () => {
    const { service, events } = createService();
    const opens = new Date("2026-09-20T00:00:00Z");
    const result = await service.setEarlyAccess(organizer, eventId, opens);
    expect(result.bookingOpensAt).toBe(opens.toISOString());
    expect(events[0]?.bookingOpensAt).toEqual(opens);
  });

  it("redeems a valid code and rejects expired or exhausted ones", async () => {
    const { service, manager, codes } = createService();
    await service.create(organizer, eventId, { code: "VIP", maxRedemptions: 1 });
    const event = seedEvent();
    const applied = await service.redeemInTransaction(manager, event, "vip", now);
    expect(applied).toBe("VIP");
    expect(codes[0]?.redeemedCount).toBe(1);
    await expect(service.redeemInTransaction(manager, event, "VIP", now)).rejects.toMatchObject({ message: "Promo code exhausted" });
    codes[0]!.maxRedemptions = 5;
    codes[0]!.expiresAt = new Date("2026-09-01T00:00:00Z");
    await expect(service.redeemInTransaction(manager, event, "VIP", now)).rejects.toMatchObject({ message: "Promo code expired" });
  });

  it("requires a promo code before bookingOpensAt and skips redeem after the window without a code", async () => {
    const { service, manager } = createService();
    const event = seedEvent({ bookingOpensAt: new Date("2026-09-20T00:00:00Z") });
    await expect(service.redeemInTransaction(manager, event, undefined, now)).rejects.toMatchObject({ message: "Early access requires a promo code" });
    await service.create(organizer, eventId, { code: "EARLY" });
    expect(await service.redeemInTransaction(manager, event, "early", now)).toBe("EARLY");
    const open = seedEvent({ bookingOpensAt: new Date("2026-09-01T00:00:00Z") });
    expect(await service.redeemInTransaction(manager, open, undefined, now)).toBeNull();
  });

  it("lists bookings with the applied promo code", async () => {
    const { service, bookings } = createService();
    bookings.push({
      id: "00000000-0000-4000-8000-0000000000b1",
      userId: other,
      eventId,
      status: "active",
      promoCode: "EARLY",
      createdAt: now,
      updatedAt: now,
      reminderSentAt: null,
    });
    const rows = await service.listBookings(organizer, eventId);
    expect(rows).toEqual([{ id: bookings[0]!.id, userId: other, eventId, status: "active", promoCode: "EARLY", createdAt: now.toISOString() }]);
  });
});
