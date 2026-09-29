// START_MODULE_CONTRACT
// PURPOSE: Upsert the public KudaGo catalog into events and places, and hide rows that left the catalog.
// SCOPE: Database writes for source=kudago only. In-app events (source null) are never touched.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, ./event.entity, ../places/place.entity, ./kudago
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - applyAfishaImport - upsert imported rows and optionally unpublish the ones missing from a complete fetch
// - AfishaImportService - scheduled entry that fetches KudaGo and applies the rows
// END_MODULE_MAP

import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PlaceEntity } from "../places/place.entity";
import { EventEntity } from "./event.entity";
import { AFISHA_SOURCE, fetchKudagoCatalog, type ImportedAfishaEvent, type ImportedPlace, type KudagoCatalog } from "./kudago";

export interface AfishaImportResult {
  upserted: number;
  hidden: number;
}

export async function applyAfishaImport(catalog: KudagoCatalog, events: Repository<EventEntity>, places: Repository<PlaceEntity>): Promise<AfishaImportResult> {
  const seenByCity = new Map<string, Set<string>>();
  let upserted = 0;
  for (const row of catalog.events) {
    const placeId = row.place ? await upsertPlace(places, row.place) : null;
    await upsertEvent(events, row, placeId);
    upserted += 1;
    const seen = seenByCity.get(row.city) ?? new Set<string>();
    seen.add(row.externalId);
    seenByCity.set(row.city, seen);
  }
  let hidden = 0;
  if (catalog.complete) {
    const cities = catalog.cities.length > 0 ? catalog.cities : [...seenByCity.keys()];
    for (const city of cities) {
      const seen = seenByCity.get(city) ?? new Set<string>();
      const current = await events.find({ where: { source: AFISHA_SOURCE, city, published: true } });
      for (const existing of current) {
        if (existing.externalId && seen.has(existing.externalId)) continue;
        existing.published = false;
        await events.save(existing);
        hidden += 1;
      }
    }
  }
  return { upserted, hidden };
}

async function upsertPlace(places: Repository<PlaceEntity>, place: ImportedPlace): Promise<string> {
  const bySource = await places.findOne({ where: { source: AFISHA_SOURCE, externalId: place.externalId } });
  if (bySource) {
    bySource.title = place.title;
    bySource.address = place.address;
    bySource.city = place.city;
    bySource.category = place.category;
    bySource.latitude = place.latitude;
    bySource.longitude = place.longitude;
    bySource.published = true;
    return (await places.save(bySource)).id;
  }
  const byName = await places.findOne({ where: { title: place.title, address: place.address, city: place.city } });
  if (byName) return byName.id;
  const created = places.create({
    title: place.title,
    address: place.address,
    city: place.city,
    category: place.category,
    latitude: place.latitude,
    longitude: place.longitude,
    organizerUserId: null,
    published: true,
    source: AFISHA_SOURCE,
    externalId: place.externalId,
  });
  try {
    return (await places.save(created)).id;
  } catch {
    const again = await places.findOne({ where: { title: place.title, address: place.address, city: place.city } });
    if (again) return again.id;
    throw new Error(`Place ${place.title} could not be saved`);
  }
}

async function upsertEvent(events: Repository<EventEntity>, row: ImportedAfishaEvent, placeId: string | null): Promise<void> {
  const existing = await events.findOne({ where: { source: AFISHA_SOURCE, externalId: row.externalId } });
  const fields = {
    title: row.title,
    description: row.description,
    category: row.category,
    city: row.city,
    placeId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isPaid: row.isPaid,
    priceRub: row.priceRub,
    paymentUrl: row.isPaid ? row.sourceUrl : null,
    coverUrl: row.coverUrl,
    popularity: row.popularity,
    published: true,
    source: AFISHA_SOURCE,
    externalId: row.externalId,
  };
  if (existing) {
    await events.save(events.merge(existing, fields));
    return;
  }
  await events.save(
    events.create({
      ...fields,
      organizerUserId: null,
      capacity: null,
      bookedCount: 0,
      bookingOpensAt: null,
      chatLink: null,
      chatSyncPending: false,
    }),
  );
}

@Injectable()
export class AfishaImportService {
  private readonly logger = new Logger(AfishaImportService.name);

  constructor(
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
  ) {}

  async sync(now = new Date(), fetchImpl: typeof fetch = fetch): Promise<AfishaImportResult> {
    const catalog = await fetchKudagoCatalog(now, fetchImpl);
    const result = await applyAfishaImport(catalog, this.events, this.places);
    this.logger.log(`Afisha import upserted ${result.upserted} and hid ${result.hidden}`);
    return result;
  }
}

export function afishaImportEnabled(): boolean {
  if (process.env.AFISHA_IMPORT === "0") return false;
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") return false;
  return true;
}
