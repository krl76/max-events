// START_MODULE_CONTRACT
// PURPOSE: People matching through events — overlapping interests + nearby geo + looking-for-company, no dating flow.
// SCOPE: suggest() returns candidates with shared event or interest context and a today looking-for-company count.
// DEPENDS: typeorm, @max-events/api-contracts, profiles/check-ins/events/places/participations
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PEOPLE_MAX_KM - nearby radius
// - PeopleService - suggest
// END_MODULE_MAP

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThanOrEqual, Repository } from "typeorm";
import type { PeopleCandidate, PeopleResponse } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { toFriendDto } from "../friends/friends.service";
import { haversineKm } from "../nearby/nearby.service";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { moscowDateKey } from "../time/moscow-date";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";

export const PEOPLE_MAX_KM = 15;
const COMPANY: ParticipationEntity["status"][] = ["looking_for_company", "looking_for_travel_buddy", "looking_for_after_event_company"];
const GOING: ParticipationEntity["status"][] = ["going", "wants_to_go", "looking_for_company"];

@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(ProfileEntity) private readonly profiles: Repository<ProfileEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(ParticipationEntity) private readonly participations: Repository<ParticipationEntity>,
  ) {}

  async suggest(viewerId: string, origin: { latitude: number; longitude: number } | null, now = new Date()): Promise<PeopleResponse> {
    const profiles = await this.profiles.find();
    const mine = profiles.find((row) => row.userId === viewerId);
    const myInterests = new Set((mine?.interests ?? []).map((row) => row.toLowerCase()));
    const others = profiles.filter((row) => row.userId !== viewerId);
    const userIds = others.map((row) => row.userId);
    const [users, checkIns, parts, upcoming] = await Promise.all([
      userIds.length === 0 ? Promise.resolve([] as UserEntity[]) : this.users.find({ where: { id: In([viewerId, ...userIds]) } }),
      userIds.length === 0 ? Promise.resolve([] as CheckInEntity[]) : this.checkIns.find({ where: { userId: In([viewerId, ...userIds]) } }),
      this.participations.find(),
      this.events.find({ where: { published: true, startsAt: MoreThanOrEqual(now) } }),
    ]);
    const userById = new Map(users.map((row) => [row.id, row]));
    const latest = latestCheckInByUser(checkIns);
    const originEventIds = [...new Set([...latest.values()].map((row) => row.eventId).filter((id): id is string => id !== null))];
    const originEvents = originEventIds.length === 0 ? [] : await this.events.find({ where: { id: In(originEventIds) } });
    const originEventById = new Map(originEvents.map((row) => [row.id, row]));
    const placeIds = [...new Set([...latest.values()].flatMap((row) => (row.placeId ? [row.placeId] : [])))];
    for (const event of originEvents) if (event.placeId) placeIds.push(event.placeId);
    const placeRows = placeIds.length === 0 ? [] : await this.places.find({ where: { id: In([...new Set(placeIds)]) } });
    const placeById = new Map(placeRows.map((row) => [row.id, row]));
    const todayKey = moscowDateKey(now);
    const eventById = new Map(upcoming.map((row) => [row.id, row]));
    const myParts = parts.filter((row) => row.userId === viewerId && GOING.includes(row.status));
    const myEventIds = new Set(myParts.map((row) => row.eventId));
    const lookingToday = new Set(
      parts
        .filter((row) => COMPANY.includes(row.status) && eventById.has(row.eventId) && moscowDateKey(eventById.get(row.eventId)!.startsAt) === todayKey)
        .map((row) => row.userId),
    );
    const viewerOrigin = origin ?? coordsOf(latest.get(viewerId), originEventById, placeById);
    const people: PeopleCandidate[] = [];
    for (const profile of others) {
      const user = userById.get(profile.userId);
      if (!user) continue;
      const sharedInterests = (profile.interests ?? []).filter((interest) => myInterests.has(interest.toLowerCase()));
      const theirParts = parts.filter((row) => row.userId === profile.userId && GOING.includes(row.status));
      const sharedEventId = theirParts.find((row) => myEventIds.has(row.eventId) && eventById.has(row.eventId))?.eventId;
      const coords = coordsOf(latest.get(profile.userId), originEventById, placeById);
      const distanceKm = viewerOrigin && coords ? Math.round(haversineKm(viewerOrigin.latitude, viewerOrigin.longitude, coords.latitude, coords.longitude) * 10) / 10 : null;
      if (distanceKm !== null && distanceKm > PEOPLE_MAX_KM) continue;
      if (sharedInterests.length === 0 && !sharedEventId) continue;
      const lookingForCompanyToday = lookingToday.has(profile.userId);
      const context = sharedEventId
        ? { kind: "shared_event" as const, event: toEventDto(eventById.get(sharedEventId)!), explanation: `вы оба хотите на «${eventById.get(sharedEventId)!.title}»` }
        : { kind: "shared_interest" as const, interest: sharedInterests[0]!, explanation: `общий интерес: ${sharedInterests[0]}` };
      people.push({ person: toFriendDto(user), distanceKm, sharedInterests, lookingForCompanyToday, context });
    }
    people.sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99) || a.person.name.localeCompare(b.person.name));
    return {
      nearbyCount: people.length,
      lookingForCompanyTodayCount: people.filter((row) => row.lookingForCompanyToday).length,
      people,
    };
  }
}

function latestCheckInByUser(rows: CheckInEntity[]): Map<string, CheckInEntity> {
  const latest = new Map<string, CheckInEntity>();
  for (const row of rows) {
    const prev = latest.get(row.userId);
    if (!prev || row.checkedInAt.getTime() > prev.checkedInAt.getTime()) latest.set(row.userId, row);
  }
  return latest;
}

function coordsOf(
  row: CheckInEntity | undefined,
  events: Map<string, EventEntity>,
  places: Map<string, PlaceEntity>,
): { latitude: number; longitude: number } | null {
  if (!row) return null;
  const placeId = row.placeId ?? (row.eventId ? events.get(row.eventId)?.placeId : null);
  const place = placeId ? places.get(placeId) : undefined;
  if (!place) return null;
  return { latitude: place.latitude, longitude: place.longitude };
}
