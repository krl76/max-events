import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { applyAfishaImport } from "./afisha-import.service";
import type { EventEntity } from "./event.entity";
import type { ImportedAfishaEvent } from "./kudago";
import type { PlaceEntity } from "../places/place.entity";

function eventRow(partial: ImportedAfishaEvent): ImportedAfishaEvent {
  return partial;
}

function memoryRepos() {
  const events: EventEntity[] = [];
  const places: PlaceEntity[] = [];
  let eventSeq = 0;
  let placeSeq = 0;
  const eventRepo = {
    findOne: async ({ where }: { where: { source?: string; externalId?: string } }) => events.find((row) => row.source === where.source && row.externalId === where.externalId) ?? null,
    find: async ({ where }: { where: { source?: string; city?: string; published?: boolean } }) => events.filter((row) => row.source === where.source && row.city === where.city && row.published === where.published),
    create: (fields: Partial<EventEntity>) => ({ ...fields }) as EventEntity,
    merge: (target: EventEntity, fields: Partial<EventEntity>) => Object.assign(target, fields),
    save: async (entity: EventEntity) => {
      if (!entity.id) {
        eventSeq += 1;
        entity.id = `event-${eventSeq}`;
        events.push(entity);
      }
      return entity;
    },
  };
  const placeRepo = {
    findOne: async ({ where }: { where: { source?: string; externalId?: string; title?: string; address?: string; city?: string } }) => {
      if (where.externalId) return places.find((row) => row.source === where.source && row.externalId === where.externalId) ?? null;
      return places.find((row) => row.title === where.title && row.address === where.address && row.city === where.city) ?? null;
    },
    create: (fields: Partial<PlaceEntity>) => ({ ...fields }) as PlaceEntity,
    save: async (entity: PlaceEntity) => {
      if (!entity.id) {
        placeSeq += 1;
        entity.id = `place-${placeSeq}`;
        places.push(entity);
      }
      return entity;
    },
  };
  return { events, places, eventRepo: eventRepo as unknown as Repository<EventEntity>, placeRepo: placeRepo as unknown as Repository<PlaceEntity> };
}

const jazz: ImportedAfishaEvent = eventRow({
  externalId: "42",
  title: "Джаз",
  description: "Вечер",
  category: "afisha",
  city: "Москва",
  startsAt: new Date("2026-10-02T16:00:00.000Z"),
  endsAt: new Date("2026-10-02T19:00:00.000Z"),
  isPaid: true,
  priceRub: 1500,
  sourceUrl: "https://kudago.com/msk/event/jazz/",
  coverUrl: "https://media.kudago.com/images/event/ab/jazz.jpg",
  popularity: 80,
  place: { externalId: "7", title: "Филармония", address: "ул. Тверская, 1", city: "Москва", category: "other", latitude: 55.76, longitude: 37.61 },
});

describe("applyAfishaImport", () => {
  it("inserts a place and an event, then updates the same row without a second copy", async () => {
    const memory = memoryRepos();

    const first = await applyAfishaImport({ events: [jazz], cities: ["Москва"], complete: true }, memory.eventRepo, memory.placeRepo);
    const second = await applyAfishaImport({ events: [{ ...jazz, title: "Джаз вечером", popularity: 90 }], cities: ["Москва"], complete: true }, memory.eventRepo, memory.placeRepo);

    expect(first).toEqual({ upserted: 1, hidden: 0 });
    expect(second.upserted).toBe(1);
    expect(memory.events).toHaveLength(1);
    expect(memory.places).toHaveLength(1);
    expect(memory.events[0]).toMatchObject({ title: "Джаз вечером", popularity: 90, chatSyncPending: false, bookedCount: 0, source: "kudago", externalId: "42", placeId: "place-1", paymentUrl: jazz.sourceUrl });
  });

  it("hides a catalog event that a complete pull no longer returns", async () => {
    const memory = memoryRepos();
    await applyAfishaImport({ events: [jazz, { ...jazz, externalId: "43", title: "Ушло" }], cities: ["Москва"], complete: true }, memory.eventRepo, memory.placeRepo);

    const result = await applyAfishaImport({ events: [jazz], cities: ["Москва"], complete: true }, memory.eventRepo, memory.placeRepo);

    expect(result.hidden).toBe(1);
    expect(memory.events.find((row) => row.externalId === "43")?.published).toBe(false);
    expect(memory.events.find((row) => row.externalId === "42")?.published).toBe(true);
  });

  it("keeps rows that were not on a partial page", async () => {
    const memory = memoryRepos();
    await applyAfishaImport({ events: [jazz, { ...jazz, externalId: "43", title: "Дальше" }], cities: ["Москва"], complete: true }, memory.eventRepo, memory.placeRepo);

    const result = await applyAfishaImport({ events: [jazz], cities: ["Москва"], complete: false }, memory.eventRepo, memory.placeRepo);

    expect(result.hidden).toBe(0);
    expect(memory.events.every((row) => row.published)).toBe(true);
  });
});
