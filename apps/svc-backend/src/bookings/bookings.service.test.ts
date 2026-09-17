import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type DataSource, type EntityManager, type EntityTarget, type FindOneOptions, type ObjectLiteral } from "typeorm";
import type { BookingStatus } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import type { WaitlistService } from "../waitlist/waitlist.service";
import { BookingEntity } from "./booking.entity";
import { BookingsService } from "./bookings.service";

const userA = "00000000-0000-4000-8000-00000000000a";
const userB = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";

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
    organizerUserId: null,
    startsAt: new Date("2026-09-12T16:00:00Z"),
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: 1,
    bookedCount: 0,
    published: true,
    chatLink: null,
    chatSyncPending: true,
    createdAt: new Date("2026-09-01T07:00:00Z"),
    updatedAt: new Date("2026-09-01T07:00:00Z"),
    ...overrides,
  };
}

function createDataSource(event: EventEntity) {
  const events = [event];
  const bookings: BookingEntity[] = [];
  const tails = new Map<string, Promise<void>>();
  let seq = 0;
  const nextId = () => {
    seq += 1;
    return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  };
  const now = () => new Date("2026-09-01T07:00:00Z");

  const dataSource = {
    transaction: async <T>(run: (manager: EntityManager) => Promise<T>): Promise<T> => {
      const releases: Array<() => void> = [];
      const manager = {
        findOne: async <Entity extends ObjectLiteral>(entity: EntityTarget<Entity>, options: FindOneOptions<Entity>) => {
          const where = (options.where ?? {}) as Record<string, unknown>;
          if (options.lock?.mode === "pessimistic_write" && typeof where.id === "string") {
            const id = where.id;
            const prev = tails.get(id) ?? Promise.resolve();
            let release!: () => void;
            const held = new Promise<void>((resolve) => {
              release = resolve;
            });
            tails.set(
              id,
              prev.then(() => held),
            );
            await prev;
            releases.push(release);
          }
          if (entity === EventEntity) {
            return (events.find((row) => row.id === where.id) ?? null) as Entity | null;
          }
          return (bookings.find((row) => Object.entries(where).every(([key, value]) => (row as unknown as Record<string, unknown>)[key] === value)) as Entity | undefined) ?? null;
        },
        create: <Entity>(_entity: EntityTarget<Entity>, fields: Partial<Entity>) => ({ ...fields }) as Entity,
        save: async <Entity>(entity: EntityTarget<Entity> | ObjectLiteral, maybeRecord?: ObjectLiteral) => {
          const record = (maybeRecord ?? entity) as BookingEntity | EventEntity;
          if (maybeRecord !== undefined && entity === EventEntity) {
            const row = record as EventEntity;
            const index = events.findIndex((item) => item.id === row.id);
            if (index >= 0) events[index] = row;
            return row as Entity;
          }
          const booking = record as BookingEntity;
          if (booking.status === "active") {
            const duplicate = bookings.some((row) => row !== booking && row.status === "active" && row.userId === booking.userId && row.eventId === booking.eventId);
            if (duplicate) throw uniqueViolation();
          }
          if (!bookings.includes(booking)) {
            booking.id ??= nextId();
            booking.createdAt ??= now();
            booking.updatedAt ??= now();
            booking.status = (booking.status ?? "active") as BookingStatus;
            booking.reminderSentAt ??= null;
            bookings.push(booking);
          } else {
            booking.updatedAt = now();
          }
          return booking as Entity;
        },
      };
      try {
        return await run(manager as unknown as EntityManager);
      } finally {
        for (const release of releases) release();
      }
    },
  };

  return { bookings, dataSource: dataSource as unknown as DataSource, events };
}

function createService(event: EventEntity = seedEvent()) {
  const fake = createDataSource(event);
  const waitlist = { onSeatFreed: async () => null } as unknown as WaitlistService;
  const service = new BookingsService(fake.dataSource, waitlist);
  return { ...fake, service, waitlist };
}

describe("BookingsService", () => {
  it("creates a booking, increments bookedCount, and reports remaining seats", async () => {
    const { events, service } = createService(seedEvent({ capacity: 2 }));
    const booking = await service.create(userA, eventId);
    expect(booking.status).toBe("active");
    expect(booking.userId).toBe(userA);
    expect(booking.freeSeats).toBe(1);
    expect(events[0]?.bookedCount).toBe(1);
  });

  it("rejects a second active booking by the same user", async () => {
    const { service } = createService();
    await service.create(userA, eventId);
    await expect(service.create(userA, eventId)).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a booking when no seats remain", async () => {
    const { service } = createService(seedEvent({ capacity: 1 }));
    await service.create(userA, eventId);
    await expect(service.create(userB, eventId)).rejects.toMatchObject({ message: "No seats left" });
  });

  it("cancels a booking, restores the seat, and allows another user to book the last seat", async () => {
    const { service } = createService(seedEvent({ capacity: 1 }));
    const created = await service.create(userA, eventId);
    const cancelled = await service.cancel(userA, created.id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.freeSeats).toBe(1);
    const again = await service.create(userB, eventId);
    expect(again.status).toBe("active");
    expect(again.freeSeats).toBe(0);
  });

  it("forbids cancelling another user's booking and 404s unknown ids", async () => {
    const { service } = createService();
    const created = await service.create(userA, eventId);
    await expect(service.cancel(userB, created.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.cancel(userA, "00000000-0000-4000-8000-000000000099")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create(userA, "00000000-0000-4000-8000-000000000099")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lets N parallel requests for one remaining seat succeed exactly once", async () => {
    const { events, service } = createService(seedEvent({ capacity: 1 }));
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => service.create(`00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, eventId)));
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(7);
    expect(events[0]?.bookedCount).toBe(1);
    expect((fulfilled[0] as PromiseFulfilledResult<{ freeSeats: number | null }>).value.freeSeats).toBe(0);
  });

  it("returns the event chat link on booking and again after cancel plus re-book", async () => {
    const { service } = createService(seedEvent({ capacity: 1, chatLink: "https://max.ru/join/abc", chatSyncPending: false }));
    const first = await service.create(userA, eventId);
    expect(first.chatLink).toBe("https://max.ru/join/abc");
    await service.cancel(userA, first.id);
    const again = await service.create(userA, eventId);
    expect(again.chatLink).toBe("https://max.ru/join/abc");
  });

  it("rejects booking an unpublished event", async () => {
    const { service } = createService(seedEvent({ published: false }));
    await expect(service.create(userA, eventId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("treats null capacity as unlimited seats", async () => {
    const { service } = createService(seedEvent({ capacity: null }));
    const first = await service.create(userA, eventId);
    const second = await service.create(userB, eventId);
    expect(first.freeSeats).toBeNull();
    expect(second.freeSeats).toBeNull();
  });
});
