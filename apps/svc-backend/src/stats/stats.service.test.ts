import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { PageViewEntity } from "./page-view.entity";
import { parseStatsPeriod } from "./stats.controller";
import { inPeriod, StatsService } from "./stats.service";

const now = new Date("2026-09-12T10:00:00Z");
const owner = "00000000-0000-4000-8000-00000000000a";
const other = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const august = new Date("2026-08-10T10:00:00Z");
const september = new Date("2026-09-10T10:00:00Z");
const allTime = { from: null, to: null };

function createStoreRepo<T extends object>(initial: T[] = []) {
  const store = [...initial];
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
    },
    findOneBy: async (where: Record<string, unknown>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
    save: async (entity: T) => {
      const row = entity as PageViewEntity;
      if ("userId" in (entity as object) && store.some((item) => (item as PageViewEntity).userId === row.userId && (item as PageViewEntity).targetId === row.targetId && (item as PageViewEntity).viewedOn === row.viewedOn)) {
        throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate"), { code: "23505" }));
      }
      store.push(entity);
      return entity;
    },
  };
}

describe("StatsService", () => {
  it("records a view once per user per Moscow day and aggregates organizer stats", async () => {
    const views = createStoreRepo<PageViewEntity>();
    const events = createStoreRepo<EventEntity>([{ id: eventId, organizerUserId: owner, isPaid: true } as EventEntity]);
    const bookings = createStoreRepo<BookingEntity>([{ id: "b1", eventId, status: "active" } as BookingEntity, { id: "b2", eventId, status: "cancelled" } as BookingEntity]);
    const service = new StatsService(views as unknown as Repository<PageViewEntity>, events as unknown as Repository<EventEntity>, bookings as unknown as Repository<BookingEntity>, createStoreRepo<CheckInEntity>() as unknown as Repository<CheckInEntity>);
    expect(await service.recordView(owner, "event", eventId, now)).toEqual({ recorded: true });
    expect(await service.recordView(owner, "event", eventId, now)).toEqual({ recorded: false });
    const stats = await service.eventStats(owner, eventId);
    expect(stats).toEqual({ eventId, period: allTime, views: 1, bookings: 2, cancellations: 1, paidBookings: 1 });
    await expect(service.eventStats(other, eventId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("counts only what happened inside the requested period", async () => {
    const views = createStoreRepo<PageViewEntity>([{ userId: owner, targetType: "event", targetId: eventId, createdAt: august } as PageViewEntity, { userId: other, targetType: "event", targetId: eventId, createdAt: september } as PageViewEntity]);
    const events = createStoreRepo<EventEntity>([{ id: eventId, organizerUserId: owner, isPaid: true } as EventEntity]);
    const bookings = createStoreRepo<BookingEntity>([{ id: "b1", eventId, status: "active", createdAt: august } as BookingEntity, { id: "b2", eventId, status: "cancelled", createdAt: september } as BookingEntity, { id: "b3", eventId, status: "active", createdAt: september } as BookingEntity]);
    const service = new StatsService(views as unknown as Repository<PageViewEntity>, events as unknown as Repository<EventEntity>, bookings as unknown as Repository<BookingEntity>, createStoreRepo<CheckInEntity>() as unknown as Repository<CheckInEntity>);

    const wholeTime = await service.eventStats(owner, eventId);
    expect(wholeTime).toMatchObject({ views: 2, bookings: 3, cancellations: 1, paidBookings: 2 });

    const period = { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T23:59:59.000Z" };
    const inSeptember = await service.eventStats(owner, eventId, period);
    expect(inSeptember).toEqual({ eventId, period, views: 1, bookings: 2, cancellations: 1, paidBookings: 1 });

    // An open-ended window still narrows the side it names.
    const sinceSeptember = await service.eventStats(owner, eventId, { from: period.from, to: null });
    expect(sinceSeptember).toMatchObject({ views: 1, bookings: 2 });
  });
});

describe("organizationSummary", () => {
  it("splits traffic sources, weekdays and the previous window", async () => {
    const events = createStoreRepo<EventEntity>([{ id: eventId, organizerOrganizationId: owner, organizerUserId: owner } as EventEntity]);
    const bookings = createStoreRepo<BookingEntity>([{ id: "b1", eventId, status: "active", source: "chats", createdAt: september } as BookingEntity, { id: "b2", eventId, status: "cancelled", source: "feed", createdAt: september } as BookingEntity, { id: "b3", eventId, status: "active", source: "chats", createdAt: august } as BookingEntity]);
    const checkIns = createStoreRepo<CheckInEntity>([{ userId: other, eventId } as CheckInEntity]);
    const service = new StatsService(createStoreRepo<PageViewEntity>() as unknown as Repository<PageViewEntity>, events as unknown as Repository<EventEntity>, bookings as unknown as Repository<BookingEntity>, checkIns as unknown as Repository<CheckInEntity>);
    const period = { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T23:59:59.000Z" };
    const summary = await service.organizationSummary(owner, period);
    expect(summary.bookings).toBe(2);
    expect(summary.cancelledPercent).toBe(50);
    expect(summary.sources.find((row) => row.source === "chats")?.percent).toBe(50);
    expect(summary.byWeekday.reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(service.exportCsv(summary)).toContain("bookings,2");
  });
});

describe("inPeriod", () => {
  it("includes both bounds and rejects the outside", () => {
    const at = new Date("2026-09-10T10:00:00Z");
    expect(inPeriod(at, allTime)).toBe(true);
    expect(inPeriod(at, { from: at.toISOString(), to: at.toISOString() })).toBe(true);
    expect(inPeriod(at, { from: "2026-09-11T00:00:00.000Z", to: null })).toBe(false);
    expect(inPeriod(at, { from: null, to: "2026-09-09T00:00:00.000Z" })).toBe(false);
  });
});

describe("parseStatsPeriod", () => {
  it("reads an empty query as all time and keeps a valid window", () => {
    expect(parseStatsPeriod(undefined, undefined)).toEqual(allTime);
    expect(parseStatsPeriod("", "")).toEqual(allTime);
    expect(parseStatsPeriod("2026-09-01T00:00:00.000Z", "2026-09-30T00:00:00.000Z")).toEqual({ from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" });
  });

  it("rejects a malformed timestamp and an inverted window", () => {
    expect(() => parseStatsPeriod("yesterday", undefined)).toThrow(BadRequestException);
    expect(() => parseStatsPeriod("2026-09-30T00:00:00.000Z", "2026-09-01T00:00:00.000Z")).toThrow(BadRequestException);
  });
});
