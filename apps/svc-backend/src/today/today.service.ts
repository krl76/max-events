// START_MODULE_CONTRACT
// PURPOSE: "What to do today?" personal digest — nearby/suitable/friends counts and labelled event cards.
// SCOPE: buildTodayDigest from city, interests, friends, places, optional origin; TodayService loads CurrentUser data.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../events, ../places, ../users, ../friends, ../participations
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - walkingMinutes - haversine meters / 80 m per minute
// - buildTodayDigest - summary + up to 10 labelled cards
// - TodayService - digest(userId, now, origin)
// END_MODULE_MAP

import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { TodayCardLabel, TodayEventCard, TodayResponse } from "@max-events/api-contracts";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { FriendsService, toFriendDto } from "../friends/friends.service";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { ProfilesService } from "../users/profiles.service";
import { UserEntity } from "../users/user.entity";

const WALK_METERS_PER_MINUTE = 80;
const CARD_LIMIT = 10;

export type GeoOrigin = { latitude: number; longitude: number };

export type TodayFriend = { id: string; name: string };

export type TodayDigestInput = {
  now: Date;
  city: string;
  interests: string[];
  origin: GeoOrigin | null;
  events: EventEntity[];
  places: PlaceEntity[];
  friends: TodayFriend[];
  participations: Array<{ userId: string; eventId: string; status: string }>;
};

@Injectable()
export class TodayService {
  constructor(
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(ParticipationEntity) private readonly participations: Repository<ParticipationEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
    @Inject(FriendsService) private readonly friends: FriendsService,
  ) {}

  async digest(userId: string, now = new Date(), origin: GeoOrigin | null = null): Promise<TodayResponse> {
    const profile = await this.profiles.getOrCreate(userId);
    const friendIds = await this.friends.friendIds(userId);
    const [events, places, participations, friendUsers] = await Promise.all([
      this.events.find(),
      this.places.find(),
      this.participations.find(),
      this.users.find(),
    ]);
    const friends: TodayFriend[] = friendUsers.filter((row) => friendIds.has(row.id)).map((row) => ({ id: row.id, name: toFriendDto(row).name }));
    return buildTodayDigest({
      now,
      city: profile.city,
      interests: profile.interests,
      origin,
      events,
      places,
      friends,
      participations: participations.map((row) => ({ userId: row.userId, eventId: row.eventId, status: row.status })),
    });
  }
}

export function buildTodayDigest(input: TodayDigestInput): TodayResponse {
  const nearby = input.events
    .filter((row) => row.published && row.city === input.city && row.startsAt.getTime() >= input.now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));
  const suitable = nearby.filter((row) => matchesInterests(row, input.interests));
  const friendIds = new Set(input.friends.map((row) => row.id));
  const friendNameById = new Map(input.friends.map((row) => [row.id, firstName(row.name)]));
  const attendingByEvent = new Map<string, string>();
  const withFriends = new Set<string>();
  for (const row of input.participations) {
    if (!friendIds.has(row.userId)) continue;
    if (row.status !== "going" && row.status !== "looking_for_company") continue;
    withFriends.add(row.eventId);
    if (!attendingByEvent.has(row.eventId)) attendingByEvent.set(row.eventId, friendNameById.get(row.userId) ?? "друг");
  }
  const placeById = new Map(input.places.map((row) => [row.id, row]));
  const cards: TodayEventCard[] = nearby.slice(0, CARD_LIMIT).map((row) => ({
    event: toEventDto(row),
    labels: cardLabels(row, row.placeId ? placeById.get(row.placeId) : undefined, input.origin, attendingByEvent.get(row.id)),
  }));
  return {
    summary: {
      nearbyCount: nearby.length,
      suitableCount: suitable.length,
      withFriendsCount: nearby.filter((row) => withFriends.has(row.id)).length,
    },
    cards,
  };
}

export function walkingMinutes(from: GeoOrigin, latitude: number, longitude: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = toRad(latitude - from.latitude);
  const dLon = toRad(longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.latitude)) * Math.cos(toRad(latitude)) * Math.sin(dLon / 2) ** 2;
  const meters = 2 * earth * Math.asin(Math.min(1, Math.sqrt(a)));
  return Math.max(0, Math.round(meters / WALK_METERS_PER_MINUTE));
}

function matchesInterests(event: EventEntity, interests: string[]): boolean {
  if (interests.length === 0) return true;
  const haystack = `${event.category} ${event.title} ${event.description}`.toLowerCase();
  return interests.some((interest) => haystack.includes(interest.toLowerCase()));
}

function cardLabels(event: EventEntity, place: PlaceEntity | undefined, origin: GeoOrigin | null, friendName: string | undefined): TodayCardLabel[] {
  const labels: TodayCardLabel[] = [];
  if (origin && place) labels.push({ kind: "distance", minutes: walkingMinutes(origin, place.latitude, place.longitude) });
  if (friendName) labels.push({ kind: "friend_attending", friendName });
  if (!event.isPaid) labels.push({ kind: "free_entry" });
  if (event.capacity !== null) labels.push({ kind: "spots_left", count: Math.max(0, event.capacity - event.bookedCount) });
  return labels;
}

function firstName(name: string): string {
  const part = name.trim().split(/\s+/)[0];
  return part && part.length > 0 ? part : name;
}
