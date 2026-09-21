import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { EventCategorySchema } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { SEED_EVENTS, SEED_PLACES } from "./seed-data";
import { futureStart, seedDatabase } from "./seed";

const now = new Date("2026-09-12T10:00:00Z");

function createPlaceRepo(initial: PlaceEntity[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<PlaceEntity>) => ({ ...fields }) as PlaceEntity,
    findOneBy: async (where: { title: string; address: string; city: string }) => store.find((row) => row.title === where.title && row.address === where.address && row.city === where.city) ?? null,
    save: async (entity: PlaceEntity) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        entity.createdAt ??= now;
        entity.updatedAt ??= now;
        store.push(entity);
      }
      return entity;
    },
  };
}

function createEventRepo(initial: EventEntity[] = []) {
  const store = [...initial];
  let seq = 100;
  return {
    store,
    create: (fields: Partial<EventEntity>) => ({ ...fields }) as EventEntity,
    findOneBy: async (where: { title: string; city: string; startsAt: Date }) => store.find((row) => row.title === where.title && row.city === where.city && row.startsAt.getTime() === where.startsAt.getTime()) ?? null,
    save: async (entity: EventEntity) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        entity.createdAt ??= now;
        entity.updatedAt ??= now;
        store.push(entity);
      }
      return entity;
    },
  };
}

describe("futureStart", () => {
  it("is stable for the same UTC day and offset", () => {
    const a = futureStart(new Date("2026-09-12T10:00:00Z"), 7, 16);
    const b = futureStart(new Date("2026-09-12T23:00:00Z"), 7, 16);
    expect(a.toISOString()).toBe("2026-09-19T16:00:00.000Z");
    expect(b.toISOString()).toBe(a.toISOString());
  });
});

describe("seedDatabase", () => {
  it("inserts the Moscow pool once and is idempotent on rerun", async () => {
    const places = createPlaceRepo();
    const events = createEventRepo();
    const first = await seedDatabase(places as unknown as Repository<PlaceEntity>, events as unknown as Repository<EventEntity>, now);
    expect(first.placesInserted).toBe(SEED_PLACES.length);
    expect(first.eventsInserted).toBe(SEED_EVENTS.length);
    expect(places.store).toHaveLength(SEED_PLACES.length);
    expect(events.store).toHaveLength(SEED_EVENTS.length);

    const second = await seedDatabase(places as unknown as Repository<PlaceEntity>, events as unknown as Repository<EventEntity>, now);
    expect(second).toEqual({ placesInserted: 0, eventsInserted: 0 });
    expect(places.store).toHaveLength(SEED_PLACES.length);
    expect(events.store).toHaveLength(SEED_EVENTS.length);

    const laterSameUtcDay = await seedDatabase(places as unknown as Repository<PlaceEntity>, events as unknown as Repository<EventEntity>, new Date("2026-09-12T23:59:00Z"));
    expect(laterSameUtcDay).toEqual({ placesInserted: 0, eventsInserted: 0 });
    expect(events.store).toHaveLength(SEED_EVENTS.length);
  });

  it("covers all four event categories with future dates and geo places", async () => {
    const places = createPlaceRepo();
    const events = createEventRepo();
    await seedDatabase(places as unknown as Repository<PlaceEntity>, events as unknown as Repository<EventEntity>, now);

    const categories = new Set(events.store.map((row) => row.category));
    expect([...EventCategorySchema.options].every((category) => categories.has(category))).toBe(true);
    expect(events.store.every((row) => row.startsAt.getTime() > now.getTime())).toBe(true);
    expect(places.store.every((row) => row.latitude >= -90 && row.latitude <= 90 && row.longitude >= -180 && row.longitude <= 180)).toBe(true);
    expect(places.store.every((row) => row.city === "Москва")).toBe(true);
  });

  it("does not point seed events at dead example.com payment URLs", () => {
    expect(SEED_EVENTS.every((spec) => spec.paymentUrl == null || !spec.paymentUrl.includes("example.com"))).toBe(true);
  });
});
