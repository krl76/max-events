// START_MODULE_CONTRACT
// PURPOSE: Day-route timeline with walking legs and order optimization (min total distance).
// SCOPE: build() from event/place stops; optimize() brute-force permutation of 2–8 points.
// DEPENDS: typeorm, @max-events/api-contracts, events/places, plans haversine
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - walkingMinutes - meters at 80 m/min
// - toDayRoute - points to legs and totals
// - shortestPermutation - keep start, permute the rest
// - RoutesService - build and optimize
// END_MODULE_MAP

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { CreateDayRouteWrite, DayRoute, OptimizeRoute, RoutePoint } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { haversineMeters } from "../plans/plans.service";
import { PlaceEntity } from "../places/place.entity";

const WALK_M_PER_MIN = 80;

export function walkingMinutes(meters: number): number {
  return Math.max(0, Math.round(meters / WALK_M_PER_MIN));
}

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
  ) {}

  async build(payload: CreateDayRouteWrite): Promise<DayRoute> {
    const points = await this.resolve(payload);
    return toDayRoute(points);
  }

  async optimize(payload: CreateDayRouteWrite): Promise<OptimizeRoute> {
    const points = await this.resolve(payload);
    const original = toDayRoute(points);
    const best = shortestPermutation(points);
    const optimized = toDayRoute(best);
    return {
      original,
      optimized,
      savedMinutes: original.totalMinutes - optimized.totalMinutes,
      savedKm: Math.round((original.totalKm - optimized.totalKm) * 10) / 10,
    };
  }

  private async resolve(payload: CreateDayRouteWrite): Promise<RoutePoint[]> {
    const points: RoutePoint[] = [];
    for (const stop of payload.stops) {
      if (stop.eventId) {
        const event = await this.events.findOneBy({ id: stop.eventId });
        if (!event) throw new NotFoundException("Event not found");
        if (!event.placeId) throw new BadRequestException("Event has no place");
        const place = await this.places.findOneBy({ id: event.placeId });
        if (!place) throw new NotFoundException("Place not found");
        points.push({ title: event.title, at: event.startsAt.toISOString(), latitude: place.latitude, longitude: place.longitude, eventId: event.id, placeId: place.id });
      } else if (stop.placeId) {
        const place = await this.places.findOneBy({ id: stop.placeId });
        if (!place) throw new NotFoundException("Place not found");
        points.push({ title: place.title, at: null, latitude: place.latitude, longitude: place.longitude, eventId: null, placeId: place.id });
      }
    }
    if (payload.latitude !== undefined && payload.longitude !== undefined) {
      points.unshift({ title: "Старт", at: null, latitude: payload.latitude, longitude: payload.longitude, eventId: null, placeId: null });
    }
    if (points.length < 2) throw new BadRequestException("Need at least two route points");
    return points;
  }
}

export function toDayRoute(points: RoutePoint[]): DayRoute {
  const legs = [];
  let totalMeters = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const meters = haversineMeters({ latitude: from.latitude, longitude: from.longitude }, to.latitude, to.longitude);
    totalMeters += meters;
    legs.push({ fromTitle: from.title, toTitle: to.title, travelMinutes: walkingMinutes(meters), distanceKm: Math.round((meters / 1000) * 10) / 10 });
  }
  return { points, legs, totalMinutes: walkingMinutes(totalMeters), totalKm: Math.round((totalMeters / 1000) * 10) / 10 };
}

export function shortestPermutation(points: RoutePoint[]): RoutePoint[] {
  const [head, ...tail] = points;
  if (!head || tail.length === 0) return points;
  let best = points;
  let bestMeters = totalMeters(points);
  for (const perm of permutations(tail)) {
    const candidate = [head, ...perm];
    const meters = totalMeters(candidate);
    if (meters < bestMeters) {
      best = candidate;
      bestMeters = meters;
    }
  }
  return best;
}

function totalMeters(points: RoutePoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;
    sum += haversineMeters({ latitude: from.latitude, longitude: from.longitude }, to.latitude, to.longitude);
  }
  return sum;
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  items.forEach((item, index) => {
    const rest = items.filter((_, i) => i !== index);
    for (const perm of permutations(rest)) result.push([item, ...perm]);
  });
  return result;
}
