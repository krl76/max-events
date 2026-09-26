import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { ReviewEntity } from "./review.entity";
import { ReviewsService } from "./reviews.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const eventId = "00000000-0000-4000-8000-0000000000e1";

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields, createdAt: now }) as unknown as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => Object.entries(opts.where ?? {}).every(([key, value]) => (row as Record<string, unknown>)[key] === value)),
    findOneBy: async (where: Record<string, unknown>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        store.push(entity);
      }
      return entity;
    },
  };
}

function createService(reviews: ReviewEntity[] = []) {
  const events = createStoreRepo<EventEntity>([{ id: eventId, published: true } as EventEntity]);
  const bookings = createStoreRepo<BookingEntity>([{ id: "b1", userId, eventId, status: "active" } as BookingEntity]);
  const reviewRepo = createStoreRepo<ReviewEntity>(reviews);
  const service = new ReviewsService(reviewRepo as unknown as Repository<ReviewEntity>, bookings as unknown as Repository<BookingEntity>, events as unknown as Repository<EventEntity>);
  return { service, reviewRepo };
}

describe("ReviewsService fact tags", () => {
  it("returns the dictionary for a published event and 404s an unknown one", async () => {
    const { service } = createService();
    const tags = await service.factTags(eventId);
    expect(tags.map((tag) => tag.code)).toEqual(["calm", "kids_ok", "crowded", "pricey", "beginner_friendly"]);
    await expect(service.factTags("00000000-0000-4000-8000-0000000000e9")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("stores fact tags on create and aggregates mood tags, hiding zeros", async () => {
    const { service } = createService();
    await service.create(userId, { eventId, stars: 5, wouldGoAgain: true, photos: [], factTags: ["calm", "kids_ok"] });
    await expect(service.moodTags(eventId)).resolves.toEqual([
      { code: "calm", label: "Спокойно", count: 1 },
      { code: "kids_ok", label: "С детьми ок", count: 1 },
    ]);
  });
});
