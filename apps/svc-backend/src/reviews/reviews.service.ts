// START_MODULE_CONTRACT
// PURPOSE: Post-event reviews — only booked users, one review per user+event, rating aggregates.
// SCOPE: create for CurrentUser with any booking including cancelled (post-event review); rating for event and for place (via event.placeId). Unpublished events 404.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, bookings/events
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ReviewsService - create, eventRating, placeRating
// - toReviewDto - entity to Review contract
// - buildRating - average stars and category scores
// END_MODULE_MAP

import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import { ReviewSchema, type CreateReviewWrite, type EventRating, type Review } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { ReviewEntity } from "./review.entity";

const CATEGORY_KEYS = ["atmosphere", "organization", "price", "place"] as const;

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewEntity) private readonly reviews: Repository<ReviewEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
  ) {}

  async create(userId: string, payload: CreateReviewWrite): Promise<Review> {
    const event = await this.events.findOneBy({ id: payload.eventId });
    if (!event || event.published === false) throw new NotFoundException("Event not found");
    const booking = await this.bookings.findOneBy({ userId, eventId: payload.eventId });
    if (!booking) throw new ForbiddenException("Only booked users can review this event");
    const existing = await this.reviews.findOneBy({ userId, eventId: payload.eventId });
    const fields = {
      stars: payload.stars,
      categoryScores: payload.categoryScores ?? {},
      wouldGoAgain: payload.wouldGoAgain,
      photoUrls: (payload.photos ?? []).map((photo) => photo.url),
      text: payload.text ?? null,
    };
    try {
      const saved = existing ? await this.reviews.save(Object.assign(existing, fields)) : await this.reviews.save(this.reviews.create({ userId, eventId: payload.eventId, ...fields }));
      return toReviewDto(saved);
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
        const row = await this.reviews.findOneBy({ userId, eventId: payload.eventId });
        if (row) return toReviewDto(await this.reviews.save(Object.assign(row, fields)));
        throw new ConflictException("Review already exists");
      }
      throw error;
    }
  }

  async eventRating(eventId: string): Promise<EventRating> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    const rows = await this.reviews.find({ where: { eventId } });
    return buildRating(rows, { eventId, placeId: null });
  }

  async placeRating(placeId: string): Promise<EventRating> {
    const events = await this.events.find({ where: { placeId } });
    const eventIds = events.map((row) => row.id);
    const rows = eventIds.length === 0 ? [] : await this.reviews.find({ where: { eventId: In(eventIds) } });
    return buildRating(rows, { eventId: null, placeId });
  }
}

export function toReviewDto(row: ReviewEntity): Review {
  return ReviewSchema.parse({
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    placeId: null,
    stars: row.stars,
    categoryScores: row.categoryScores ?? {},
    wouldGoAgain: row.wouldGoAgain,
    photos: (row.photoUrls ?? []).map((url) => ({ url })),
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  });
}

export function buildRating(rows: ReviewEntity[], target: { eventId: string | null; placeId: string | null }): EventRating {
  const reviewsCount = rows.length;
  const averageStars = reviewsCount === 0 ? 0 : rows.reduce((sum, row) => sum + row.stars, 0) / reviewsCount;
  const categoryAverages = { atmosphere: null, organization: null, price: null, place: null } as EventRating["categoryAverages"];
  for (const key of CATEGORY_KEYS) {
    const values = rows.map((row) => row.categoryScores?.[key]).filter((value): value is number => typeof value === "number");
    categoryAverages[key] = values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  return {
    summary: { eventId: target.eventId, placeId: target.placeId, averageStars, reviewsCount },
    categoryAverages,
  };
}
