// START_MODULE_CONTRACT
// PURPOSE: «Рядом со мной» — geo-sorted events in four time buckets, plus free-window leisure chains.
// SCOPE: timeline() haversine + Moscow calendar buckets; leisure() builds relax/active/friends chains from nearby catalog.
// DEPENDS: typeorm, @max-events/api-contracts, events/places/friends/participations
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DEFAULT_NEARBY_RADIUS_KM - how wide nearby looks when the caller names no radius
// - haversineKm - great-circle distance
// - moscowParts - calendar parts in Europe/Moscow
// - nearbyBucket - exclusive assignment onto the four-segment scale
// - NearbyService - timeline and leisure
// END_MODULE_MAP

import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, In, Repository } from "typeorm";
import type { LeisureMood, LeisureOption, LeisureStop, NearbyBucket, NearbyCard, NearbyTimeline } from "@max-events/api-contracts";
import { toEventDto } from "../events/event.mapper";
import { EventEntity } from "../events/event.entity";
import { FriendsService } from "../friends/friends.service";
import { haversineKm } from "../geo/haversine";
import { ParticipationEntity } from "../participations/participation.entity";
import { toPlaceDto } from "../places/places.service";
import { PlaceEntity } from "../places/place.entity";
import { PromotionService } from "../promotion/promotion.service";

export { haversineKm } from "../geo/haversine";

const HOUR_MS = 60 * 60 * 1000;
const HORIZON_MS = 14 * 24 * HOUR_MS;
export const DEFAULT_NEARBY_RADIUS_KM = 15;

function clampRadiusKm(km: number | undefined): number {
  if (km === undefined || !Number.isFinite(km) || km <= 0) return DEFAULT_NEARBY_RADIUS_KM;
  return Math.min(100, km);
}

function roundKm(km: number): number {
  return Math.round(km * 10) / 10;
}

function placeStop(title: string, placeId: string, km: number): LeisureStop {
  return { kind: "place", placeId, eventId: null, title, startsAt: null, distanceKm: roundKm(km), priceRub: null };
}

function eventStop(card: NearbyCard): LeisureStop {
  return { kind: "event", placeId: card.place.id, eventId: card.event.id, title: card.event.title, startsAt: card.event.startsAt, distanceKm: card.distanceKm, priceRub: card.event.priceRub };
}

export function moscowParts(date: Date): { y: number; m: number; d: number; h: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(date);
  const num = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { y: num("year"), m: num("month"), d: num("day"), h: num("hour") };
}

function dayKey(parts: { y: number; m: number; d: number }): string {
  return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}

export function nearbyBucket(startsAt: Date, now: Date): NearbyBucket | null {
  const delta = startsAt.getTime() - now.getTime();
  if (delta < 0) return null;
  if (delta < HOUR_MS) return "now";
  const start = moscowParts(startsAt);
  const today = dayKey(moscowParts(now));
  if (dayKey(start) === today) return start.h >= 18 ? "evening" : "inAnHour";
  if (delta <= HORIZON_MS) return "tomorrow";
  return null;
}

@Injectable()
export class NearbyService {
  constructor(
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(ParticipationEntity) private readonly participations: Repository<ParticipationEntity>,
    @Inject(FriendsService) private readonly friends: FriendsService,
    @Inject(PromotionService) private readonly promotions: PromotionService,
  ) {}

  async timeline(latitude: number, longitude: number, now = new Date(), radiusKm?: number): Promise<NearbyTimeline> {
    const cards = await this.cards(latitude, longitude, now, radiusKm);
    const empty: NearbyTimeline = { now: [], inAnHour: [], evening: [], tomorrow: [] };
    for (const card of cards) empty[card.bucket].push(card);
    return empty;
  }

  async leisure(latitude: number, longitude: number, hours: number, mood: LeisureMood, userId: string, now = new Date(), radiusKm?: number): Promise<LeisureOption[]> {
    const until = new Date(now.getTime() + hours * HOUR_MS);
    const radius = clampRadiusKm(radiusKm);
    const cards = (await this.cards(latitude, longitude, now, radius)).filter((card) => Date.parse(card.event.startsAt) <= until.getTime());
    const places = (await this.places.find({ where: { published: true } }))
      .map((place) => ({ place, km: haversineKm(latitude, longitude, place.latitude, place.longitude) }))
      .filter((row) => row.km <= radius)
      .sort((a, b) => a.km - b.km);

    if (mood === "relax") {
      const park = places.find((row) => row.place.category === "park");
      const museum = places.find((row) => row.place.category === "museum");
      const food = places.find((row) => row.place.category === "food");
      const event = cards.find((card) => card.event.category === "afisha");
      const stops = [];
      if (park) stops.push(placeStop(park.place.title, park.place.id, park.km));
      if (event) stops.push(eventStop(event));
      else if (museum) stops.push(placeStop(museum.place.title, museum.place.id, museum.km));
      if (food) stops.push(placeStop(food.place.title, food.place.id, food.km));
      return stops.length === 0 ? [] : [{ mood, title: "Расслабиться", stops }];
    }

    if (mood === "active") {
      const sportEvent = cards.find((card) => card.event.category === "sport");
      const sportPlace = places.find((row) => row.place.category === "sport");
      const park = places.find((row) => row.place.category === "park");
      const stops = [];
      if (sportEvent) stops.push(eventStop(sportEvent));
      else if (sportPlace) stops.push(placeStop(sportPlace.place.title, sportPlace.place.id, sportPlace.km));
      if (park) stops.push(placeStop(park.place.title, park.place.id, park.km));
      return stops.length === 0 ? [] : [{ mood, title: "Активно", stops }];
    }

    const friendIds = [...(await this.friends.friendIds(userId))];
    const going = friendIds.length === 0 ? [] : await this.participations.find({ where: { userId: In(friendIds) } });
    const friendEventIds = new Set(going.filter((row) => row.status === "going" || row.status === "wants_to_go").map((row) => row.eventId));
    const withFriends = cards.filter((card) => friendEventIds.has(card.event.id));
    const stops = withFriends.slice(0, 3).map(eventStop);
    return stops.length === 0 ? [] : [{ mood, title: "С друзьями", stops }];
  }

  private async cards(latitude: number, longitude: number, now: Date, radiusKm?: number): Promise<NearbyCard[]> {
    const maxKm = clampRadiusKm(radiusKm);
    const horizon = new Date(now.getTime() + HORIZON_MS);
    const events = await this.events.find({ where: { published: true, startsAt: Between(now, horizon) } });
    const places = await this.places.find({ where: { published: true } });
    const placeById = new Map(places.map((row) => [row.id, row]));
    const pinIds = await this.promotions.pinEventIds(now);
    const cards: NearbyCard[] = [];
    for (const event of events) {
      if (!event.placeId) continue;
      const place = placeById.get(event.placeId);
      if (!place) continue;
      const bucket = nearbyBucket(event.startsAt, now);
      if (!bucket) continue;
      const distanceKm = haversineKm(latitude, longitude, place.latitude, place.longitude);
      if (distanceKm > maxKm + 0.05) continue;
      const promoted = pinIds.has(event.id);
      cards.push({ event: toEventDto(event, { promoted }), place: toPlaceDto(place), distanceKm: Math.round(distanceKm * 10) / 10, bucket, promoted });
    }
    cards.sort((a, b) => Number(b.promoted) - Number(a.promoted) || a.distanceKm - b.distanceKm || a.event.startsAt.localeCompare(b.event.startsAt));
    return cards;
  }
}
