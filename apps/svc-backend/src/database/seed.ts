// START_MODULE_CONTRACT
// PURPOSE: Idempotent catalog seed — upsert places then events from the Moscow starter pool.
// SCOPE: seedDatabase(places, events, now); does not open a DB connection or call MAX Bot API.
// DEPENDS: typeorm, @max-events/api-contracts, ./seed-data, places/events entities
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - futureStart - UTC midnight of now plus dayOffset at hourUtc
// - seedDatabase - upsert places by title+address+city and events by title+city+startsAt
// END_MODULE_MAP

import type { Repository } from "typeorm";
import { CreateEventSchema, CreatePlaceSchema } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { SEED_EVENTS, SEED_PLACES } from "./seed-data";

export function futureStart(now: Date, dayOffset: number, hourUtc: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hourUtc, 0, 0, 0));
}

export type SeedResult = { placesInserted: number; eventsInserted: number };

export async function seedDatabase(places: Repository<PlaceEntity>, events: Repository<EventEntity>, now = new Date()): Promise<SeedResult> {
  const placeIds = new Map<string, string>();
  let placesInserted = 0;
  for (const raw of SEED_PLACES) {
    const payload = CreatePlaceSchema.parse(raw);
    const existing = await places.findOneBy({ title: payload.title, address: payload.address, city: payload.city });
    if (existing) {
      placeIds.set(payload.title, existing.id);
      continue;
    }
    const saved = await places.save(places.create(payload));
    placeIds.set(payload.title, saved.id);
    placesInserted += 1;
  }

  let eventsInserted = 0;
  for (const spec of SEED_EVENTS) {
    const placeId = placeIds.get(spec.placeTitle);
    if (!placeId) throw new Error(`seed place not found: ${spec.placeTitle}`);
    const startsAt = futureStart(now, spec.dayOffset, spec.hourUtc);
    const endsAt = spec.durationHours ? new Date(startsAt.getTime() + spec.durationHours * 3_600_000) : null;
    const payload = CreateEventSchema.parse({
      title: spec.title,
      description: spec.description,
      category: spec.category,
      city: spec.city,
      placeId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt ? endsAt.toISOString() : null,
      isPaid: spec.isPaid ?? false,
      priceRub: spec.priceRub ?? null,
      paymentUrl: spec.paymentUrl ?? null,
      capacity: spec.capacity ?? null,
    });
    const existing = await events.findOneBy({ title: payload.title, city: payload.city, startsAt: new Date(payload.startsAt) });
    if (existing) continue;
    await events.save(
      events.create({
        title: payload.title,
        description: payload.description,
        category: payload.category,
        city: payload.city,
        placeId: payload.placeId,
        startsAt: new Date(payload.startsAt),
        endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
        isPaid: payload.isPaid,
        priceRub: payload.priceRub,
        paymentUrl: payload.paymentUrl,
        capacity: payload.capacity,
        bookedCount: 0,
        published: true,
        chatLink: null,
        chatSyncPending: true,
      }),
    );
    eventsInserted += 1;
  }

  return { placesInserted, eventsInserted };
}
