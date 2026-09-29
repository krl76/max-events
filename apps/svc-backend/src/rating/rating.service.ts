// START_MODULE_CONTRACT
// PURPOSE: Organizer rating from reviews, check-ins and past event start punctuality.
// SCOPE: forOrganizer hides the card when reviews < MIN_REVIEWS; onTimePercent null when no past events.
// DEPENDS: typeorm, @max-events/api-contracts, events/reviews/check-ins
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MIN_REVIEWS - hide rating below this count
// - ON_TIME_BEFORE_MS - check-in window before startsAt
// - ON_TIME_AFTER_MS - check-in window after startsAt
// - buildOrganizerRating - pure metrics
// - RatingService - forOrganizer / forEvent
// END_MODULE_MAP

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { OrganizerRating, OrganizerRatingResponse } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { OrganizationsService } from "../organizations/organizations.service";
import { ReviewEntity } from "../reviews/review.entity";

export const MIN_REVIEWS = 3;
export const ON_TIME_BEFORE_MS = 30 * 60 * 1000;
export const ON_TIME_AFTER_MS = 15 * 60 * 1000;

@Injectable()
export class RatingService {
  constructor(
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(ReviewEntity) private readonly reviews: Repository<ReviewEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @Inject(OrganizationsService) private readonly organizations: OrganizationsService,
  ) {}

  async forOrganizer(id: string, now = new Date()): Promise<OrganizerRatingResponse> {
    const org = await this.organizations.findById(id);
    const organizationId = org?.id ?? null;
    const organizerUserId = org?.organizerUserId ?? (await this.organizations.organizerUserIdOf(id)) ?? id;
    const owned = organizationId ? await this.events.find({ where: [{ organizerOrganizationId: organizationId }, { organizerUserId }] }) : await this.events.find({ where: { organizerUserId } });
    const unique = [...new Map(owned.map((row) => [row.id, row])).values()];
    const eventIds = unique.map((row) => row.id);
    const [reviewRows, checkInRows] = await Promise.all([eventIds.length === 0 ? Promise.resolve([] as ReviewEntity[]) : this.reviews.find({ where: { eventId: In(eventIds) } }), eventIds.length === 0 ? Promise.resolve([] as CheckInEntity[]) : this.checkIns.find({ where: { eventId: In(eventIds) } })]);
    return { rating: buildOrganizerRating(organizationId ?? organizerUserId, unique, reviewRows, checkInRows, now) };
  }

  async forEvent(eventId: string, now = new Date()): Promise<OrganizerRatingResponse> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event || event.published === false) throw new NotFoundException("Event not found");
    const key = event.organizerOrganizationId ?? event.organizerUserId;
    if (!key) return { rating: null };
    return this.forOrganizer(key, now);
  }
}

export function buildOrganizerRating(organizerUserId: string, events: EventEntity[], reviews: ReviewEntity[], checkIns: CheckInEntity[], now: Date): OrganizerRating | null {
  if (reviews.length < MIN_REVIEWS) return null;
  const averageStars = reviews.reduce((sum, row) => sum + row.stars, 0) / reviews.length;
  const recommendPercent = (reviews.filter((row) => row.wouldGoAgain).length / reviews.length) * 100;
  const visitsCount = checkIns.filter((row) => row.eventId !== null).length;
  const past = events.filter((row) => row.published !== false && row.startsAt.getTime() <= now.getTime());
  let onTimePercent: number | null = null;
  if (past.length > 0) {
    const onTime = past.filter((event) =>
      checkIns.some((row) => {
        if (row.eventId !== event.id) return false;
        const delta = row.checkedInAt.getTime() - event.startsAt.getTime();
        return delta >= -ON_TIME_BEFORE_MS && delta <= ON_TIME_AFTER_MS;
      }),
    ).length;
    onTimePercent = (onTime / past.length) * 100;
  }
  const published = events.filter((row) => row.published !== false);
  const attendancePercent = past.length === 0 ? null : (checkIns.filter((row) => row.eventId !== null && past.some((event) => event.id === row.eventId)).length / Math.max(past.length, 1)) * 100;
  const boundedAttendance = attendancePercent === null ? null : Math.min(100, attendancePercent);
  return {
    organizerUserId,
    averageStars,
    recommendPercent,
    visitsCount,
    onTimePercent,
    reviewsCount: reviews.length,
    attendancePercent: boundedAttendance,
    eventsCount: published.length,
  };
}
