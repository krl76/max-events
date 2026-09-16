// START_MODULE_CONTRACT
// PURPOSE: Event persistence — CRUD and catalog list mapped to api-contracts Event.
// SCOPE: Create/read/update/delete, optional place FK, payment-link invariant, catalog filters on city/category/start date.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../places/places.service, ./event.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventsService - CRUD + list against EventEntity
// - toEventDto - map EventEntity to the api-contracts Event shape
// END_MODULE_MAP

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateEventSchema, EventSchema, type CreateEvent, type Event, type EventCategory } from "@max-events/api-contracts";
import { PlacesService } from "../places/places.service";
import { EventEntity } from "./event.entity";

export type EventListQuery = {
  city?: string;
  category?: EventCategory;
  date?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

const EVENT_PATCH_KEYS = ["title", "description", "category", "city", "placeId", "startsAt", "endsAt", "isPaid", "priceRub", "paymentUrl", "capacity"] as const;

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly events: Repository<EventEntity>,
    @Inject(PlacesService) private readonly places: PlacesService,
  ) {}

  async create(payload: CreateEvent): Promise<Event> {
    await assertPlaceBound(this.places, payload.placeId);
    assertTimeRange(payload.startsAt, payload.endsAt);
    const saved = await this.events.save(this.events.create({ ...toColumns(payload), published: true }));
    return toEventDto(saved);
  }

  async getById(id: string): Promise<Event> {
    const found = await this.events.findOneBy({ id });
    if (!found) throw new NotFoundException("Event not found");
    return toEventDto(found);
  }

  async update(id: string, patch: Record<string, unknown>): Promise<Event> {
    const existing = await this.events.findOneBy({ id });
    if (!existing) throw new NotFoundException("Event not found");
    const merged = EventSchema.safeParse({ ...toEventDto(existing), ...pickEventFields(patch) });
    if (!merged.success) throw new BadRequestException("Invalid event payload");
    await assertPlaceBound(this.places, merged.data.placeId);
    assertTimeRange(merged.data.startsAt, merged.data.endsAt);
    const saved = await this.events.save(this.events.merge(existing, toColumns(merged.data)));
    return toEventDto(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.events.delete({ id });
    if (!result.affected) throw new NotFoundException("Event not found");
  }

  async list(query: EventListQuery): Promise<Event[]> {
    const where: { published: true; city?: string; category?: EventCategory } = { published: true };
    if (query.city) where.city = query.city;
    if (query.category) where.category = query.category;
    const rows = await this.events.find({ where, order: { startsAt: "ASC", id: "ASC" } });
    return rows.filter((row) => matchesStartWindow(row.startsAt, query)).map(toEventDto);
  }
}

export function toEventDto(event: EventEntity): Event {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    city: event.city,
    placeId: event.placeId,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt ? event.endsAt.toISOString() : null,
    isPaid: event.isPaid,
    priceRub: event.priceRub,
    paymentUrl: event.paymentUrl,
    capacity: event.capacity,
  };
}

export function pickEventFields(patch: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of EVENT_PATCH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) picked[key] = patch[key];
  }
  return picked;
}

function toColumns(payload: CreateEvent | Event): Omit<CreateEvent, "startsAt" | "endsAt"> & { startsAt: Date; endsAt: Date | null } {
  const parsed = CreateEventSchema.parse(payload);
  return {
    title: parsed.title,
    description: parsed.description,
    category: parsed.category,
    city: parsed.city,
    placeId: parsed.placeId,
    startsAt: new Date(parsed.startsAt),
    endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
    isPaid: parsed.isPaid,
    priceRub: parsed.priceRub,
    paymentUrl: parsed.paymentUrl,
    capacity: parsed.capacity,
  };
}

function matchesStartWindow(startsAt: Date, query: EventListQuery): boolean {
  if (query.date) {
    const from = new Date(`${query.date}T00:00:00.000Z`);
    const to = new Date(from.getTime() + 86_400_000);
    if (startsAt < from || startsAt >= to) return false;
  }
  if (query.dateFrom && startsAt < query.dateFrom) return false;
  if (query.dateTo && startsAt > query.dateTo) return false;
  return true;
}

async function assertPlaceBound(places: PlacesService, placeId: string | null): Promise<void> {
  if (!placeId) return;
  try {
    await places.getById(placeId);
  } catch (error) {
    if (error instanceof NotFoundException) throw new BadRequestException("Place not found");
    throw error;
  }
}

function assertTimeRange(startsAt: string, endsAt: string | null): void {
  if (endsAt && new Date(endsAt) < new Date(startsAt)) {
    throw new BadRequestException("endsAt must not be before startsAt");
  }
}
