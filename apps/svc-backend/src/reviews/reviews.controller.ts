// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for reviews and rating aggregates.
// SCOPE: POST /reviews; GET /events/:id/rating; GET /places/:id/rating.
// DEPENDS: @nestjs/common, @max-events/api-contracts, ../auth/auth.guard, ./reviews.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ReviewsController - POST /reviews
// - EventRatingsController - GET /events/:id/rating
// - PlaceRatingsController - GET /places/:id/rating
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CreateReviewWriteSchema, type EventRating, type Review } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { UserEntity } from "../users/user.entity";
import { ReviewsService } from "./reviews.service";

@Controller("reviews")
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Post()
  async create(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Review> {
    const parsed = CreateReviewWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid review payload");
    return this.reviews.create(user.id, parsed.data);
  }
}

@Controller("events")
export class EventRatingsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Get(":id/rating")
  rating(@Param("id", ParseUUIDPipe) id: string): Promise<EventRating> {
    return this.reviews.eventRating(id);
  }

  @Get(":id/review-facts")
  factTags(@Param("id", ParseUUIDPipe) id: string): Promise<Array<{ code: string; label: string }>> {
    return this.reviews.factTags(id);
  }

  @Get(":id/mood-tags")
  moodTags(@Param("id", ParseUUIDPipe) id: string): Promise<Array<{ code: string; label: string; count: number }>> {
    return this.reviews.moodTags(id);
  }
}

@Controller("places")
export class PlaceRatingsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Get(":id/rating")
  rating(@Param("id", ParseUUIDPipe) id: string): Promise<EventRating> {
    return this.reviews.placeRating(id);
  }
}
