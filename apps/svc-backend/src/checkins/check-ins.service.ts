// START_MODULE_CONTRACT
// PURPOSE: Check-in «Я здесь» — event or place, per-visit dedup, visit statistics.
// SCOPE: Event unique per user; place unique per user+UTC day; stats unique places (incl. event.placeId) and per-category event counts.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, events/places
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - utcVisitDate - YYYY-MM-DD from a Date
// - CheckInsService - create, stats
// END_MODULE_MAP

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventCategorySchema, type CheckIn, type CreateCheckInWrite, type EventCategory, type VisitStats } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";
import { CheckInEntity } from "./check-in.entity";

export function utcVisitDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

@Injectable()
export class CheckInsService {
  constructor(
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
  ) {}

  async create(userId: string, payload: CreateCheckInWrite, now = new Date()): Promise<CheckIn> {
    if (payload.eventId) {
      const event = await this.events.findOneBy({ id: payload.eventId });
      if (!event) throw new NotFoundException("Event not found");
      const existing = (await this.checkIns.find({ where: { userId } })).find((row) => row.eventId === payload.eventId);
      if (existing) return toCheckInDto(existing);
      const saved = await this.checkIns.save(this.checkIns.create({ userId, eventId: payload.eventId, placeId: null, visitDate: null }));
      return toCheckInDto(saved);
    }
    const placeId = payload.placeId!;
    const place = await this.places.findOneBy({ id: placeId });
    if (!place) throw new NotFoundException("Place not found");
    const day = utcVisitDate(now);
    const existing = (await this.checkIns.find({ where: { userId } })).find((row) => row.placeId === placeId && row.visitDate === day);
    if (existing) return toCheckInDto(existing);
    const saved = await this.checkIns.save(this.checkIns.create({ userId, eventId: null, placeId, visitDate: day }));
    return toCheckInDto(saved);
  }

  async stats(userId: string, requesterId: string): Promise<VisitStats> {
    if (userId !== requesterId) throw new ForbiddenException("Cannot read another user's visit stats");
    const mine = await this.checkIns.find({ where: { userId } });
    const events = await this.events.find();
    const eventById = new Map(events.map((row) => [row.id, row]));
    const placeIds = new Set<string>();
    const byCategory = new Map<EventCategory, number>();
    for (const row of mine) {
      if (row.placeId) placeIds.add(row.placeId);
      if (!row.eventId) continue;
      const event = eventById.get(row.eventId);
      if (!event) continue;
      if (event.placeId) placeIds.add(event.placeId);
      byCategory.set(event.category, (byCategory.get(event.category) ?? 0) + 1);
    }
    return {
      userId,
      placesCount: placeIds.size,
      eventsCount: mine.filter((row) => row.eventId !== null).length,
      byCategory: EventCategorySchema.options.map((category) => ({ category, count: byCategory.get(category) ?? 0 })),
    };
  }
}

export function toCheckInDto(row: CheckInEntity): CheckIn {
  return {
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    placeId: row.placeId,
    checkedInAt: row.checkedInAt.toISOString(),
  };
}
