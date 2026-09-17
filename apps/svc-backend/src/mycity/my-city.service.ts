// START_MODULE_CONTRACT
// PURPOSE: Aggregate «Мой город» from check-ins — unique places/events/districts and map points.
// SCOPE: GET payload { summary, points }; districts are 0.01° geo cells of visited places.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, check-ins/events/places
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - districtKey - round lat/lng to a neighbourhood cell
// - MyCityService - build MyCityPayload for CurrentUser
// END_MODULE_MAP

import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { MemoryPointSchema, type MemoryPoint, type MyCityPayload } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { PlaceEntity } from "../places/place.entity";

export function districtKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

@Injectable()
export class MyCityService {
  constructor(
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
  ) {}

  async forUser(userId: string, requesterId: string): Promise<MyCityPayload> {
    if (userId !== requesterId) throw new ForbiddenException("Cannot read another user's city");
    const mine = await this.checkIns.find({ where: { userId } });
    const eventIdsToLoad = [...new Set(mine.map((row) => row.eventId).filter((id): id is string => id !== null))];
    const events = eventIdsToLoad.length === 0 ? [] : await this.events.find({ where: { id: In(eventIdsToLoad) } });
    const eventById = new Map(events.map((row) => [row.id, row]));
    const placeIdsToLoad = [
      ...new Set(
        mine.flatMap((row) => {
          if (row.placeId) return [row.placeId];
          const fromEvent = row.eventId ? eventById.get(row.eventId)?.placeId : null;
          return fromEvent ? [fromEvent] : [];
        }),
      ),
    ];
    const places = placeIdsToLoad.length === 0 ? [] : await this.places.find({ where: { id: In(placeIdsToLoad) } });
    const placeById = new Map(places.map((row) => [row.id, row]));

    const placeIds = new Set<string>();
    const eventIds = new Set<string>();
    const districts = new Set<string>();
    const points: MemoryPoint[] = [];

    for (const row of mine) {
      if (row.eventId) eventIds.add(row.eventId);
      const placeId = row.placeId ?? eventById.get(row.eventId ?? "")?.placeId ?? null;
      if (placeId) placeIds.add(placeId);
      const place = placeId ? placeById.get(placeId) : undefined;
      if (place) districts.add(districtKey(place.latitude, place.longitude));
      const point = toMemoryPoint(row, place);
      if (point) points.push(point);
    }

    points.sort((a, b) => (a.visitedAt < b.visitedAt ? 1 : -1));
    return {
      summary: { userId, placesCount: placeIds.size, eventsCount: eventIds.size, districtsCount: districts.size },
      points,
    };
  }
}

function toMemoryPoint(row: CheckInEntity, place: PlaceEntity | undefined): MemoryPoint | null {
  if (!place) return null;
  const eventId = row.eventId;
  const placeId = eventId ? null : row.placeId;
  if (eventId === null && placeId === null) return null;
  return MemoryPointSchema.parse({
    latitude: place.latitude,
    longitude: place.longitude,
    eventId,
    placeId,
    visitedAt: row.checkedInAt.toISOString(),
  });
}
