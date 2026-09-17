import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { PageViewEntity } from "./page-view.entity";
import { StatsService } from "./stats.service";

const now = new Date("2026-09-12T10:00:00Z");
const owner = "00000000-0000-4000-8000-00000000000a";
const other = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";

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
    const bookings = createStoreRepo<BookingEntity>([
      { id: "b1", eventId, status: "active" } as BookingEntity,
      { id: "b2", eventId, status: "cancelled" } as BookingEntity,
    ]);
    const service = new StatsService(views as unknown as Repository<PageViewEntity>, events as unknown as Repository<EventEntity>, bookings as unknown as Repository<BookingEntity>);
    expect(await service.recordView(owner, "event", eventId, now)).toEqual({ recorded: true });
    expect(await service.recordView(owner, "event", eventId, now)).toEqual({ recorded: false });
    const stats = await service.eventStats(owner, eventId);
    expect(stats).toEqual({ eventId, views: 1, bookings: 2, cancellations: 1, paidBookings: 1 });
    await expect(service.eventStats(other, eventId)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
