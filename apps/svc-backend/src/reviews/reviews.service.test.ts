import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { ReviewEntity } from "./review.entity";
import { buildRating, ReviewsService } from "./reviews.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const placeId = "00000000-0000-4000-8000-0000000000p1";

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields, createdAt: now }) as unknown as T,
    find: async (opts: { where?: Record<string, string> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        store.push(entity);
      }
      return entity;
    },
  };
}

function createService(opts: { booked?: boolean } = {}) {
  const reviews = createStoreRepo<ReviewEntity>();
  const bookings = createStoreRepo<BookingEntity>(opts.booked === false ? [] : [{ id: "b1", userId, eventId, status: "active" } as BookingEntity]);
  const events = createStoreRepo<EventEntity>([{ id: eventId, placeId } as EventEntity]);
  const service = new ReviewsService(reviews as unknown as Repository<ReviewEntity>, bookings as unknown as Repository<BookingEntity>, events as unknown as Repository<EventEntity>);
  return { service, reviews };
}

describe("ReviewsService.create", () => {
  it("rejects a review from a user without a booking", async () => {
    const { service } = createService({ booked: false });
    await expect(service.create(userId, { eventId, stars: 5, wouldGoAgain: true, photos: [] })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects an unknown event", async () => {
    const { service } = createService();
    await expect(service.create(userId, { eventId: "00000000-0000-4000-8000-0000000000e9", stars: 5, wouldGoAgain: true, photos: [] })).rejects.toBeInstanceOf(NotFoundException);
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
