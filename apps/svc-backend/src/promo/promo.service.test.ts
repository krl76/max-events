import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type EntityManager, type EntityTarget, type ObjectLiteral, type Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { UserEntity } from "../users/user.entity";
import { PromoCampaignEntity } from "./promo-campaign.entity";
import { PromoCodeEntity } from "./promo-code.entity";
import { PromoFulfillmentEntity } from "./promo-fulfillment.entity";
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

function createService(event: EventEntity = seedEvent(), users: UserEntity[] = []) {
  const events = [event];
  const codes: PromoCodeEntity[] = [];
  const campaigns: PromoCampaignEntity[] = [];
  const fulfillments: PromoFulfillmentEntity[] = [];
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
  const campaignsRepo = {
    create: (fields: Partial<PromoCampaignEntity>) => ({ ...fields }) as PromoCampaignEntity,
    save: async (entity: PromoCampaignEntity) => {
      const duplicate = campaigns.some((row) => row !== entity && row.eventId === entity.eventId && row.code === entity.code);
      if (duplicate) throw uniqueViolation();
      if (!campaigns.includes(entity)) {
        entity.id ??= nextId();
        entity.createdAt ??= now;
        entity.fulfillmentCount ??= 0;
        entity.status ??= "active";
        campaigns.push(entity);
      }
      return entity;
    },
    find: async (opts: { where: { eventId: string } }) => campaigns.filter((row) => row.eventId === opts.where.eventId),
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
      if (entity === PromoCodeEntity) return codes.find((row) => row.eventId === where.eventId && row.code === where.code) ?? null;
      if (entity === PromoCampaignEntity) return campaigns.find((row) => row.eventId === where.eventId && row.code === where.code) ?? null;
      if (entity === UserEntity) return users.find((row) => row.id === where.id) ?? null;
      return null;
    },
    count: async (entity: EntityTarget<ObjectLiteral>, options: { where: Record<string, unknown> }) => {
      if (entity !== BookingEntity) return 0;
      return bookings.filter((row) => row.userId === options.where.userId).length;
    },
    create: (_entity: EntityTarget<ObjectLiteral>, fields: Partial<PromoFulfillmentEntity>) => ({ ...fields }) as PromoFulfillmentEntity,
    save: async (entity: EntityTarget<ObjectLiteral>, row: PromoCodeEntity | PromoCampaignEntity | PromoFulfillmentEntity) => {
      if (entity === PromoFulfillmentEntity) {
        const item = row as PromoFulfillmentEntity;
        const duplicate = fulfillments.some((existing) => existing.campaignId === item.campaignId && existing.referredUserId === item.referredUserId);
        if (duplicate) throw uniqueViolation();
        item.id ??= nextId();
        item.createdAt ??= now;
        fulfillments.push(item);
        return item;
      }
      return row;
    },
  } as unknown as EntityManager;
  const service = new PromoService(
    codesRepo as unknown as Repository<PromoCodeEntity>,
    eventsRepo as unknown as Repository<EventEntity>,
    bookingsRepo as unknown as Repository<BookingEntity>,
    campaignsRepo as unknown as Repository<PromoCampaignEntity>,
  );
  return { service, codes, campaigns, fulfillments, events, bookings, manager };
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

  it("records a refer-a-friend fulfillment for a new user's first booking and completes at the cap", async () => {
    const referred = { id: other, createdAt: now } as UserEntity;
    const { service, manager, campaigns, fulfillments, bookings } = createService(seedEvent(), [referred]);
    const campaign = await service.createCampaign(organizer, eventId, { type: "refer_a_friend", code: "friend", title: "Приведи друга", maxFulfillments: 1 });
    expect(campaign.status).toBe("active");
    bookings.push({ id: "00000000-0000-4000-8000-0000000000b1", userId: other, eventId, status: "active", promoCode: null, createdAt: now, updatedAt: now, reminderSentAt: null });
    await service.recordFulfillmentInTransaction(manager, seedEvent(), other, bookings[0]!.id, "friend", now);
    expect(fulfillments).toHaveLength(1);
    expect(campaigns[0]?.fulfillmentCount).toBe(1);
    expect(campaigns[0]?.status).toBe("completed");
    const listed = await service.listCampaigns(organizer, eventId);
    expect(listed[0]).toMatchObject({ code: "FRIEND", fulfillmentCount: 1, status: "completed" });
  });

  it("does not count an existing booker as a refer-a-friend fulfillment", async () => {
    const referred = { id: other, createdAt: now } as UserEntity;
    const { service, manager, fulfillments, bookings } = createService(seedEvent(), [referred]);
    await service.createCampaign(organizer, eventId, { type: "refer_a_friend", code: "FRIEND", title: "Приведи друга" });
    bookings.push(
      { id: "00000000-0000-4000-8000-0000000000b1", userId: other, eventId, status: "cancelled", promoCode: null, createdAt: now, updatedAt: now, reminderSentAt: null },
      { id: "00000000-0000-4000-8000-0000000000b2", userId: other, eventId, status: "active", promoCode: null, createdAt: now, updatedAt: now, reminderSentAt: null },
    );
    await service.recordFulfillmentInTransaction(manager, seedEvent(), other, "00000000-0000-4000-8000-0000000000b2", "FRIEND", now);
    expect(fulfillments).toHaveLength(0);
  });

  it("counts any booking toward a special offer", async () => {
    const { service, manager, campaigns, bookings } = createService();
    await service.createCampaign(organizer, eventId, { type: "special_offer", code: "SALE", title: "Спецпредложение" });
    bookings.push({ id: "00000000-0000-4000-8000-0000000000b1", userId: other, eventId, status: "active", promoCode: null, createdAt: now, updatedAt: now, reminderSentAt: null });
    await service.recordFulfillmentInTransaction(manager, seedEvent(), other, bookings[0]!.id, "sale", now);
    expect(campaigns[0]?.fulfillmentCount).toBe(1);
    expect(campaigns[0]?.status).toBe("active");
    await expect(service.recordFulfillmentInTransaction(manager, seedEvent(), other, bookings[0]!.id, "NOPE", now)).rejects.toMatchObject({ message: "Invalid referral code" });
  });
});
