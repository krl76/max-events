import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { ReviewEntity } from "./review.entity";
import { buildRating, ReviewsService } from "./reviews.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const placeId = "00000000-0000-4000-8000-0000000000p1";

function inValues(value: unknown): unknown[] | undefined {
  if (value && typeof value === "object" && Array.isArray((value as { _value?: unknown })._value)) return (value as { _value: unknown[] })._value;
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
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields, createdAt: now }) as unknown as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => matchesWhere(row as object, where));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => matchesWhere(row as object, where)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        store.push(entity);
      }
      return entity;
    },
  };
}

function createService(opts: { booked?: boolean; published?: boolean; bookingStatus?: BookingEntity["status"] } = {}) {
  const reviews = createStoreRepo<ReviewEntity>();
  const bookings = createStoreRepo<BookingEntity>(opts.booked === false ? [] : [{ id: "b1", userId, eventId, status: opts.bookingStatus ?? "active" } as BookingEntity]);
  const events = createStoreRepo<EventEntity>([{ id: eventId, placeId, published: opts.published ?? true } as EventEntity]);
  const service = new ReviewsService(reviews as unknown as Repository<ReviewEntity>, bookings as unknown as Repository<BookingEntity>, events as unknown as Repository<EventEntity>);
  return { service, reviews };
}

describe("ReviewsService.create", () => {
  it("rejects a review from a user without a booking", async () => {
    const { service } = createService({ booked: false });
    await expect(service.create(userId, { eventId, stars: 5, wouldGoAgain: true, photos: [] })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a review backed only by a cancelled booking", async () => {
    const { service, reviews } = createService({ bookingStatus: "cancelled" });
    await expect(service.create(userId, { eventId, stars: 5, wouldGoAgain: true, photos: [] })).rejects.toBeInstanceOf(ForbiddenException);
    expect(reviews.store).toHaveLength(0);
  });

  it("rejects an unknown event", async () => {
    const { service } = createService();
    await expect(service.create(userId, { eventId: "00000000-0000-4000-8000-0000000000e9", stars: 5, wouldGoAgain: true, photos: [] })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects an unpublished event", async () => {
    const { service } = createService({ published: false });
    await expect(service.create(userId, { eventId, stars: 5, wouldGoAgain: true, photos: [] })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("recovers from a unique-violation race on create", async () => {
    const { service, reviews } = createService();
    reviews.store.push({
      id: "00000000-0000-4000-8000-0000000000d1",
      userId,
      eventId,
      stars: 3,
      categoryScores: {},
      wouldGoAgain: false,
      photoUrls: [],
      factTags: [],
      text: null,
      createdAt: now,
    } as ReviewEntity);
    reviews.findOneBy = async () => {
      reviews.findOneBy = async (where: Record<string, string>) => reviews.store.find((row) => matchesWhere(row as object, where)) ?? null;
      return null;
    };
    const originalSave = reviews.save;
    reviews.save = async (_entity) => {
      reviews.save = originalSave;
      throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate"), { code: "23505" }));
    };
    const saved = await service.create(userId, { eventId, stars: 5, wouldGoAgain: true, photos: [] });
    expect(saved.stars).toBe(5);
    expect(reviews.store).toHaveLength(1);
  });

  it("stores a booked user's review and replaces it on resubmit", async () => {
    const { service, reviews } = createService();
    const first = await service.create(userId, { eventId, stars: 4, wouldGoAgain: false, photos: [], text: "ok" });
    expect(first.stars).toBe(4);
    expect(first.eventId).toBe(eventId);
    const second = await service.create(userId, { eventId, stars: 5, wouldGoAgain: true, photos: [{ url: "https://cdn.example/p.jpg" }], categoryScores: { atmosphere: 5 } });
    expect(second.stars).toBe(5);
    expect(second.wouldGoAgain).toBe(true);
    expect(second.photos).toEqual([{ url: "https://cdn.example/p.jpg" }]);
    expect(reviews.store).toHaveLength(1);
  });
});

describe("buildRating", () => {
  it("averages stars and category scores, leaving unscored categories null", () => {
    const rows = [
      { stars: 5, categoryScores: { atmosphere: 5, price: 3 } },
      { stars: 3, categoryScores: { atmosphere: 3 } },
    ] as ReviewEntity[];
    const rating = buildRating(rows, { eventId, placeId: null });
    expect(rating.summary.averageStars).toBe(4);
    expect(rating.summary.reviewsCount).toBe(2);
    expect(rating.categoryAverages.atmosphere).toBe(4);
    expect(rating.categoryAverages.price).toBe(3);
    expect(rating.categoryAverages.organization).toBeNull();
  });
});

describe("ReviewsService.eventRating", () => {
  it("returns zeros when nobody reviewed yet", async () => {
    const { service } = createService();
    const rating = await service.eventRating(eventId);
    expect(rating.summary.reviewsCount).toBe(0);
    expect(rating.summary.averageStars).toBe(0);
    expect(rating.summary.eventId).toBe(eventId);
  });
});

describe("ReviewsService.placeRating", () => {
  it("aggregates reviews for events at the place", async () => {
    const { service } = createService();
    await service.create(userId, { eventId, stars: 4, wouldGoAgain: true, photos: [] });
    const rating = await service.placeRating(placeId);
    expect(rating.summary.placeId).toBe(placeId);
    expect(rating.summary.reviewsCount).toBe(1);
    expect(rating.summary.averageStars).toBe(4);
  });
});
