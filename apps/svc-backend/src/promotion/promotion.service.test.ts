import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { PromotionCampaignEntity } from "./promotion-campaign.entity";
import { PromotionService } from "./promotion.service";

const organizer = "00000000-0000-4000-8000-00000000000a";
const other = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const now = new Date("2026-09-12T10:00:00Z");

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
      if (bound instanceof Date && cell instanceof Date) {
        const op = (value as { _type?: string })._type;
        if (op === "moreThan") return cell.getTime() > bound.getTime();
        return cell.getTime() <= bound.getTime();
      }
      return true;
    }
    return cell === value;
  });
}

function seedEvent(overrides: Partial<EventEntity> = {}): EventEntity {
  return {
    id: eventId,
    title: "Джаз в парке",
    organizerUserId: organizer,
    published: true,
    category: "afisha",
    city: "Москва",
    placeId: null,
    startsAt: new Date("2026-09-20T16:00:00Z"),
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: null,
    bookedCount: 0,
    bookingOpensAt: null,
    chatLink: null,
    chatSyncPending: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as EventEntity;
}

function createService(event: EventEntity = seedEvent(), extras: { places?: PlaceEntity[]; checkIns?: CheckInEntity[]; extraEvents?: EventEntity[] } = {}) {
  const events = [event, ...(extras.extraEvents ?? [])];
  const campaigns: PromotionCampaignEntity[] = [];
  const places = extras.places ?? [];
  const checkIns = extras.checkIns ?? [];
  let seq = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const campaignsRepo = {
    create: (fields: Partial<PromotionCampaignEntity>) => ({ ...fields }) as PromotionCampaignEntity,
    save: async (entity: PromotionCampaignEntity) => {
      if (!campaigns.includes(entity)) {
        entity.id ??= nextId();
        entity.createdAt ??= now;
        campaigns.push(entity);
      }
      return entity;
    },
    find: async (opts: { where?: Record<string, unknown> } = {}) => campaigns.filter((row) => matchesWhere(row, opts.where ?? {})),
    findOneBy: async (where: Record<string, unknown>) => campaigns.find((row) => matchesWhere(row, where)) ?? null,
  };
  const eventsRepo = {
    findOneBy: async (where: { id: string }) => events.find((row) => row.id === where.id) ?? null,
    find: async (opts: { where?: Record<string, unknown> } = {}) => events.filter((row) => matchesWhere(row, opts.where ?? {})),
  };
  const placesRepo = {
    find: async (opts: { where?: Record<string, unknown> } = {}) => places.filter((row) => matchesWhere(row, opts.where ?? {})),
  };
  const checkInsRepo = {
    find: async (opts: { where?: Record<string, unknown> } = {}) => checkIns.filter((row) => matchesWhere(row, opts.where ?? {})),
  };
  const service = new PromotionService(
    campaignsRepo as unknown as Repository<PromotionCampaignEntity>,
    eventsRepo as unknown as Repository<EventEntity>,
    placesRepo as unknown as Repository<PlaceEntity>,
    checkInsRepo as unknown as Repository<CheckInEntity>,
  );
  return { service, campaigns, events };
}

const week = {
  type: "boost" as const,
  startsAt: "2026-09-12T00:00:00.000Z",
  endsAt: "2026-09-19T00:00:00.000Z",
  tariffCode: "boost_week",
  priceRub: 4900,
};

describe("PromotionService", () => {
  it("creates campaigns of all four types with period, status and billing fields", async () => {
    const { service } = createService();
    const boost = await service.create(organizer, eventId, week, now);
    expect(boost.type).toBe("boost");
    expect(boost.status).toBe("active");
    expect(boost.tariffCode).toBe("boost_week");
    expect(boost.priceRub).toBe(4900);
    expect(boost.paidAt).toBeNull();
    const banner = await service.create(organizer, eventId, { ...week, type: "banner", tariffCode: "banner_week", priceRub: 1500 }, now);
    const pin = await service.create(organizer, eventId, { ...week, type: "pin", tariffCode: "pin_week", priceRub: 900 }, now);
    const targeted = await service.create(
      organizer,
      eventId,
      { ...week, type: "target_collection", tariffCode: "target_week", priceRub: 7900, audience: { minVisits: 3, windowDays: 180, category: "afisha" } },
      now,
    );
    expect([banner.type, pin.type, targeted.type]).toEqual(["banner", "pin", "target_collection"]);
    expect(targeted.audience).toEqual({ minVisits: 3, windowDays: 180, category: "afisha" });
    const listed = await service.list(organizer, eventId, now);
    expect(listed).toHaveLength(4);
    expect(listed.every((row) => row.status === "active")).toBe(true);
  });

  it("rejects a reversed period and a non-owner", async () => {
    const { service } = createService();
    await expect(service.create(organizer, eventId, { ...week, startsAt: week.endsAt, endsAt: week.startsAt }, now)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(other, eventId, week, now)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list(organizer, "00000000-0000-4000-8000-000000000099", now)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("marks a campaign completed when its window is already over and expires it on list", async () => {
    const { service, campaigns } = createService();
    const past = await service.create(organizer, eventId, { ...week, startsAt: "2026-08-01T00:00:00.000Z", endsAt: "2026-08-08T00:00:00.000Z" }, now);
    expect(past.status).toBe("completed");
    const live = await service.create(organizer, eventId, week, now);
    campaigns.find((row) => row.id === live.id)!.endsAt = new Date("2026-09-12T09:00:00Z");
    const listed = await service.list(organizer, eventId, now);
    expect(listed.find((row) => row.id === live.id)?.status).toBe("completed");
  });

  it("records a manual payment stamp without computing a fee", async () => {
    const { service } = createService();
    const created = await service.create(organizer, eventId, week, now);
    const paid = await service.recordPayment(organizer, eventId, created.id, { paidAt: "2026-09-12T12:00:00.000Z" }, now);
    expect(paid.paidAt).toBe("2026-09-12T12:00:00.000Z");
    expect(paid.priceRub).toBe(4900);
    await expect(service.recordPayment(organizer, eventId, "00000000-0000-4000-8000-000000000099", {}, now)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lists in-window active campaigns by type", async () => {
    const { service } = createService();
    const boost = await service.create(organizer, eventId, week, now);
    const banner = await service.create(organizer, eventId, { ...week, type: "banner", tariffCode: "banner_week", priceRub: 1500 }, now);
    await service.create(organizer, eventId, { ...week, startsAt: "2026-09-20T00:00:00.000Z", endsAt: "2026-09-27T00:00:00.000Z", tariffCode: "boost_later" }, now);
    expect(await service.listActive(now)).toEqual([]);
    await service.recordPayment(organizer, eventId, boost.id, { paidAt: now.toISOString() }, now);
    await service.recordPayment(organizer, eventId, banner.id, { paidAt: now.toISOString() }, now);
    const active = await service.listActive(now);
    expect(active.map((row) => row.tariffCode).sort()).toEqual(["banner_week", "boost_week"]);
    const banners = await service.listActive(now, "banner");
    expect(banners.map((row) => row.type)).toEqual(["banner"]);
  });

  it("expires overdue campaigns on listActive and recordPayment", async () => {
    const { service, campaigns } = createService();
    const live = await service.create(organizer, eventId, week, now);
    await service.recordPayment(organizer, eventId, live.id, { paidAt: now.toISOString() }, now);
    campaigns.find((row) => row.id === live.id)!.endsAt = new Date("2026-09-12T09:00:00Z");
    expect(await service.listActive(now)).toEqual([]);
    expect(campaigns.find((row) => row.id === live.id)?.status).toBe("completed");
    const other = await service.create(organizer, eventId, { ...week, tariffCode: "boost_2" }, now);
    campaigns.find((row) => row.id === other.id)!.endsAt = new Date("2026-09-12T09:00:00Z");
    const paid = await service.recordPayment(organizer, eventId, other.id, {}, now);
    expect(paid.status).toBe("completed");
  });

  it("rejects a target collection without audience", async () => {
    const { service } = createService();
    await expect(service.create(organizer, eventId, { ...week, type: "target_collection", tariffCode: "target_week", priceRub: 7900 }, now)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("builds banner and pin placements and a visit-history target collection", async () => {
    const placeId = "00000000-0000-4000-8000-0000000000p1";
    const visitedA = "00000000-0000-4000-8000-0000000000e2";
    const visitedB = "00000000-0000-4000-8000-0000000000e3";
    const visitedC = "00000000-0000-4000-8000-0000000000e4";
    const event = seedEvent({ placeId, category: "afisha" });
    const venue = { id: placeId, title: "Парк", address: "x", city: "Москва", category: "park", latitude: 55.75, longitude: 37.62, published: true, createdAt: now, updatedAt: now } as PlaceEntity;
    const extraEvents = [seedEvent({ id: visitedA, category: "afisha" }), seedEvent({ id: visitedB, category: "afisha" }), seedEvent({ id: visitedC, category: "afisha" })];
    const checkIns = [
      { id: "c1", userId: other, eventId: visitedA, placeId: null, checkedInAt: new Date("2026-04-01T10:00:00Z") } as CheckInEntity,
      { id: "c2", userId: other, eventId: visitedB, placeId: null, checkedInAt: new Date("2026-05-01T10:00:00Z") } as CheckInEntity,
      { id: "c3", userId: other, eventId: visitedC, placeId: null, checkedInAt: new Date("2026-06-01T10:00:00Z") } as CheckInEntity,
    ];
    const { service } = createService(event, { places: [venue], checkIns, extraEvents });
    const banner = await service.create(organizer, eventId, { ...week, type: "banner", tariffCode: "banner_week", priceRub: 1500 }, now);
    const pin = await service.create(organizer, eventId, { ...week, type: "pin", tariffCode: "pin_week", priceRub: 900 }, now);
    const boost = await service.create(organizer, eventId, week, now);
    const target = await service.create(organizer, eventId, { ...week, type: "target_collection", tariffCode: "target_week", priceRub: 7900, audience: { minVisits: 3, windowDays: 180, category: "afisha" } }, now);
    for (const row of [banner, pin, boost, target]) await service.recordPayment(organizer, eventId, row.id, { paidAt: now.toISOString() }, now);
    const placements = await service.placements(now);
    expect(placements.banners.map((row) => row.id)).toEqual([eventId]);
    expect(placements.pins).toHaveLength(1);
    expect(placements.boostedEventIds).toEqual([eventId]);
    const mine = await service.targetedFor(other, now);
    expect(mine.collections).toHaveLength(1);
    expect(mine.collections[0]?.campaign).not.toHaveProperty("tariffCode");
    expect(mine.collections[0]?.explanation).toContain("афиша");
  });

  it("does not apply unpublished events, place-only visits, or too few concerts", async () => {
    const draft = seedEvent({ published: false });
    const { service: unpublished } = createService(draft);
    const boost = await unpublished.create(organizer, eventId, week, now);
    await unpublished.recordPayment(organizer, eventId, boost.id, { paidAt: now.toISOString() }, now);
    expect(await unpublished.listActive(now)).toEqual([]);

    const placeId = "00000000-0000-4000-8000-0000000000p1";
    const sportId = "00000000-0000-4000-8000-0000000000e2";
    const live = seedEvent({ category: "afisha" });
    const { service } = createService(live, {
      extraEvents: [seedEvent({ id: sportId, category: "sport" })],
      checkIns: [
        { id: "c1", userId: other, eventId: null, placeId, checkedInAt: new Date("2026-04-01T10:00:00Z") } as CheckInEntity,
        { id: "c2", userId: other, eventId: null, placeId, checkedInAt: new Date("2026-05-01T10:00:00Z") } as CheckInEntity,
        { id: "c3", userId: other, eventId: sportId, placeId: null, checkedInAt: new Date("2026-06-01T10:00:00Z") } as CheckInEntity,
      ],
    });
    const target = await service.create(organizer, eventId, { ...week, type: "target_collection", tariffCode: "target_week", priceRub: 7900, audience: { minVisits: 3, windowDays: 180, category: "afisha" } }, now);
    await service.recordPayment(organizer, eventId, target.id, { paidAt: now.toISOString() }, now);
    expect((await service.targetedFor(other, now)).collections).toEqual([]);
  });

  it("completes an ended boost even when only pin campaigns are queried", async () => {
    const { service, campaigns } = createService();
    const boost = await service.create(organizer, eventId, week, now);
    await service.recordPayment(organizer, eventId, boost.id, { paidAt: now.toISOString() }, now);
    campaigns.find((row) => row.id === boost.id)!.endsAt = new Date("2026-09-12T09:00:00Z");
    expect(await service.listActive(now, "pin")).toEqual([]);
    expect(campaigns.find((row) => row.id === boost.id)?.status).toBe("completed");
  });
});
