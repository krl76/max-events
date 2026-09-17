// START_MODULE_CONTRACT
// PURPOSE: Aggregate the place-as-social-object page from events, check-ins, friends, reviews.
// SCOPE: todayEvents (Europe/Moscow calendar), friend visits / going-today, rating, popularityToday, personalVisitsCount. Unpublished places 404.
// DEPENDS: typeorm, @max-events/api-contracts, friends/reviews/check-ins/events/places/participations
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlacePageService - GET payload for a place
// END_MODULE_MAP

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { PlacePage } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { FriendsService, toFriendDto } from "../friends/friends.service";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlaceEntity } from "../places/place.entity";
import { ReviewsService } from "../reviews/reviews.service";
import { moscowDateKey } from "../time/moscow-date";
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
    if (!place || place.published === false) throw new NotFoundException("Place not found");
    const day = moscowDateKey(now);
    const atPlace = await this.events.find({ where: { placeId, published: true } });
    const todayEvents = atPlace.filter((event) => moscowDateKey(event.startsAt) === day).map((row) => toEventDto(row));
    const todayEventIds = todayEvents.map((event) => event.id);
    const friendIds = [...(await this.friends.friendIds(viewerId))];
    const eventIds = atPlace.map((event) => event.id);
    const checkInWhere = eventIds.length === 0 ? [{ placeId }] : [{ placeId }, { eventId: In(eventIds) }];
    const scopedCheckIns = await this.checkIns.find({ where: checkInWhere });
    const popularityToday = scopedCheckIns.filter((row) => row.placeId === placeId && row.visitDate === day).length;
    const personalVisitsCount = scopedCheckIns.filter((row) => row.userId === viewerId).length;
    const friendVisits = new Map<string, number>();
    const friendIdSet = new Set(friendIds);
    for (const row of scopedCheckIns) {
      if (!friendIdSet.has(row.userId)) continue;
      friendVisits.set(row.userId, (friendVisits.get(row.userId) ?? 0) + 1);
    }
    const goingToday = new Set<string>();
    if (todayEventIds.length > 0 && friendIds.length > 0) {
      const parts = await this.participations.find({ where: { eventId: In(todayEventIds), userId: In(friendIds) } });
      for (const row of parts) {
        if (GOING.includes(row.status)) goingToday.add(row.userId);
      }
    }
    const friendUserIds = [...new Set([...friendVisits.keys(), ...goingToday])];
    const friendUsers = friendUserIds.length === 0 ? [] : await this.users.find({ where: { id: In(friendUserIds) } });
    const friends = friendUsers.map((user) => ({ friend: toFriendDto(user), visitsCount: friendVisits.get(user.id) ?? 0, goingToday: goingToday.has(user.id) }));
    const rating = await this.reviews.placeRating(placeId);
    return { placeId, todayEvents, friends, rating, popularityToday, personalVisitsCount };
  }
}
