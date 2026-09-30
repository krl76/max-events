// START_MODULE_CONTRACT
// PURPOSE: Day-route timeline with walking legs and order optimization (min total distance).
// SCOPE: build() from event/place stops; optimize() brute-force permutation of 2–8 points; travelToPlace() walk/metro/car tiles for a map pin.
// DEPENDS: typeorm, @max-events/api-contracts, events/places, geo/haversine
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - travelMinutes - meters at the speed of the chosen mode
// - walkingMinutes - meters at 80 m/min
// - pickMode - walk, metro or taxi for a distance, honouring the cheaper / no-taxi preference
// - transferFor - one leg: its mode, its minutes and what it costs
// - toDayRoute - points to legs and totals
// - shortestPermutation - keep start, permute the rest
// - RoutesService - build, optimize, travelToPlace
// END_MODULE_MAP

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { CreateDayRouteWrite, DayRoute, OptimizeRoute, RouteMode, RoutePoint, RoutePrefer, TravelOption } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { haversineMeters } from "../geo/haversine";
import { PlaceEntity } from "../places/place.entity";

const WALK_M_PER_MIN = 80;
const METRO_M_PER_MIN = 400;
const TAXI_M_PER_MIN = 500;
const METRO_FARE_RUB = 67;
const TAXI_LANDING_RUB = 150;
const TAXI_PER_KM_RUB = 40;

export function walkingMinutes(meters: number): number {
  return travelMinutes(meters, "walk");
}

export function travelMinutes(meters: number, mode: RouteMode): number {
  const speed = mode === "taxi" ? TAXI_M_PER_MIN : mode === "metro" ? METRO_M_PER_MIN : WALK_M_PER_MIN;
  return Math.max(0, Math.round(meters / speed));
}

export function pickMode(meters: number, prefer: RoutePrefer = "default"): RouteMode {
  if (prefer === "no_taxi" || prefer === "cheaper") return meters >= 1500 ? "metro" : "walk";
  if (meters >= 8000) return "taxi";
  if (meters >= 1500) return "metro";
  return "walk";
}

export function transferFor(meters: number, prefer: RoutePrefer = "default"): { mode: RouteMode; minutes: number; priceRub: number | null } {
  const mode = pickMode(meters, prefer);
  const minutes = travelMinutes(meters, mode);
  const priceRub = mode === "metro" ? METRO_FARE_RUB : mode === "taxi" ? TAXI_LANDING_RUB + Math.round((meters / 1000) * TAXI_PER_KM_RUB) : null;
  return { mode, minutes, priceRub };
}

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
  ) {}

  async build(payload: CreateDayRouteWrite): Promise<DayRoute> {
    const points = await this.resolve(payload);
    return toDayRoute(points, payload.prefer ?? "default");
  }

  async travelToPlace(placeId: string, origin: { latitude: number; longitude: number }): Promise<TravelOption[]> {
    const place = await this.places.findOneBy({ id: placeId });
    if (!place || place.published === false) throw new NotFoundException("Place not found");
    const meters = haversineMeters(origin, place.latitude, place.longitude);
    const distanceKm = Math.round((meters / 1000) * 10) / 10;
    return [
      { mode: "walk", minutes: travelMinutes(meters, "walk"), distanceKm, transfers: null },
      { mode: "metro", minutes: travelMinutes(meters, "metro"), distanceKm, transfers: meters >= 4000 ? 1 : 0 },
      { mode: "car", minutes: travelMinutes(meters, "taxi"), distanceKm, transfers: null },
    ];
  }

  async optimize(payload: CreateDayRouteWrite): Promise<OptimizeRoute> {
    const points = await this.resolve(payload);
    const prefer = payload.prefer ?? "default";
    const original = toDayRoute(points, prefer);
    const best = shortestPermutation(points);
    const optimized = toDayRoute(best, prefer);
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

export function toDayRoute(points: RoutePoint[], prefer: RoutePrefer = "default"): DayRoute {
  const legs = [];
  let totalMeters = 0;
  let totalMinutes = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const meters = haversineMeters({ latitude: from.latitude, longitude: from.longitude }, to.latitude, to.longitude);
    totalMeters += meters;
    const mode = pickMode(meters, prefer);
    const minutes = travelMinutes(meters, mode);
    totalMinutes += minutes;
    legs.push({
      fromTitle: from.title,
      toTitle: to.title,
      travelMinutes: minutes,
      distanceKm: Math.round((meters / 1000) * 10) / 10,
      mode,
      transfers: mode === "metro" && meters >= 4000 ? 1 : 0,
      priceRub: mode === "metro" ? METRO_FARE_RUB : mode === "taxi" ? TAXI_LANDING_RUB + Math.round((meters / 1000) * TAXI_PER_KM_RUB) : null,
    });
  }
  return { points, legs, totalMinutes, totalKm: Math.round((totalMeters / 1000) * 10) / 10 };
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
