// START_MODULE_CONTRACT
// PURPOSE: «Рядом со мной» — geo-sorted events in four time buckets, plus free-window leisure chains.
// SCOPE: timeline() haversine + Moscow calendar buckets; leisure() builds relax/active/friends chains from nearby catalog.
// DEPENDS: typeorm, @max-events/api-contracts, events/places/friends/participations
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - haversineKm - great-circle distance
// - moscowParts - calendar parts in Europe/Moscow
// - nearbyBucket - exclusive assignment onto the four-segment scale
// - NearbyService - timeline and leisure
// END_MODULE_MAP

import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, In, Repository } from "typeorm";
import type { LeisureMood, LeisureOption, NearbyBucket, NearbyCard, NearbyTimeline } from "@max-events/api-contracts";
import { toEventDto } from "../events/event.mapper";
import { EventEntity } from "../events/event.entity";
import { FriendsService } from "../friends/friends.service";
import { ParticipationEntity } from "../participations/participation.entity";
import { toPlaceDto } from "../places/places.service";
import { PlaceEntity } from "../places/place.entity";
import { PromotionService } from "../promotion/promotion.service";

const HOUR_MS = 60 * 60 * 1000;
const MAX_KM = 15;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function moscowParts(date: Date): { y: number; m: number; d: number; h: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(date);
  const num = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { y: num("year"), m: num("month"), d: num("day"), h: num("hour") };
}

function dayKey(parts: { y: number; m: number; d: number }): string {
  return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}

function tomorrowKey(now: Date): string {
  const utc = Date.UTC(moscowParts(now).y, moscowParts(now).m - 1, moscowParts(now).d + 1);
  const next = new Date(utc);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function nearbyBucket(startsAt: Date, now: Date): NearbyBucket | null {
  const delta = startsAt.getTime() - now.getTime();
  if (delta < 0) return null;
  if (delta < HOUR_MS) return "now";
  const start = moscowParts(startsAt);
  const today = dayKey(moscowParts(now));
  if (dayKey(start) === today) return start.h >= 18 ? "evening" : "inAnHour";
  if (dayKey(start) === tomorrowKey(now)) return "tomorrow";
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

  async timeline(latitude: number, longitude: number, now = new Date()): Promise<NearbyTimeline> {
    const cards = await this.cards(latitude, longitude, now);
    const empty: NearbyTimeline = { now: [], inAnHour: [], evening: [], tomorrow: [] };
    for (const card of cards) empty[card.bucket].push(card);
    return empty;
  }

  async leisure(latitude: number, longitude: number, hours: number, mood: LeisureMood, userId: string, now = new Date()): Promise<LeisureOption[]> {
    const until = new Date(now.getTime() + hours * HOUR_MS);
    const cards = (await this.cards(latitude, longitude, now)).filter((card) => Date.parse(card.event.startsAt) <= until.getTime());
    const places = (await this.places.find({ where: { published: true } }))
      .map((place) => ({ place, km: haversineKm(latitude, longitude, place.latitude, place.longitude) }))
      .filter((row) => row.km <= MAX_KM)
      .sort((a, b) => a.km - b.km);

    if (mood === "relax") {
      const park = places.find((row) => row.place.category === "park");
      const museum = places.find((row) => row.place.category === "museum");
      const food = places.find((row) => row.place.category === "food");
      const event = cards.find((card) => card.event.category === "afisha");
      const stops = [];
      if (park) stops.push({ kind: "place" as const, placeId: park.place.id, eventId: null, title: park.place.title, startsAt: null });
      if (event) stops.push({ kind: "event" as const, placeId: event.place.id, eventId: event.event.id, title: event.event.title, startsAt: event.event.startsAt });
      else if (museum) stops.push({ kind: "place" as const, placeId: museum.place.id, eventId: null, title: museum.place.title, startsAt: null });
      if (food) stops.push({ kind: "place" as const, placeId: food.place.id, eventId: null, title: food.place.title, startsAt: null });
      return stops.length === 0 ? [] : [{ mood, title: "Расслабиться", stops }];
    }

    if (mood === "active") {
      const sportEvent = cards.find((card) => card.event.category === "sport");
      const sportPlace = places.find((row) => row.place.category === "sport");
      const park = places.find((row) => row.place.category === "park");
      const stops = [];
      if (sportEvent) stops.push({ kind: "event" as const, placeId: sportEvent.place.id, eventId: sportEvent.event.id, title: sportEvent.event.title, startsAt: sportEvent.event.startsAt });
      else if (sportPlace) stops.push({ kind: "place" as const, placeId: sportPlace.place.id, eventId: null, title: sportPlace.place.title, startsAt: null });
      if (park) stops.push({ kind: "place" as const, placeId: park.place.id, eventId: null, title: park.place.title, startsAt: null });
      return stops.length === 0 ? [] : [{ mood, title: "Активно", stops }];
    }

    const friendIds = [...(await this.friends.friendIds(userId))];
    const going = friendIds.length === 0 ? [] : await this.participations.find({ where: { userId: In(friendIds) } });
    const friendEventIds = new Set(going.filter((row) => row.status === "going" || row.status === "wants_to_go").map((row) => row.eventId));
    const withFriends = cards.filter((card) => friendEventIds.has(card.event.id));
    const stops = withFriends.slice(0, 3).map((card) => ({ kind: "event" as const, placeId: card.place.id, eventId: card.event.id, title: card.event.title, startsAt: card.event.startsAt }));
    return stops.length === 0 ? [] : [{ mood, title: "С друзьями", stops }];
  }

  private async cards(latitude: number, longitude: number, now: Date): Promise<NearbyCard[]> {
    const horizon = new Date(now.getTime() + 48 * HOUR_MS);
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
      if (distanceKm > MAX_KM) continue;
      const promoted = pinIds.has(event.id);
      cards.push({ event: toEventDto(event, { promoted }), place: toPlaceDto(place), distanceKm: Math.round(distanceKm * 10) / 10, bucket, promoted });
    }
    cards.sort((a, b) => Number(b.promoted) - Number(a.promoted) || a.distanceKm - b.distanceKm || a.event.startsAt.localeCompare(b.event.startsAt));
    return cards;
  }
}
