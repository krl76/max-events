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
import { utcVisitDate } from "../checkins/check-ins.service";
import { moscowDateKey, moscowHour } from "../time/moscow-date";
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

  async board(placeId: string, viewerId: string, now = new Date()): Promise<PlaceBoard> {
    const place = await this.places.findOneBy({ id: placeId });
    if (!place || place.published === false) throw new NotFoundException("Place not found");
    const atPlace = await this.events.find({ where: { placeId, published: true } });
    const eventIds = atPlace.map((row) => row.id);
    const checkInWhere = eventIds.length === 0 ? [{ placeId }] : [{ placeId }, { eventId: In(eventIds) }];
    const scopedCheckIns = await this.checkIns.find({ where: checkInWhere });
    const weekEnd = now.getTime() + 7 * 24 * 60 * 60 * 1000;
    const weekEventsCount = atPlace.filter((row) => row.startsAt.getTime() >= now.getTime() && row.startsAt.getTime() <= weekEnd).length;
    const todayUtc = utcVisitDate(now);
    const checkedInToday = scopedCheckIns.some((row) => row.userId === viewerId && row.placeId === placeId && row.visitDate === todayUtc);
    const { occupancy, occupancyNowHour } = occupancyFrom(scopedCheckIns, now);
    const history = visitMonthsFrom(scopedCheckIns.filter((row) => row.userId === viewerId));
    return {
      placeId,
      openUntil: null,
      checkedInToday,
      weekEventsCount,
      occupancy,
      occupancyNowHour,
      visitMonths: history.months,
      visitMonthsMore: history.more,
      unitTitle: null,
      pricePerHourRub: null,
      cancelBefore: null,
      slots: [],
      upcoming: [],
    };
  }
}

export type PlaceOccupancyHour = { hour: number; load: number };
export type PlaceVisitMonth = { month: string; visitsCount: number };
export type PlaceBoard = {
  placeId: string;
  openUntil: string | null;
  checkedInToday: boolean;
  weekEventsCount: number;
  occupancy: PlaceOccupancyHour[];
  occupancyNowHour: number | null;
  visitMonths: PlaceVisitMonth[];
  visitMonthsMore: number;
  unitTitle: string | null;
  pricePerHourRub: number | null;
  cancelBefore: string | null;
  slots: unknown[];
  upcoming: unknown[];
};

export function occupancyFrom(rows: CheckInEntity[], now: Date): { occupancy: PlaceOccupancyHour[]; occupancyNowHour: number | null } {
  const hours = new Map<number, number>();
  for (const row of rows) {
    const hour = moscowHour(row.checkedInAt);
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
  }
  if (hours.size === 0) return { occupancy: [], occupancyNowHour: null };
  const max = Math.max(...hours.values());
  const occupancy = [...hours.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([hour, count]) => ({ hour, load: count / max }));
  return { occupancy, occupancyNowHour: moscowHour(now) };
}

function visitMonthsFrom(rows: CheckInEntity[]): { months: PlaceVisitMonth[]; more: number } {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const month = moscowDateKey(row.checkedInAt).slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  const months = [...counts.entries()].map(([month, visitsCount]) => ({ month, visitsCount })).sort((left, right) => left.month.localeCompare(right.month));
  const shown = months.slice(-3);
  const more = months.slice(0, Math.max(0, months.length - 3)).reduce((sum, item) => sum + item.visitsCount, 0);
  return { months: shown, more };
}
