// START_MODULE_CONTRACT
// PURPOSE: Aggregate the place-as-social-object page from events, check-ins, friends, reviews.
// SCOPE: todayEvents, friend visits / going-today, rating, popularityToday, personalVisitsCount.
// DEPENDS: typeorm, @max-events/api-contracts, friends/reviews/check-ins/events/places/participations
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlacePageService - GET payload for a place
// END_MODULE_MAP

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { PlacePage } from "@max-events/api-contracts";
import { utcVisitDate } from "../checkins/check-ins.service";
import { CheckInEntity } from "../checkins/check-in.entity";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { FriendsService, toFriendDto } from "../friends/friends.service";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { ReviewsService } from "../reviews/reviews.service";
import { UserEntity } from "../users/user.entity";

const GOING: ParticipationEntity["status"][] = ["going", "wants_to_go"];

@Injectable()
export class PlacePageService {
  constructor(
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(ParticipationEntity) private readonly participations: Repository<ParticipationEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(FriendsService) private readonly friends: FriendsService,
    @Inject(ReviewsService) private readonly reviews: ReviewsService,
  ) {}

  async get(placeId: string, viewerId: string, now = new Date()): Promise<PlacePage> {
    const place = await this.places.findOneBy({ id: placeId });
    if (!place) throw new NotFoundException("Place not found");
    const day = utcVisitDate(now);
    const atPlace = await this.events.find({ where: { placeId } });
    const todayEvents = atPlace.filter((event) => utcVisitDate(event.startsAt) === day).map(toEventDto);
    const todayEventIds = new Set(todayEvents.map((event) => event.id));
    const friendIds = await this.friends.friendIds(viewerId);
    const allCheckIns = await this.checkIns.find();
    const popularityToday = allCheckIns.filter((row) => row.placeId === placeId && row.visitDate === day).length;
    const personalVisitsCount = allCheckIns.filter((row) => row.userId === viewerId && (row.placeId === placeId || (row.eventId !== null && atPlace.some((event) => event.id === row.eventId)))).length;
    const friendVisits = new Map<string, number>();
    for (const row of allCheckIns) {
      if (!friendIds.has(row.userId)) continue;
      const atThisPlace = row.placeId === placeId || (row.eventId !== null && atPlace.some((event) => event.id === row.eventId));
      if (!atThisPlace) continue;
      friendVisits.set(row.userId, (friendVisits.get(row.userId) ?? 0) + 1);
    }
    const goingToday = new Set<string>();
    if (todayEventIds.size > 0) {
      const parts = await this.participations.find();
      for (const row of parts) {
        if (friendIds.has(row.userId) && todayEventIds.has(row.eventId) && GOING.includes(row.status)) goingToday.add(row.userId);
      }
    }
    const friendUserIds = new Set([...friendVisits.keys(), ...goingToday]);
    const friends = [];
    for (const id of friendUserIds) {
      const user = await this.users.findOneBy({ id });
      if (!user) continue;
      friends.push({ friend: toFriendDto(user), visitsCount: friendVisits.get(id) ?? 0, goingToday: goingToday.has(id) });
    }
    const rating = await this.reviews.placeRating(placeId);
    return { placeId, todayEvents, friends, rating, popularityToday, personalVisitsCount };
  }
}
