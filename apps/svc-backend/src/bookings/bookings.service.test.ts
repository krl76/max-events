import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type DataSource, type EntityManager, type EntityTarget, type FindOneOptions, type ObjectLiteral } from "typeorm";
import type { BookingStatus } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import type { PaymentsService } from "../payments/payments.service";
import type { PromoService } from "../promo/promo.service";
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
    bookingOpensAt: null,
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

function createService(event: EventEntity = seedEvent(), promoOverride?: Partial<Pick<PromoService, "redeemInTransaction" | "recordFulfillmentInTransaction">>) {
  const fake = createDataSource(event);
  const waitlist = { onSeatFreed: async () => null } as unknown as WaitlistService;
  const promo = {
    redeemInTransaction: async () => null,
    recordFulfillmentInTransaction: async () => undefined,
    releaseInTransaction: async () => undefined,
    releaseFulfillmentInTransaction: async () => undefined,
    ...promoOverride,
  } as unknown as PromoService;
  const paymentCalls: string[] = [];
  const refundCalls: string[] = [];
  const payments = {
    refundForBooking: async (bookingId: string) => {
      refundCalls.push(bookingId);
      return null;
    },
    ensureForBooking: async (bookingId: string, amountRub: number, description: string) => {
      paymentCalls.push(bookingId);
      return {
        id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7001",
        bookingId,
        providerPaymentId: "pay_sandbox_1",
        status: "succeeded" as const,
        amountRub,
        currency: "RUB" as const,
        description,
        createdAt: "2026-09-01T07:00:00.000Z",
        updatedAt: "2026-09-01T07:00:00.000Z",
      };
    },
  } as unknown as PaymentsService;
  const service = new BookingsService(fake.dataSource, waitlist, promo, payments);
  return { ...fake, service, waitlist, paymentCalls, refundCalls };
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
    const { service, refundCalls } = createService();
    const created = await service.create(userA, eventId);
    await expect(service.cancel(userB, created.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(refundCalls).toEqual([]);
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

  it("rejects a booking before bookingOpensAt without a promo code", async () => {
    const opens = new Date("2026-09-20T00:00:00Z");
    const promo = {
      redeemInTransaction: async (_manager: unknown, event: EventEntity, code: string | undefined, now: Date) => {
        if (event.bookingOpensAt && now.getTime() < event.bookingOpensAt.getTime() && !code) {
          throw new ForbiddenException("Early access requires a promo code");
        }
        return code ? code.toUpperCase() : null;
      },
    };
    const { service } = createService(seedEvent({ bookingOpensAt: opens }), promo);
    await expect(service.create(userA, eventId, undefined, new Date("2026-09-12T10:00:00Z"))).rejects.toBeInstanceOf(ForbiddenException);
    const booked = await service.create(userA, eventId, "early", new Date("2026-09-12T10:00:00Z"));
    expect(booked.status).toBe("active");
  });

  it("creates a payment for a paid event and reuses it on a second ensurePayment", async () => {
    const { service, paymentCalls } = createService(seedEvent({ isPaid: true, priceRub: 850, paymentUrl: "https://pay.example/jazz" }));
    const booked = await service.create(userA, eventId);
    expect(booked.payment?.status).toBe("succeeded");
    expect(booked.payment?.amountRub).toBe(850);
    expect(booked.payment?.description).toContain("Джаз");
    expect(paymentCalls).toEqual([booked.id]);
    const again = await service.ensurePayment(userA, booked.id);
    expect(again.payment?.bookingId).toBe(booked.id);
    expect(paymentCalls).toEqual([booked.id, booked.id]);
  });

  it("does not create a payment for a free event", async () => {
    const { service, paymentCalls } = createService();
    const booked = await service.create(userA, eventId);
    expect(booked.payment).toBeNull();
    expect(paymentCalls).toEqual([]);
  });

  it("rejects a paid event without a price before taking a seat", async () => {
    const { service, events, paymentCalls } = createService(seedEvent({ isPaid: true, priceRub: null, paymentUrl: "https://pay.example/jazz" }));
    await expect(service.create(userA, eventId)).rejects.toBeInstanceOf(BadRequestException);
    expect(events[0]?.bookedCount).toBe(0);
    expect(paymentCalls).toEqual([]);
  });

  it("does not charge a cancelled booking", async () => {
    const { service, paymentCalls } = createService(seedEvent({ isPaid: true, priceRub: 850, paymentUrl: "https://pay.example/jazz" }));
    const booked = await service.create(userA, eventId);
    expect(paymentCalls).toHaveLength(1);
    await service.cancel(userA, booked.id);
    await expect(service.ensurePayment(userA, booked.id)).rejects.toBeInstanceOf(ConflictException);
    expect(paymentCalls).toHaveLength(1);
  });
});

describe("BookingsService.cancel refunds", () => {
  it("refunds a succeeded payment when the guest cancels", async () => {
    const refunds: string[] = [];
    const fake = createDataSource(seedEvent({ isPaid: true, priceRub: 850, organizerUserId: userA }));
    const waitlist = { onSeatFreed: async () => null } as unknown as WaitlistService;
    const promo = {
      redeemInTransaction: async () => null,
      recordFulfillmentInTransaction: async () => undefined,
      releaseInTransaction: async () => undefined,
      releaseFulfillmentInTransaction: async () => undefined,
    } as unknown as PromoService;
    const payments = {
      ensureForBooking: async (bookingId: string, amountRub: number, description: string) => ({
        id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7001",
        bookingId,
        providerPaymentId: "pay_sandbox_1",
        status: "succeeded" as const,
        amountRub,
        currency: "RUB" as const,
        description,
        commissionRub: 85,
        netRub: 765,
        commissionBps: 1000,
        commissionFixedAt: "2026-09-01T07:00:00.000Z",
        createdAt: "2026-09-01T07:00:00.000Z",
        updatedAt: "2026-09-01T07:00:00.000Z",
      }),
      refundForBooking: async (bookingId: string) => {
        refunds.push(bookingId);
        return { id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7001", bookingId, status: "refunded" };
      },
    } as unknown as PaymentsService;
    const service = new BookingsService(fake.dataSource, waitlist, promo, payments);
    const booked = await service.create(userB, eventId);
    const cancelled = await service.cancel(userB, booked.id);
    expect(cancelled.status).toBe("cancelled");
    expect(refunds).toEqual([booked.id]);
    expect(cancelled.payment?.status).toBe("refunded");
  });

  it("keeps the seat when the provider refund fails", async () => {
    const fake = createDataSource(seedEvent({ isPaid: true, priceRub: 850 }));
    const waitlist = { onSeatFreed: async () => null } as unknown as WaitlistService;
    const promo = {
      redeemInTransaction: async () => null,
      recordFulfillmentInTransaction: async () => undefined,
      releaseInTransaction: async () => undefined,
      releaseFulfillmentInTransaction: async () => undefined,
    } as unknown as PromoService;
    const payments = {
      ensureForBooking: async (bookingId: string, amountRub: number, description: string) => ({
        id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7001",
        bookingId,
        providerPaymentId: "pay_sandbox_1",
        status: "succeeded" as const,
        amountRub,
        currency: "RUB" as const,
        description,
        createdAt: "2026-09-01T07:00:00.000Z",
        updatedAt: "2026-09-01T07:00:00.000Z",
      }),
      refundForBooking: async () => {
        throw new ConflictException("Refund failed");
      },
    } as unknown as PaymentsService;
    const service = new BookingsService(fake.dataSource, waitlist, promo, payments);
    const booked = await service.create(userA, eventId);
    await expect(service.cancel(userA, booked.id)).rejects.toBeInstanceOf(ConflictException);
    expect(fake.events[0]?.bookedCount).toBe(1);
    expect(fake.bookings[0]?.status).toBe("active");
  });

  it("refunds a succeeded payment even if the booking is already cancelled", async () => {
    const refunds: string[] = [];
    const fake = createDataSource(seedEvent({ isPaid: true, priceRub: 850, organizerUserId: userA }));
    const waitlist = { onSeatFreed: async () => null } as unknown as WaitlistService;
    const promo = {
      redeemInTransaction: async () => null,
      recordFulfillmentInTransaction: async () => undefined,
      releaseInTransaction: async () => undefined,
      releaseFulfillmentInTransaction: async () => undefined,
    } as unknown as PromoService;
    const payments = {
      ensureForBooking: async (bookingId: string, amountRub: number, description: string) => ({
        id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7001",
        bookingId,
        providerPaymentId: "pay_sandbox_1",
        status: "succeeded" as const,
        amountRub,
        currency: "RUB" as const,
        description,
        createdAt: "2026-09-01T07:00:00.000Z",
        updatedAt: "2026-09-01T07:00:00.000Z",
      }),
      refundForBooking: async (bookingId: string) => {
        refunds.push(bookingId);
        return { id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7001", bookingId, status: "refunded" as const };
      },
    } as unknown as PaymentsService;
    const service = new BookingsService(fake.dataSource, waitlist, promo, payments);
    const booked = await service.create(userB, eventId);
    fake.bookings[0]!.status = "cancelled";
    fake.events[0]!.bookedCount = 0;
    const healed = await service.cancel(userA, booked.id, { organizerId: userA });
    expect(refunds).toEqual([booked.id]);
    expect(healed.status).toBe("cancelled");
    expect(fake.events[0]?.bookedCount).toBe(0);
  });
});
